import {
  BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { z } from 'zod';
import { AiSettingsService } from '../ai/ai-settings.service';
import { AI_PROVIDER, AiProvider } from '../ai/ai.provider';
import { AuditService } from '../audit/audit.service';
import { ResumesService } from '../resumes/resumes.service';
import { scoreMatch } from '../domain/scoring';
import { CareerProfile } from '../career-profiles/career-profile.schema';
import { AppStatus, assertTransition } from '../domain/application-state';
import { FollowUpsService } from '../followups/followups.service';
import { Job, JobMatch } from '../jobs/job.schema';
import { MAIL_PROVIDER, MailOutcomeUnknownError, MailProvider, MailRejectedError } from '../mail/mail.provider';
import { User } from '../users/user.schema';
import { Application } from './application.schema';

export const DraftDto = z.object({
  jobId: z.string().regex(/^[a-f0-9]{24}$/i),
  careerProfileId: z.string().regex(/^[a-f0-9]{24}$/i),
  recipientEmail: z.string().email(),
  recipientConfidence: z.enum(['verified', 'source_reported', 'inferred', 'unverified']),
  recipientName: z.string().max(120).optional(),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(10000),
  matchScore: z.number().min(0).max(100).optional(),
  resumeId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
});
export const AiDraftDto = z.object({
  jobId: z.string().regex(/^[a-f0-9]{24}$/i),
  careerProfileId: z.string().regex(/^[a-f0-9]{24}$/i),
  resumeId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  tone: z.enum(['professional', 'concise', 'friendly', 'technical']).default('professional'),
});
export const ApproveDto = z.object({ confirmRecipient: z.boolean().default(false) });
export const StatusDto = z.object({ status: z.string() });
export const ListQuery = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25),
});

const TRUSTED = ['verified', 'source_reported'];
const REPLIED = ['hr_replied', 'interview', 'assessment', 'offer', 'accepted', 'rejected'];

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectModel(Application.name) private readonly apps: Model<Application>,
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
    @InjectModel(JobMatch.name) private readonly matches: Model<JobMatch>,
    @InjectModel(CareerProfile.name) private readonly profiles: Model<CareerProfile>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
    private readonly audit: AuditService,
    private readonly followups: FollowUpsService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly aiSettings: AiSettingsService,
    private readonly resumes: ResumesService,
  ) {}

  /**
   * Writes an application email from the candidate's own facts (profile + resume). Nothing is saved or sent.
   * The AI only phrases; recipient, score and attachment come from stored data.
   */
  async compose(userId: string, dto: z.infer<typeof AiDraftDto>) {
    const [job, profile, user] = await Promise.all([
      this.jobs.findOne({ _id: dto.jobId, userId }).lean(),
      this.profiles.findOne({ _id: dto.careerProfileId, userId }).lean(),
      this.users.findById(userId).lean(),
    ]);
    if (!job) throw new NotFoundException('Job not found');
    if (!profile) throw new NotFoundException('Career profile not found');
    const resume = await this.resumes.pick(userId, dto.resumeId);
    const report = scoreMatch(profile, job);
    const attached = resume ? await this.resumes.hasFile(userId, String(resume._id)) : false;
    const draft = await this.ai.draftEmail({
      candidateName: user?.name ?? profile.name, jobTitle: job.title, company: job.company, tone: dto.tone,
      matchedSkills: [...report.matchedRequired, ...report.matchedPreferred], missingRequiredSkills: report.missingRequired,
      yearsExperience: profile.yearsExperience, resumeAttached: attached,
      resumeFacts: resume?.text?.slice(0, 3500), jobExcerpt: job.description?.slice(0, 1500),
    }, { model: await this.aiSettings.modelFor(userId) });
    return {
      subject: draft.subject, body: draft.body, score: report.score, recommendation: report.recommendation,
      recipient: job.applicationEmail ? { email: job.applicationEmail, confidence: 'source_reported' as const } : null,
      applicationUrl: job.applicationUrl ?? null, resumeId: resume ? String(resume._id) : null, resumeAttached: attached, provider: this.ai.name,
    };
  }

  async createDraft(userId: string, dto: z.infer<typeof DraftDto>) {
    const [job, profile] = await Promise.all([
      this.jobs.findOne({ _id: dto.jobId, userId }).lean(),
      this.profiles.findOne({ _id: dto.careerProfileId, userId }).lean(),
    ]);
    if (!job) throw new NotFoundException('Job not found');
    if (!profile) throw new NotFoundException('Career profile not found');
    if (job.status !== 'active') throw new BadRequestException(`Job is ${job.status}`);
    try {
      const app = await this.apps.create({
        userId, jobId: job._id, careerProfileId: profile._id, subject: dto.subject, body: dto.body,
        matchScore: dto.matchScore, resumeId: dto.resumeId, status: 'draft',
        recipient: { email: dto.recipientEmail, confidence: dto.recipientConfidence, name: dto.recipientName, confirmedByUser: false },
      });
      await this.audit.record({ userId, actor: 'user', action: 'application.drafted', entityType: 'application', entityId: String(app._id), result: 'success' });
      return app;
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('You already have an application for this job');
      throw e;
    }
  }

  /** Moves a draft to approved. Untrusted recipients need explicit confirmation. */
  async approve(userId: string, id: string, dto: z.infer<typeof ApproveDto>) {
    const app = await this.own(userId, id);
    const trusted = TRUSTED.includes(app.recipient.confidence);
    if (!trusted && !dto.confirmRecipient) {
      await this.audit.record({ userId, actor: 'user', action: 'application.approve', entityType: 'application', entityId: id, result: 'blocked', detail: 'Recipient not verified and not confirmed' });
      throw new ForbiddenException('This recipient is not verified. Confirm the address to approve.');
    }
    // draft -> awaiting_approval -> approved, as two checked steps
    if (app.status === 'draft') await this.move(app, 'awaiting_approval', 'user');
    await this.move(app, 'approved', 'user');
    if (!trusted) app.recipient.confirmedByUser = true;
    await app.save();
    await this.audit.record({ userId, actor: 'user', action: 'application.approved', entityType: 'application', entityId: id, result: 'success', meta: { confirmedUntrusted: !trusted } });
    return app;
  }

  /**
   * The send gate. Every check runs on the server against current state.
   * The atomic approved -> sending claim means two concurrent calls cannot both send.
   */
  async send(userId: string, id: string) {
    const app = await this.own(userId, id);
    const [user, profile, job] = await Promise.all([
      this.users.findById(userId).lean(),
      this.profiles.findById(app.careerProfileId).lean(),
      this.jobs.findById(app.jobId).lean(),
    ]);
    if (!user || !profile || !job) throw new NotFoundException('Related record missing');

    const block = async (reason: string): Promise<never> => {
      await this.audit.record({ userId, actor: 'user', action: 'application.send', entityType: 'application', entityId: id, result: 'blocked', detail: reason });
      throw new ForbiddenException(reason);
    };
    if (app.status !== 'approved') return block(`Application is "${app.status}", not approved`);
    if (job.status !== 'active') return block(`Job is ${job.status}`);
    if (!TRUSTED.includes(app.recipient.confidence) && !app.recipient.confirmedByUser) return block('Recipient is not verified or confirmed');
    const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
    const sentToday = await this.apps.countDocuments({ userId, sentAt: { $gte: startOfDay } });
    if (sentToday >= profile.maxDailyApplications) return block(`Daily limit of ${profile.maxDailyApplications} reached`);

    // Atomic claim. Only one caller moves approved -> sending.
    const claimed = await this.apps.findOneAndUpdate(
      { _id: id, userId, status: 'approved' },
      { $set: { status: 'sending' }, $inc: { sendAttempts: 1 } },
      { new: true },
    );
    if (!claimed) return block('Another send is already in progress');

    const key = idempotencyKey(userId, id);
    try {
      const file = app.resumeId ? await this.resumes.file(userId, String(app.resumeId)) : null;
      const sent = await this.mail.send({ userId, idempotencyKey: key, from: user.email, to: app.recipient.email, subject: app.subject, body: app.body, attachments: file ? [file] : undefined });
      return this.markSent(userId, id, sent, 'user');
    } catch (e) {
      if (e instanceof MailOutcomeUnknownError) {
        await this.apps.updateOne({ _id: id }, { $set: { status: 'send_unknown', lastError: e.message } });
        await this.audit.record({ userId, actor: 'integration', action: 'application.send', entityType: 'application', entityId: id, result: 'failure', detail: 'Outcome unknown; reconcile before retrying' });
        return { id, status: 'send_unknown' as const, message: 'We could not confirm delivery. Run reconcile before retrying.' };
      }
      const msg = e instanceof MailRejectedError ? e.message : 'Unexpected mail error';
      await this.apps.updateOne({ _id: id }, { $set: { status: 'send_failed', lastError: msg } });
      await this.audit.record({ userId, actor: 'integration', action: 'application.send', entityType: 'application', entityId: id, result: 'failure', detail: msg });
      return { id, status: 'send_failed' as const, message: msg };
    }
  }

  /** Resolves send_unknown by asking the provider. Never re-sends blindly. */
  async reconcile(userId: string, id: string) {
    const app = await this.own(userId, id);
    if (app.status !== 'send_unknown') throw new BadRequestException('Nothing to reconcile');
    const found = await this.mail.findSent(idempotencyKey(userId, id), userId);
    if (found) return this.markSent(userId, id, found, 'integration');
    await this.apps.updateOne({ _id: id }, { $set: { status: 'send_failed', lastError: 'Provider has no record of this message' } });
    await this.audit.record({ userId, actor: 'integration', action: 'application.reconciled', entityType: 'application', entityId: id, result: 'success', detail: 'Not found at provider; safe to retry' });
    return { id, status: 'send_failed' as const, message: 'Not sent. You can approve and send again.' };
  }

  async setStatus(userId: string, id: string, status: string) {
    const app = await this.own(userId, id);
    await this.move(app, status as AppStatus, 'user');
    await app.save();
    await this.audit.record({ userId, actor: 'user', action: 'application.status_changed', entityType: 'application', entityId: id, result: 'success', meta: { to: status } });
    return app;
  }

  async list(userId: string, q: z.infer<typeof ListQuery>) {
    const filter: Record<string, unknown> = { userId };
    if (q.status) filter.status = q.status;
    const [items, total] = await Promise.all([
      this.apps.find(filter).sort({ updatedAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate('jobId', 'company title location').lean(),
      this.apps.countDocuments(filter),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  }

  async get(userId: string, id: string) { return (await this.own(userId, id)).toObject(); }

  activity(userId: string, id: string) { return this.audit.timeline(userId, 'application', id); }

  /** Dashboard numbers come straight from stored records. */
  async overview(userId: string) {
    const uid = new Types.ObjectId(userId);
    const [jobs, shortlisted, byStatus, analyzed, suitable, sent] = await Promise.all([
      this.jobs.countDocuments({ userId }),
      this.jobs.countDocuments({ userId, shortlisted: true }),
      this.apps.aggregate([{ $match: { userId: uid } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      this.matches.distinct('jobId', { userId }),
      this.matches.distinct('jobId', { userId, recommendation: { $ne: 'skip' } }),
      this.apps.countDocuments({ userId, sentAt: { $exists: true } }),
    ]);
    const c: Record<string, number> = Object.fromEntries(byStatus.map((r: any) => [r._id, r.n]));
    const count = (...s: string[]) => s.reduce((a, k) => a + (c[k] ?? 0), 0);
    const replied = count(...REPLIED);
    const notSent = count('draft', 'awaiting_approval', 'approved', 'sending', 'send_failed', 'send_unknown');
    return {
      kpis: {
        jobsDiscovered: jobs, jobsAnalyzed: analyzed.length, suitableJobs: suitable.length, shortlisted,
        applicationsSent: sent, awaitingResponse: count('applied'),
        hrReplies: replied, interviews: count('interview'), offers: count('offer', 'accepted'),
        // null (not 0) when nothing has been sent, so the UI shows "no data yet".
        responseRate: sent ? Math.round((replied / sent) * 100) : null,
      },
      funnel: [
        { stage: 'Discovered', count: jobs }, { stage: 'Analyzed', count: analyzed.length }, { stage: 'Shortlisted', count: shortlisted },
        { stage: 'Drafted', count: notSent + sent }, { stage: 'Applied', count: sent }, { stage: 'HR replied', count: replied },
        { stage: 'Interview', count: count('interview') }, { stage: 'Offer', count: count('offer', 'accepted') },
      ],
      byStatus: c,
    };
  }

  /** Real time series for the dashboard charts. Days with no activity are returned as 0. */
  async trends(userId: string, days = 14) {
    const uid = new Types.ObjectId(userId);
    const since = new Date(); since.setUTCHours(0, 0, 0, 0); since.setUTCDate(since.getUTCDate() - (days - 1));
    const perDay = (field: string) => [
      { $match: { userId: uid, [field]: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}` } }, n: { $sum: 1 } } },
    ];
    const [sentRows, foundRows, buckets] = await Promise.all([
      this.apps.aggregate(perDay('sentAt')),
      this.jobs.aggregate(perDay('createdAt')),
      this.matches.aggregate([
        { $match: { userId: uid } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$jobId', score: { $first: '$score' } } }, // latest score per job
        { $bucket: { groupBy: '$score', boundaries: [0, 40, 55, 70, 85, 101], default: 'other', output: { count: { $sum: 1 } } } },
      ]),
    ]);
    const list = Array.from({ length: days }, (_, i) => {
      const d = new Date(since); d.setUTCDate(since.getUTCDate() + i); return d.toISOString().slice(0, 10);
    });
    const pick = (rows: any[]) => { const m = new Map(rows.map((r) => [r._id, r.n])); return list.map((d) => m.get(d) ?? 0); };
    const labels = ['0–39', '40–54', '55–69', '70–84', '85+'];
    const bounds = [0, 40, 55, 70, 85];
    return {
      days: list, sent: pick(sentRows), discovered: pick(foundRows),
      scoreBuckets: labels.map((label, i) => ({ label, count: buckets.find((b: any) => b._id === bounds[i])?.count ?? 0 })),
    };
  }

  // -- helpers --
  private async own(userId: string, id: string) {
    const a = await this.apps.findOne({ _id: id, userId });
    if (!a) throw new NotFoundException('Application not found');
    return a;
  }

  private async move(app: any, to: AppStatus, actor: 'user' | 'system') {
    try { assertTransition(app.status as AppStatus, to, actor); }
    catch (e: any) { throw new BadRequestException(e.message); }
    app.status = to;
  }

  private async markSent(userId: string, id: string, sent: { messageId: string; threadId?: string }, actor: 'user' | 'integration') {
    const app = await this.apps.findOneAndUpdate(
      { _id: id, userId, status: { $in: ['sending', 'send_unknown'] } },
      { $set: { status: 'applied', sentAt: new Date(), providerMessageId: sent.messageId, providerThreadId: sent.threadId }, $unset: { lastError: '' } },
      { new: true },
    );
    if (!app) throw new ConflictException('Application changed while sending');
    await this.audit.record({ userId, actor, action: 'application.sent', entityType: 'application', entityId: id, result: 'success', meta: { messageId: sent.messageId, threadId: sent.threadId } });
    // Reminder is best-effort: a failure here must never undo a send that already happened.
    try {
      const job = await this.jobs.findById(app.jobId).select('company title').lean();
      await this.followups.scheduleAfterSend(userId, id, job ? `${job.title} at ${job.company}` : 'application');
    } catch { /* ignored on purpose */ }
    return app;
  }
}

export function idempotencyKey(userId: string, applicationId: string): string {
  return createHash('sha256').update(`${userId}:${applicationId}`).digest('hex').slice(0, 40);
}
