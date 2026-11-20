import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { AI_PROVIDER, AiProvider } from '../ai/ai.provider';
import { Application } from '../applications/application.schema';
import { CareerProfile } from '../career-profiles/career-profile.schema';
import { env } from '../common/env';
import { Contact } from '../contacts/contact.schema';
import { FollowUp } from '../followups/followup.schema';
import { InboundMessage } from '../inbox/message.schema';
import { Job, JobMatch } from '../jobs/job.schema';
import { MailAccount } from '../mail/mail-account.schema';
import { OutreachCampaign, OutreachRecipient } from '../outreach/outreach.schema';
import { Resume } from '../resumes/resume.schema';

const DAY = 86_400_000;
const REPLIED = ['hr_replied', 'interview', 'assessment', 'offer', 'accepted', 'rejected'];
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const top = (rows: any[], n = 6) => rows.filter((r) => r._id).slice(0, n).map((r) => ({ label: String(r._id), value: r.n as number }));

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Application.name) private readonly apps: Model<Application>,
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
    @InjectModel(JobMatch.name) private readonly matches: Model<JobMatch>,
    @InjectModel(CareerProfile.name) private readonly profiles: Model<CareerProfile>,
    @InjectModel(FollowUp.name) private readonly followups: Model<FollowUp>,
    @InjectModel(Contact.name) private readonly contacts: Model<Contact>,
    @InjectModel(InboundMessage.name) private readonly inbound: Model<InboundMessage>,
    @InjectModel(OutreachCampaign.name) private readonly campaigns: Model<OutreachCampaign>,
    @InjectModel(OutreachRecipient.name) private readonly recs: Model<OutreachRecipient>,
    @InjectModel(Resume.name) private readonly resumes: Model<Resume>,
    @InjectModel(MailAccount.name) private readonly mailAccts: Model<MailAccount>,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  async build(userId: string) {
    const uid = new Types.ObjectId(userId);
    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const d7 = new Date(now - 7 * DAY); const d14 = new Date(now - 14 * DAY); const d30 = new Date(now - 30 * DAY);
    const group = (field: string, extra: any = {}): PipelineStage[] => [{ $match: { userId: uid, ...extra } }, { $group: { _id: field, n: { $sum: 1 } } }, { $sort: { n: -1 } }];
    const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

    const [
      jobsTotal, jobsToday, jobs7, shortlisted, jobsActive, bySource, byMode, byLoc, byCompany, topSkills, jobsPerDay,
      analyzed, suitable, scoreAgg, scoreBuckets,
      appsByStatus, sentTotal, sentToday, sent7, sent30, sentPerDay, replyDays, recentApps,
      campaignsByStatus, recByStatus, recToday, waAgg, recPerDay, lastCampaign,
      inboxTotal, inboxNew, inboxByCat, recentInbox,
      fuPending, fuOverdue, fuNext, fuByKind,
      contactsTotal, contactsVerified, contactsSuppressed,
      resumeCount, resumeFiles, profileList, mail,
    ] = await Promise.all([
      this.jobs.countDocuments({ userId }), this.jobs.countDocuments({ userId, createdAt: { $gte: startToday } }), this.jobs.countDocuments({ userId, createdAt: { $gte: d7 } }),
      this.jobs.countDocuments({ userId, shortlisted: true }), this.jobs.countDocuments({ userId, status: 'active' }),
      this.jobs.aggregate(group('$source')), this.jobs.aggregate(group('$workMode')), this.jobs.aggregate(group('$location')), this.jobs.aggregate(group('$company')),
      this.jobs.aggregate([{ $match: { userId: uid } }, { $unwind: '$requiredSkills' }, { $group: { _id: { $toLower: '$requiredSkills' }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 12 }]),
      this.jobs.aggregate([{ $match: { userId: uid, createdAt: { $gte: d14 } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } }]),
      this.matches.distinct('jobId', { userId }), this.matches.distinct('jobId', { userId, recommendation: { $ne: 'skip' } }),
      this.matches.aggregate([{ $match: { userId: uid } }, { $group: { _id: null, avg: { $avg: '$score' }, max: { $max: '$score' }, n: { $sum: 1 } } }]),
      this.matches.aggregate([{ $match: { userId: uid } }, { $group: { _id: { $min: [{ $floor: { $divide: ['$score', 20] } }, 4] }, n: { $sum: 1 } } }]),
      this.apps.aggregate(group('$status')), this.apps.countDocuments({ userId, sentAt: { $exists: true } }), this.apps.countDocuments({ userId, sentAt: { $gte: startToday } }),
      this.apps.countDocuments({ userId, sentAt: { $gte: d7 } }), this.apps.countDocuments({ userId, sentAt: { $gte: d30 } }),
      this.apps.aggregate([{ $match: { userId: uid, sentAt: { $gte: d14 } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } }, n: { $sum: 1 } } }]),
      this.apps.aggregate([{ $match: { userId: uid, status: { $in: REPLIED }, sentAt: { $exists: true } } }, { $group: { _id: null, ms: { $avg: { $subtract: ['$updatedAt', '$sentAt'] } }, n: { $sum: 1 } } }]),
      this.apps.find({ userId }).sort({ updatedAt: -1 }).limit(6).populate('jobId', 'company title').select('status matchScore sentAt updatedAt jobId recipient.email').lean(),
      this.campaigns.aggregate(group('$status')), this.recs.aggregate(group('$status')), this.recs.countDocuments({ userId, status: 'sent', sentAt: { $gte: startToday } }),
      this.recs.aggregate([{ $match: { userId: uid, waStatus: { $exists: true } } }, { $group: { _id: '$waStatus', n: { $sum: 1 } } }]),
      this.recs.aggregate([{ $match: { userId: uid, status: 'sent', sentAt: { $gte: d14 } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } }, n: { $sum: 1 } } }]),
      this.campaigns.findOne({ userId }).sort({ createdAt: -1 }).select('name status startedAt finishedAt createdAt').lean(),
      this.inbound.countDocuments({ userId }), this.inbound.countDocuments({ userId, state: 'new' }),
      this.inbound.aggregate([{ $match: { userId: uid } }, { $group: { _id: '$analysis.category', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
      this.inbound.find({ userId }).sort({ receivedAt: -1 }).limit(5).select('fromEmail subject receivedAt state analysis.category').lean(),
      this.followups.countDocuments({ userId, status: 'pending' }), this.followups.countDocuments({ userId, status: 'pending', dueAt: { $lt: new Date() } }),
      this.followups.find({ userId, status: 'pending' }).sort({ dueAt: 1 }).limit(5).select('title kind dueAt').lean(),
      this.followups.aggregate(group('$kind', { status: 'pending' })),
      this.contacts.countDocuments({ userId }), this.contacts.countDocuments({ userId, verification: 'verified' }), this.contacts.countDocuments({ userId, suppressed: true }),
      this.resumes.countDocuments({ userId }), this.resumes.countDocuments({ userId, fileSize: { $gt: 0 } }),
      this.profiles.find({ userId }).select('name targetTitles skills minMatchScore maxDailyApplications').lean(),
      safe(this.mailAccts.findOne({ userId, provider: 'gmail' }).select('email status lastSyncAt lastError').lean(), null as any),
    ]);

    const c: Record<string, number> = Object.fromEntries(appsByStatus.map((r: any) => [r._id, r.n]));
    const count = (...s: string[]) => s.reduce((a, k) => a + (c[k] ?? 0), 0);
    const replied = count(...REPLIED);
    const series = (rows: any[]) => { const m = new Map(rows.map((r: any) => [r._id, r.n])); return Array.from({ length: 14 }, (_, i) => { const k = dayKey(new Date(now - (13 - i) * DAY)); return { day: k, value: (m.get(k) as number) ?? 0 }; }); };
    const rc: Record<string, number> = Object.fromEntries(recByStatus.map((r: any) => [r._id, r.n]));
    const wa: Record<string, number> = Object.fromEntries(waAgg.map((r: any) => [r._id, r.n]));
    const bucketLabels = ['0-19', '20-39', '40-59', '60-79', '80-100'];
    const bk = new Map(scoreBuckets.map((r: any) => [Number(r._id), r.n]));
    const keys = this.ai.keyStatus?.() ?? [];
    const jobsSeries = series(jobsPerDay); const sentSeries = series(sentPerDay); const outSeries = series(recPerDay);

    return {
      generatedAt: new Date().toISOString(),
      jobs: { total: jobsTotal, today: jobsToday, last7: jobs7, active: jobsActive, shortlisted, analyzed: analyzed.length, suitable: suitable.length,
        avgScore: scoreAgg[0] ? Math.round(scoreAgg[0].avg) : null, bestScore: scoreAgg[0] ? Math.round(scoreAgg[0].max) : null,
        bySource: top(bySource), byWorkMode: top(byMode), topLocations: top(byLoc), topCompanies: top(byCompany), topSkills: top(topSkills, 12),
        scoreBuckets: bucketLabels.map((label, i) => ({ label, value: (bk.get(i) as number) ?? 0 })), perDay: jobsSeries },
      applications: { sent: sentTotal, today: sentToday, last7: sent7, last30: sent30, awaiting: count('applied'), replied, interviews: count('interview'), assessments: count('assessment'), offers: count('offer', 'accepted'), rejected: count('rejected'),
        drafts: count('draft', 'awaiting_approval', 'approved'), failed: count('send_failed', 'send_unknown'), responseRate: sentTotal ? Math.round((replied / sentTotal) * 100) : null,
        avgDaysToReply: replyDays[0] && replyDays[0].n ? Math.round((replyDays[0].ms / DAY) * 10) / 10 : null, byStatus: c, perDay: sentSeries,
        recent: recentApps.map((a: any) => ({ id: String(a._id), title: a.jobId?.title ?? '', company: a.jobId?.company ?? '', status: a.status, score: a.matchScore ?? null, at: a.updatedAt })) },
      outreach: { campaigns: Object.fromEntries(campaignsByStatus.map((r: any) => [r._id, r.n])), campaignsTotal: campaignsByStatus.reduce((a: number, r: any) => a + r.n, 0),
        emailsSent: rc.sent ?? 0, emailsFailed: rc.failed ?? 0, queued: (rc.queued ?? 0) + (rc.sending ?? 0), sentToday: recToday, dailyLimit: env.outreachDailyLimit,
        waSent: wa.sent ?? 0, waFailed: wa.failed ?? 0, perDay: outSeries, last: lastCampaign ? { name: (lastCampaign as any).name, status: (lastCampaign as any).status, at: (lastCampaign as any).createdAt } : null },
      inbox: { total: inboxTotal, unhandled: inboxNew, byCategory: top(inboxByCat, 8), recent: recentInbox.map((m: any) => ({ id: String(m._id), from: m.fromEmail ?? '', subject: m.subject, at: m.receivedAt, state: m.state, category: m.analysis?.category ?? null })) },
      followups: { pending: fuPending, overdue: fuOverdue, byKind: top(fuByKind), next: fuNext.map((f: any) => ({ id: String(f._id), title: f.title, kind: f.kind, dueAt: f.dueAt })) },
      contacts: { total: contactsTotal, verified: contactsVerified, suppressed: contactsSuppressed },
      library: { resumes: resumeCount, resumeFiles, profiles: profileList.map((p: any) => ({ id: String(p._id), name: p.name, titles: (p.targetTitles ?? []).slice(0, 3), skills: (p.skills ?? []).length, minScore: p.minMatchScore, maxDaily: p.maxDailyApplications })) },
      system: { ai: { provider: this.ai.name, model: env.geminiDefaultModel, keys: keys.map((k) => ({ label: k.label, tail: k.tail, state: k.state, retryInSec: k.retryInSec })) },
        gmail: mail ? { email: mail.email, status: mail.status, lastSyncAt: mail.lastSyncAt ?? null, error: mail.lastError ?? null } : null,
        whatsapp: { configured: env.waConfigured, mode: env.waGatewayOn ? 'gateway' : env.waConfigured ? 'cloud' : 'off', channel: env.waGatewayOn ? env.waChannel || null : null }, mailMode: env.mailProvider },
      funnel: [
        { stage: 'Discovered', count: jobsTotal }, { stage: 'Analyzed', count: analyzed.length }, { stage: 'Shortlisted', count: shortlisted },
        { stage: 'Drafted', count: count('draft', 'awaiting_approval', 'approved', 'sending', 'send_failed', 'send_unknown') + sentTotal }, { stage: 'Applied', count: sentTotal },
        { stage: 'HR replied', count: replied }, { stage: 'Interview', count: count('interview') }, { stage: 'Offer', count: count('offer', 'accepted') },
      ],
    };
  }
}
