import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { addBusinessDays } from '../domain/business-days';
import { FollowUp } from './followup.schema';

export const CreateFollowUpDto = z.object({
  title: z.string().trim().min(1).max(200),
  dueAt: z.coerce.date(),
  kind: z.enum(['follow_up', 'deadline', 'interview', 'custom']).default('custom'),
  applicationId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  note: z.string().max(1000).optional(),
});
export const ListFollowUpsQuery = z.object({ status: z.enum(['pending', 'done', 'cancelled']).optional() });

@Injectable()
export class FollowUpsService {
  constructor(@InjectModel(FollowUp.name) private readonly model: Model<FollowUp>, private readonly audit: AuditService) {}

  list(userId: string, status?: string) {
    return this.model.find({ userId, ...(status ? { status } : {}) }).sort({ dueAt: 1 }).limit(300).populate({ path: 'applicationId', select: 'jobId', populate: { path: 'jobId', select: 'company title' } }).lean();
  }

  async create(userId: string, dto: z.infer<typeof CreateFollowUpDto>) {
    const t = await this.model.create({ ...dto, userId, createdBy: 'user' });
    await this.audit.record({ userId, actor: 'user', action: 'followup.created', entityType: 'follow_up', entityId: String(t._id), result: 'success' });
    return t;
  }

  async complete(userId: string, id: string) {
    const t = await this.model.findOneAndUpdate({ _id: id, userId, status: 'pending' }, { $set: { status: 'done' } }, { new: true });
    if (!t) throw new NotFoundException('Pending task not found');
    await this.audit.record({ userId, actor: 'user', action: 'followup.done', entityType: 'follow_up', entityId: id, result: 'success' });
    return t;
  }

  async cancel(userId: string, id: string, reason = 'Cancelled by you') {
    const t = await this.model.findOneAndUpdate({ _id: id, userId, status: 'pending' }, { $set: { status: 'cancelled', cancelReason: reason } }, { new: true });
    if (!t) throw new NotFoundException('Pending task not found');
    return t;
  }

  /** Called after a confirmed send. Skips if a pending follow-up already exists for the application. */
  async scheduleAfterSend(userId: string, applicationId: string, label: string, days = 5) {
    if (await this.model.exists({ userId, applicationId, kind: 'follow_up', status: 'pending' })) return null;
    const t = await this.model.create({ userId, applicationId, kind: 'follow_up', title: `Follow up: ${label}`, dueAt: addBusinessDays(new Date(), days), createdBy: 'system' });
    await this.audit.record({ userId, actor: 'workflow', action: 'followup.scheduled', entityType: 'follow_up', entityId: String(t._id), result: 'success', meta: { applicationId, days } });
    return t;
  }

  /** A reply arrived, so pending nudges for that application no longer make sense. */
  async cancelPendingForApplication(userId: string, applicationId: string, reason: string) {
    const pending = await this.model.find({ userId, applicationId, status: 'pending', kind: 'follow_up' }).select('_id').lean();
    if (!pending.length) return 0;
    await this.model.updateMany({ _id: { $in: pending.map((p) => p._id) } }, { $set: { status: 'cancelled', cancelReason: reason } });
    await this.audit.record({ userId, actor: 'workflow', action: 'followup.auto_cancelled', entityType: 'application', entityId: applicationId, result: 'success', detail: reason, meta: { count: pending.length } });
    return pending.length;
  }

  createFromReply(userId: string, applicationId: string, kind: 'interview' | 'deadline', title: string, dueAt: Date) {
    return this.model.create({ userId, applicationId, kind, title, dueAt, createdBy: 'system' });
  }
}
