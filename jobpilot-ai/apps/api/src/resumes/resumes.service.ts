import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { toBuffer } from '../domain/bytes';
import { AiSettingsService } from '../ai/ai-settings.service';
import { AI_PROVIDER, AiProvider } from '../ai/ai.provider';
import { AuditService } from '../audit/audit.service';
import { coverage, extractSkills, tailorSkillsLine } from '../domain/ats';
import { Job } from '../jobs/job.schema';
import { User } from '../users/user.schema';
import { Resume } from './resume.schema';

export const ResumeDto = z.object({
  title: z.string().trim().min(1).max(120),
  targetRole: z.string().trim().max(120).optional(),
  text: z.string().trim().min(80, 'Paste the full resume text (at least 80 characters)').max(60000),
});
export const ResumeUploadDto = z.object({
  title: z.string().trim().min(1).max(120),
  targetRole: z.string().trim().max(120).optional(),
  filename: z.string().trim().min(1).max(160),
  mime: z.enum(['application/pdf', 'text/plain']),
  base64: z.string().min(40),
});
const MAX_RESUME_BYTES = 4 * 1024 * 1024;
export const JobRefDto = z.object({ jobId: z.string().regex(/^[a-f0-9]{24}$/i) });
const LIMITS: Record<string, number> = { free: 3, pro: 25, premium_agent: 50, teams: 100 };

@Injectable()
export class ResumesService {
  constructor(
    @InjectModel(Resume.name) private readonly model: Model<Resume>,
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly audit: AuditService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly aiSettings: AiSettingsService,
  ) {}

  list(userId: string) { return this.model.find({ userId }).select('-text').sort({ createdAt: -1 }).lean(); }

  async get(userId: string, id: string) {
    const r = await this.model.findOne({ _id: id, userId }).lean();
    if (!r) throw new NotFoundException('Resume not found');
    return r;
  }

  async create(userId: string, dto: z.infer<typeof ResumeDto>) {
    const plan = (await this.users.findById(userId).lean())?.plan ?? 'free';
    const limit = LIMITS[plan] ?? 3;
    if ((await this.model.countDocuments({ userId })) >= limit) throw new ForbiddenException(`Your plan allows ${limit} resume versions`);
    const r = await this.model.create({ ...dto, userId, skills: extractSkills(dto.text) });
    await this.audit.record({ userId, actor: 'user', action: 'resume.created', entityType: 'resume', entityId: String(r._id), result: 'success' });
    return r;
  }

  /** Stores the original file (for attaching to applications) and reads its text so scoring and drafting can use it. */
  async upload(userId: string, dto: z.infer<typeof ResumeUploadDto>) {
    const bytes = Buffer.from(dto.base64, 'base64');
    if (bytes.length > MAX_RESUME_BYTES) throw new PayloadTooLargeException('Resume is larger than 4 MB');
    if (dto.mime === 'application/pdf' && bytes.subarray(0, 5).toString() !== '%PDF-') throw new BadRequestException('This file is not a valid PDF');
    const plan = (await this.users.findById(userId).lean())?.plan ?? 'free';
    const limit = LIMITS[plan] ?? 3;
    if ((await this.model.countDocuments({ userId })) >= limit) throw new ForbiddenException(`Your plan allows ${limit} resume versions`);
    const model = await this.aiSettings.modelFor(userId);
    let parsed: { text: string; skills: string[]; name?: string; yearsExperience?: number; titles: string[] };
    let readable = true;
    try {
      parsed = await this.ai.parseResume(
        dto.mime === 'application/pdf' ? { kind: 'pdf', base64: dto.base64 } : { kind: 'text', text: bytes.toString('utf8') }, { model });
    } catch (e) {
      // The file itself is what gets attached. If AI cannot read it right now (quota, no key), still keep the file.
      if (dto.mime !== 'application/pdf') throw e;
      readable = false;
      parsed = { text: `Resume file: ${dto.filename}. Its text could not be read automatically; emails will rely on your career profile.`, skills: [], titles: [] };
    }
    const text = parsed.text.trim();
    if (readable && text.length < 80) throw new BadRequestException('Not enough readable text in this file. Use a text-based PDF (not a scan).');
    const skills = [...new Set([...extractSkills(text), ...parsed.skills.map((s) => s.toLowerCase())])].slice(0, 80);
    const r = await this.model.create({
      userId, title: dto.title, targetRole: dto.targetRole, text: text.slice(0, 60000), skills,
      fileName: dto.filename.replace(/[^\w.\- ()]+/g, '_'), fileMime: dto.mime, fileSize: bytes.length, fileData: bytes,
    });
    await this.audit.record({ userId, actor: 'user', action: 'resume.uploaded', entityType: 'resume', entityId: String(r._id), result: 'success', meta: { bytes: bytes.length, mime: dto.mime } });
    const { fileData: _omit, ...safe } = r.toObject();
    return { ...safe, readable, hints: { name: parsed.name, yearsExperience: parsed.yearsExperience, titles: parsed.titles } };
  }

  /** The chosen resume, else the newest original. Text only (the file bytes are never loaded here). */
  async pick(userId: string, id?: string) {
    return id ? this.model.findOne({ _id: id, userId }).lean() : this.model.findOne({ userId, kind: 'original' }).sort({ createdAt: -1 }).lean();
  }

  hasFile(userId: string, id: string) { return this.model.exists({ _id: id, userId, fileSize: { $gt: 0 } }).then(Boolean); }

  /** The stored original, for attaching to an email. */
  async file(userId: string, id: string) {
    const r = await this.model.findOne({ _id: id, userId }).select('+fileData fileName fileMime').lean();
    if (!r?.fileData) return null;
    const data = toBuffer(r.fileData);
    const mime = r.fileMime ?? 'application/pdf';
    if (mime === 'application/pdf' && data.subarray(0, 5).toString() !== '%PDF-') return null; // never attach a damaged file
    return { filename: r.fileName ?? 'resume.pdf', mime, data };
  }

  async remove(userId: string, id: string) {
    const r = await this.model.deleteOne({ _id: id, userId });
    if (!r.deletedCount) throw new NotFoundException('Resume not found');
    return { deleted: true };
  }

  async analyze(userId: string, id: string, jobId: string) {
    const [resume, job] = await this.load(userId, id, jobId);
    return { job: { id: jobId, title: job.title, company: job.company }, ...coverage(resume.text, job.requiredSkills, job.preferredSkills) };
  }

  /** Creates a separate tailored copy. The original is never modified. */
  async tailor(userId: string, id: string, jobId: string) {
    const [resume, job] = await this.load(userId, id, jobId);
    const before = coverage(resume.text, job.requiredSkills, job.preferredSkills);
    const t = tailorSkillsLine(resume.text, job.requiredSkills, job.preferredSkills);
    if (!t.changed) {
      return { changed: false, message: resume.text.match(/^\s*skills\s*[:\-]/im) ? 'Your skills line already leads with the skills this job asks for.' : 'No "Skills:" line found, so there is nothing safe to reorder. Add one and try again.', coverageBefore: before };
    }
    const copy = await this.model.create({
      userId, title: `${resume.title} · ${job.company}`, targetRole: job.title, text: t.text, skills: resume.skills,
      kind: 'tailored', sourceResumeId: resume._id, jobId: job._id, version: (resume.version ?? 1) + 1,
    });
    await this.audit.record({ userId, actor: 'user', action: 'resume.tailored', entityType: 'resume', entityId: String(copy._id), result: 'success', meta: { sourceResumeId: id, jobId } });
    return { changed: true, resume: { _id: copy._id, title: copy.title }, diff: { before: t.before, after: t.after }, coverageBefore: before, coverageAfter: coverage(t.text, job.requiredSkills, job.preferredSkills) };
  }

  private async load(userId: string, id: string, jobId: string) {
    const [resume, job] = await Promise.all([this.model.findOne({ _id: id, userId }).lean(), this.jobs.findOne({ _id: jobId, userId }).lean()]);
    if (!resume) throw new NotFoundException('Resume not found');
    if (!job) throw new NotFoundException('Job not found');
    return [resume, job] as const;
  }
}
