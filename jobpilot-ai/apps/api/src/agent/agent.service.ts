import { BadRequestException, Injectable } from '@nestjs/common';
import { env } from '../common/env';
import { ApplicationsService, AiDraftDto } from '../applications/applications.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { z } from 'zod';
import { Application } from '../applications/application.schema';
import { AuditService } from '../audit/audit.service';
import { CareerProfile } from '../career-profiles/career-profile.schema';
import { decide, JobContext } from '../domain/policy';
import { scoreMatch } from '../domain/scoring';
import { Job } from '../jobs/job.schema';
import { Resume } from '../resumes/resume.schema';
import { AgentConfig, AgentRun } from './agent.schema';

const oid = z.string().regex(/^[a-f0-9]{24}$/i);
export const AgentConfigDto = z.object({
  mode: z.enum(['manual', 'copilot', 'autonomous']),
  minScore: z.number().int().min(0).max(100),
  autoSendMinScore: z.number().int().min(0).max(100),
  maxPerDay: z.number().int().min(0).max(50),
  maxPerCompany30d: z.number().int().min(0).max(10),
  autoSendEnabled: z.boolean(),
  windowStartHour: z.number().int().min(0).max(23),
  windowEndHour: z.number().int().min(0).max(24),
  careerProfileId: oid.nullable().optional(),
  resumeId: oid.nullable().optional(),
  autoRun: z.boolean(),
  autoRunEveryMin: z.number().int().min(15).max(1440),
  tone: z.enum(['professional', 'concise', 'friendly', 'technical']),
}).partial();
export const RunDto = z.object({ dryRun: z.boolean().default(true), discover: z.boolean().default(false) });
const MAX_AI_DRAFTS_PER_RUN = 10;

@Injectable()
export class AgentService {
  constructor(
    @InjectModel(AgentConfig.name) private readonly cfg: Model<AgentConfig>,
    @InjectModel(AgentRun.name) private readonly runs: Model<AgentRun>,
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
    @InjectModel(Application.name) private readonly apps: Model<Application>,
    @InjectModel(CareerProfile.name) private readonly profiles: Model<CareerProfile>,
    @InjectModel(Resume.name) private readonly resumes: Model<Resume>,
    private readonly audit: AuditService,
    private readonly applications: ApplicationsService,
    private readonly discovery: DiscoveryService,
  ) {}

  async getConfig(userId: string) {
    return (await this.cfg.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, new: true }).lean())!;
  }

  async update(userId: string, dto: z.infer<typeof AgentConfigDto>) {
    const set: Record<string, unknown> = { ...dto };
    const unset: Record<string, ''> = {};
    for (const k of ['careerProfileId', 'resumeId'] as const) if (dto[k] === null) { delete set[k]; unset[k] = ''; }
    const c = await this.cfg.findOneAndUpdate({ userId }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { upsert: true, new: true }).lean();
    await this.audit.record({ userId, actor: 'user', action: 'agent.config_changed', entityType: 'agent', entityId: userId, result: 'success', meta: dto as any });
    return c;
  }

  async setPaused(userId: string, paused: boolean) {
    const c = await this.cfg.findOneAndUpdate({ userId }, { $set: { paused } }, { upsert: true, new: true }).lean();
    await this.audit.record({ userId, actor: 'user', action: paused ? 'agent.paused' : 'agent.resumed', entityType: 'agent', entityId: userId, result: 'success' });
    return c;
  }

  /** Emergency stop: pause and drop to manual, so nothing can be prepared or sent. */
  async stop(userId: string) {
    const c = await this.cfg.findOneAndUpdate({ userId }, { $set: { paused: true, mode: 'manual', autoSendEnabled: false } }, { upsert: true, new: true }).lean();
    await this.audit.record({ userId, actor: 'user', action: 'agent.emergency_stop', entityType: 'agent', entityId: userId, result: 'success' });
    return c;
  }

  runsList(userId: string) { return this.runs.find({ userId }).sort({ createdAt: -1 }).limit(20).lean(); }

  /**
   * 1) (optional) finds fresh openings, 2) scores every active, un-applied job, 3) prepares what the policy allows.
   *  - copilot: AI-written drafts that wait for your approval.
   *  - autonomous: sends by itself ONLY when every auto-send rule passes, MAIL_PROVIDER=gmail, and the normal send gate agrees.
   * Anything else becomes a draft or is held with a reason. Dry runs change nothing.
   */
  async run(userId: string, dryRun: boolean, opts: { discover?: boolean; actor?: 'user' | 'agent' } = {}) {
    const c = await this.getConfig(userId);
    const profile = await this.profiles.findOne(c.careerProfileId ? { _id: c.careerProfileId, userId } : { userId }).sort({ createdAt: 1 }).lean();
    if (!profile) throw new BadRequestException('Create a career profile first');
    const resume = c.resumeId ? await this.resumes.findOne({ _id: c.resumeId, userId }).lean() : await this.resumes.findOne({ userId }).sort({ createdAt: -1 }).lean();

    let discovery: Record<string, unknown> | undefined;
    if (opts.discover && !dryRun && !c.paused && c.mode !== 'manual') {
      try {
        const d = await this.discovery.search(userId, { careerProfileId: String(profile._id), limit: 30, enrich: true } as any, 'agent');
        discovery = { scanned: d.scanned, relevant: d.relevant, newJobs: d.items.filter((i) => i.isNew).length, aiNote: d.aiNote };
      } catch (e: any) { discovery = { error: String(e?.message ?? 'Discovery failed').slice(0, 200) }; }
    }

    const uid = new Types.ObjectId(userId);
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const since30 = new Date(now.getTime() - 30 * 86_400_000);

    const [jobs, existing, sentTodayN, sent30] = await Promise.all([
      this.jobs.find({ userId, status: 'active' }).sort({ createdAt: -1 }).limit(100).lean(),
      this.apps.find({ userId }).select('jobId').lean(),
      this.apps.countDocuments({ userId, sentAt: { $gte: dayStart } }),
      this.apps.aggregate([{ $match: { userId: uid, sentAt: { $gte: since30 } } }, { $lookup: { from: 'jobs', localField: 'jobId', foreignField: '_id', as: 'j' } }, { $unwind: '$j' }, { $group: { _id: { $toLower: '$j.company' }, n: { $sum: 1 } } }]),
    ]);
    let sentToday = sentTodayN;
    const applied = new Set(existing.map((a) => String(a.jobId)));
    const perCompany = new Map<string, number>(sent30.map((r: any) => [r._id, r.n]));
    const canReallySend = env.mailProvider === 'gmail';

    const decisions: Record<string, any>[] = [];
    let drafted = 0, sent = 0, aiDrafts = 0;
    for (const job of jobs) {
      const report = scoreMatch(profile as any, job as any);
      const email = job.applicationEmail;
      const company = job.company.toLowerCase();
      const ctx: JobContext = {
        score: report.score, recommendation: report.recommendation as any, mandatoryFailures: report.mandatoryFailures ?? [],
        alreadyApplied: applied.has(String(job._id)), sentToday, sentToCompany30d: perCompany.get(company) ?? 0,
        recipient: email ? { email, confidence: 'source_reported' } : undefined,
        hasResume: !!resume, hourNow: now.getHours(), jobActive: job.status === 'active',
      };
      const d = decide(c as any, ctx);
      let outcome = d.action as string;
      const reasons = [...d.reasons];
      if (!dryRun && (d.action === 'draft' || d.action === 'auto_send') && email) {
        try {
          let subject = `Application for ${job.title}`;
          let body = `Hello,\n\nI would like to apply for the ${job.title} role at ${job.company}. Please find my details attached.\n\nRegards`;
          if (aiDrafts < MAX_AI_DRAFTS_PER_RUN) {
            try {
              const x = await this.applications.compose(userId, AiDraftDto.parse({ jobId: String(job._id), careerProfileId: String(profile._id), resumeId: resume ? String(resume._id) : undefined, tone: c.tone ?? 'professional' }));
              subject = x.subject; body = x.body; aiDrafts++;
            } catch (e: any) { reasons.push(`AI draft unavailable, used a plain template: ${String(e?.message ?? '').slice(0, 120)}`); }
          }
          const app = await this.apps.create({
            userId, jobId: job._id, careerProfileId: profile._id, status: 'draft', matchScore: report.score, subject, body, resumeId: resume?._id,
            recipient: { email, confidence: 'source_reported', confirmedByUser: false },
          });
          applied.add(String(job._id)); drafted++; outcome = 'drafted';
          await this.audit.record({ userId, actor: 'agent', action: 'agent.draft_created', entityType: 'job', entityId: String(job._id), result: 'success', meta: { score: report.score } });

          if (d.action === 'auto_send') {
            if (!canReallySend) { reasons.push('MAIL_PROVIDER is not "gmail", so nothing is sent for real. Left as a draft.'); }
            else {
              // Same gate a human click goes through: approve (trusted recipient only), then the atomic send claim.
              await this.applications.approve(userId, String(app._id), { confirmRecipient: false });
              const r: any = await this.applications.send(userId, String(app._id));
              if (r?.status === 'applied') {
                sent++; sentToday++; perCompany.set(company, (perCompany.get(company) ?? 0) + 1); outcome = 'sent';
                await this.audit.record({ userId, actor: 'agent', action: 'agent.auto_sent', entityType: 'application', entityId: String(app._id), result: 'success', meta: { score: report.score, company: job.company } });
              } else { outcome = String(r?.status ?? 'hold'); reasons.push(String(r?.message ?? 'Send did not complete')); }
            }
          }
        } catch (e: any) {
          outcome = e?.code === 11000 ? 'skip' : 'hold';
          if (e?.message) reasons.push(String(e.message).slice(0, 160));
        }
      }
      decisions.push({ jobId: job._id, company: job.company, title: job.title, score: report.score, action: d.action, outcome, reasons });
    }
    const summary: Record<string, number> = {};
    decisions.forEach((x) => { summary[x.outcome] = (summary[x.outcome] ?? 0) + 1; });
    const run = await this.runs.create({ userId, kind: dryRun ? 'dry_run' : 'live', mode: c.mode, decisions, summary });
    await this.audit.record({ userId, actor: 'agent', action: dryRun ? 'agent.dry_run' : 'agent.run', entityType: 'agent', entityId: String(run._id), result: 'success', meta: { ...summary, drafted, sent, aiDrafts, auto: opts.actor === 'agent' } });
    return { ...run.toObject(), discovery };
  }
}
