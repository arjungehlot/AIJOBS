import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { Application } from '../applications/application.schema';
import { ApplicationsService } from '../applications/applications.service';
import { AuditService } from '../audit/audit.service';
import { AppStatus, canTransition } from '../domain/application-state';
import { classifyReply, ReplyCategory } from '../domain/reply-classifier';
import { FollowUpsService } from '../followups/followups.service';
import { InboundMessage } from './message.schema';

export const ImportDto = z.object({
  fromEmail: z.string().trim().toLowerCase().email().optional(),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(5).max(20000),
  receivedAt: z.coerce.date().optional(),
  applicationId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
});
export const LinkDto = z.object({ applicationId: z.string().regex(/^[a-f0-9]{24}$/i) });

/** What each category suggests. Only statuses a person could set themselves; nothing here sends or accepts anything. */
const SUGGEST: Partial<Record<ReplyCategory, AppStatus>> = {
  interview_invitation: 'interview', recruiter_screening: 'hr_replied', assessment: 'assessment', rejection: 'rejected',
  offer: 'offer', info_request: 'hr_replied', salary_discussion: 'hr_replied', follow_up_required: 'hr_replied',
};
const ORDER_FROM_APPLIED: Record<string, AppStatus[]> = {
  hr_replied: ['hr_replied'], interview: ['hr_replied', 'interview'], assessment: ['hr_replied', 'assessment'],
  rejected: ['hr_replied', 'rejected'], offer: ['hr_replied', 'offer'],
};

@Injectable()
export class InboxService {
  constructor(
    @InjectModel(InboundMessage.name) private readonly model: Model<InboundMessage>,
    @InjectModel(Application.name) private readonly apps: Model<Application>,
    private readonly appsSvc: ApplicationsService,
    private readonly followups: FollowUpsService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string) {
    const items = await this.model.find({ userId }).sort({ receivedAt: -1 }).limit(200)
      .populate({ path: 'applicationId', select: 'status jobId', populate: { path: 'jobId', select: 'company title' } }).lean();
    return items.map((m: any) => ({ ...m, suggestedStatus: SUGGEST[m.analysis?.category as ReplyCategory] ?? null }));
  }

  async import(userId: string, dto: z.infer<typeof ImportDto>) {
    const analysis = classifyReply({ subject: dto.subject, body: dto.body, from: dto.fromEmail });
    const applicationId = dto.applicationId ?? (await this.guessApplication(userId, dto.fromEmail));
    if (dto.applicationId && !(await this.apps.exists({ _id: dto.applicationId, userId }))) throw new NotFoundException('Application not found');
    const m = await this.model.create({ userId, ...dto, applicationId, receivedAt: dto.receivedAt ?? new Date(), analysis });
    await this.audit.record({ userId, actor: 'user', action: 'inbox.imported', entityType: 'inbound_message', entityId: String(m._id), result: 'success', meta: { category: analysis.category, linked: !!applicationId } });
    return { ...m.toObject(), suggestedStatus: SUGGEST[analysis.category] ?? null };
  }

  async link(userId: string, id: string, applicationId: string) {
    if (!(await this.apps.exists({ _id: applicationId, userId }))) throw new NotFoundException('Application not found');
    const m = await this.model.findOneAndUpdate({ _id: id, userId }, { $set: { applicationId } }, { new: true }).lean();
    if (!m) throw new NotFoundException('Message not found');
    return m;
  }

  /** Applies the suggested status only because the user asked, then adjusts reminders. */
  async applySuggestion(userId: string, id: string) {
    const m = await this.model.findOne({ _id: id, userId });
    if (!m) throw new NotFoundException('Message not found');
    if (!m.applicationId) throw new BadRequestException('Link this message to an application first');
    const target = SUGGEST[m.analysis.category as ReplyCategory];
    if (!target) throw new BadRequestException('This kind of message does not change an application status');
    const app = await this.apps.findOne({ _id: m.applicationId, userId }).lean();
    if (!app) throw new NotFoundException('Application not found');

    let cur = app.status as AppStatus;
    if (cur !== target) {
      const path = cur === 'applied' ? ORDER_FROM_APPLIED[target] ?? [target] : [target];
      for (const step of path) {
        if (step === cur) continue;
        if (!canTransition(cur, step)) throw new BadRequestException(`Cannot move from ${cur} to ${step}. Change it manually in Applications.`);
        await this.appsSvc.setStatus(userId, String(app._id), step);
        cur = step;
      }
    }
    // A reply makes pending "nudge" reminders pointless.
    await this.followups.cancelPendingForApplication(userId, String(app._id), 'Recruiter replied');
    const ex = m.analysis.extracted ?? {};
    if (m.analysis.category === 'interview_invitation' && ex.dateISO) {
      await this.followups.createFromReply(userId, String(app._id), 'interview', 'Interview', new Date(ex.dateISO));
    }
    if (m.analysis.category === 'assessment' && ex.deadlineText) {
      await this.followups.createFromReply(userId, String(app._id), 'deadline', `Assessment due: ${ex.deadlineText}`, new Date(Date.now() + 2 * 86_400_000));
    }
    m.state = 'handled'; m.appliedStatus = cur; await m.save();
    await this.audit.record({ userId, actor: 'user', action: 'inbox.suggestion_applied', entityType: 'application', entityId: String(app._id), result: 'success', meta: { messageId: id, to: cur } });
    return { applicationId: String(app._id), status: cur };
  }

  async remove(userId: string, id: string) {
    const r = await this.model.deleteOne({ _id: id, userId });
    if (!r.deletedCount) throw new NotFoundException('Message not found');
    return { deleted: true };
  }

  private async guessApplication(userId: string, from?: string) {
    if (!from) return undefined;
    const a = await this.apps.findOne({ userId, 'recipient.email': from, sentAt: { $exists: true } }).sort({ sentAt: -1 }).select('_id').lean();
    return a?._id;
  }
}
