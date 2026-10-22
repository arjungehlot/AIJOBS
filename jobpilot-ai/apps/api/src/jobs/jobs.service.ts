import { BadGatewayException, BadRequestException, Inject, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { AiSettingsService } from '../ai/ai-settings.service';
import { AI_PROVIDER, AiProvider } from '../ai/ai.provider';
import { missingFields } from '../ai/extraction.schema';
import { AuditService } from '../audit/audit.service';
import { CareerProfile } from '../career-profiles/career-profile.schema';
import { dedupeKey } from '../domain/dedupe';
import { scoreMatch } from '../domain/scoring';
import { Job, JobMatch } from './job.schema';

const list = z.array(z.string().trim().min(1).max(100)).max(60).default([]);
export const CreateJobDto = z.object({
  company: z.string().trim().min(1).max(200), title: z.string().trim().min(1).max(200),
  description: z.string().max(20000).optional(), location: z.string().max(200).optional(),
  workMode: z.enum(['remote', 'hybrid', 'onsite']).optional(), employmentType: z.string().max(50).optional(),
  requiredSkills: list, preferredSkills: list,
  experienceMin: z.number().min(0).optional(), experienceMax: z.number().min(0).optional(),
  salaryMin: z.number().min(0).optional(), salaryMax: z.number().min(0).optional(), currency: z.string().length(3).optional(),
  applicationUrl: z.string().url().optional(), applicationEmail: z.string().email().optional(),
  source: z.string().max(50).default('manual'), providerJobId: z.string().max(100).optional(),
});
export const AnalyzeTextDto = z.object({ text: z.string().trim().min(40).max(30000) });
export const AnalyzeImageDto = z.object({
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  base64: z.string().min(100),
});
export const MatchDto = z.object({ careerProfileId: z.string().regex(/^[a-f0-9]{24}$/i) });
export const ListJobsQuery = z.object({
  q: z.string().max(100).optional(), shortlisted: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25),
});

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8,
  'image/webp': (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
};

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
    @InjectModel(JobMatch.name) private readonly matches: Model<JobMatch>,
    @InjectModel(CareerProfile.name) private readonly profiles: Model<CareerProfile>,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly audit: AuditService,
    private readonly aiSettings: AiSettingsService,
  ) {}

  async analyzeText(userId: string, dto: z.infer<typeof AnalyzeTextDto>) {
    return this.extract(userId, { kind: 'text', text: dto.text });
  }

  async analyzeImage(userId: string, dto: z.infer<typeof AnalyzeImageDto>) {
    const bytes = Buffer.from(dto.base64, 'base64');
    if (bytes.length > MAX_IMAGE_BYTES) throw new PayloadTooLargeException('Image is larger than 8 MB');
    if (!MAGIC[dto.mime](bytes)) throw new BadRequestException('File content does not match its type');
    return this.extract(userId, { kind: 'image', mime: dto.mime, base64: dto.base64 });
  }

  private async extract(userId: string, input: Parameters<AiProvider['extractJob']>[0]) {
    try {
      const job = await this.ai.extractJob(input, { model: await this.aiSettings.modelFor(userId) });
      // Nothing is saved here. The user reviews and confirms via POST /jobs.
      return { job, missingFields: missingFields(job), provider: this.ai.name };
    } catch (e: any) {
      if (e?.getStatus) throw e;
      throw new BadGatewayException('Could not extract job details. Try pasting the text instead.');
    }
  }

  /** Creates the job, or refreshes lastSeenAt if the same listing already exists. */
  async create(userId: string, dto: z.infer<typeof CreateJobDto>) {
    const key = dedupeKey(dto);
    const now = new Date();
    const { source, ...rest } = dto;
    const res = await this.jobs.findOneAndUpdate(
      { userId, dedupeKey: key },
      { $set: { lastSeenAt: now }, $setOnInsert: { ...rest, source, firstSeenAt: now } },
      { upsert: true, new: true, includeResultMetadata: true },
    );
    const created = !(res as any).lastErrorObject?.updatedExisting;
    const job = (res as any).value;
    if (created) await this.audit.record({ userId, actor: 'user', action: 'job.created', entityType: 'job', entityId: String(job._id), result: 'success', meta: { source } });
    return { job, created };
  }

  async list(userId: string, q: z.infer<typeof ListJobsQuery>) {
    const filter: Record<string, unknown> = { userId };
    if (q.shortlisted) filter.shortlisted = q.shortlisted === 'true';
    if (q.q) {
      const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ company: rx }, { title: rx }];
    }
    const [items, total] = await Promise.all([
      this.jobs.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      this.jobs.countDocuments(filter),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  }

  async get(userId: string, id: string) {
    const j = await this.jobs.findOne({ _id: id, userId }).lean();
    if (!j) throw new NotFoundException('Job not found');
    return j;
  }

  async setShortlist(userId: string, id: string, shortlisted: boolean) {
    const j = await this.jobs.findOneAndUpdate({ _id: id, userId }, { $set: { shortlisted } }, { new: true }).lean();
    if (!j) throw new NotFoundException('Job not found');
    await this.audit.record({ userId, actor: 'user', action: shortlisted ? 'job.shortlisted' : 'job.unshortlisted', entityType: 'job', entityId: id, result: 'success' });
    return j;
  }

  async match(userId: string, jobId: string, dto: z.infer<typeof MatchDto>) {
    const [job, profile] = await Promise.all([
      this.jobs.findOne({ _id: jobId, userId }).lean(),
      this.profiles.findOne({ _id: dto.careerProfileId, userId }).lean(),
    ]);
    if (!job) throw new NotFoundException('Job not found');
    if (!profile) throw new NotFoundException('Career profile not found');
    const report = scoreMatch(profile, job);
    const saved = await this.matches.create({
      userId, jobId, careerProfileId: profile._id, score: report.score, recommendation: report.recommendation, report: report as any,
    });
    await this.audit.record({ userId, actor: 'user', action: 'job.matched', entityType: 'job', entityId: jobId, result: 'success', meta: { score: report.score, matchId: String(saved._id) } });
    return { matchId: String(saved._id), ...report };
  }
}
