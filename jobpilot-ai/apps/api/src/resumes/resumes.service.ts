import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
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
export const JobRefDto = z.object({ jobId: z.string().regex(/^[a-f0-9]{24}$/i) });
const LIMITS: Record<string, number> = { free: 3, pro: 25, premium_agent: 50, teams: 100 };

@Injectable()
export class ResumesService {
  constructor(
    @InjectModel(Resume.name) private readonly model: Model<Resume>,
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly audit: AuditService,
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
