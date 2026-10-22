import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { Application } from '../applications/application.schema';
import { Job } from '../jobs/job.schema';
import { Contact } from './contact.schema';

// Confidence is derived from how the address is known. It is never a free-form number.
export const CONFIDENCE: Record<string, number> = { verified: 95, source_reported: 75, inferred: 40, unverified: 10 };

export const ContactDto = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().optional(),
  title: z.string().trim().max(120).optional(),
  company: z.string().trim().min(1).max(200),
  source: z.enum(['manual', 'job_post', 'public_site', 'import']).default('manual'),
  verification: z.enum(['verified', 'source_reported', 'inferred', 'unverified']).default('unverified'),
  linkedinUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});
export const ContactPatchDto = ContactDto.partial();
export const SuppressDto = z.object({ suppressed: z.boolean() });
export const ContactQuery = z.object({ company: z.string().max(200).optional(), q: z.string().max(100).optional() });

@Injectable()
export class ContactsService {
  constructor(
    @InjectModel(Contact.name) private readonly model: Model<Contact>,
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
    @InjectModel(Application.name) private readonly apps: Model<Application>,
    private readonly audit: AuditService,
  ) {}

  list(userId: string, q: z.infer<typeof ContactQuery>) {
    const f: Record<string, unknown> = { userId };
    if (q.company) f.company = q.company;
    if (q.q) { const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); f.$or = [{ name: rx }, { email: rx }, { company: rx }]; }
    return this.model.find(f).sort({ company: 1, name: 1 }).limit(500).lean();
  }

  async create(userId: string, dto: z.infer<typeof ContactDto>) {
    try {
      const c = await this.model.create({ ...dto, userId, confidence: CONFIDENCE[dto.verification], lastVerifiedAt: dto.verification === 'verified' ? new Date() : undefined });
      await this.audit.record({ userId, actor: 'user', action: 'contact.created', entityType: 'contact', entityId: String(c._id), result: 'success' });
      return c;
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('A contact with this email already exists');
      throw e;
    }
  }

  async update(userId: string, id: string, dto: z.infer<typeof ContactPatchDto>) {
    const set: Record<string, unknown> = { ...dto };
    if (dto.verification) { set.confidence = CONFIDENCE[dto.verification]; if (dto.verification === 'verified') set.lastVerifiedAt = new Date(); }
    try {
      const c = await this.model.findOneAndUpdate({ _id: id, userId }, { $set: set }, { new: true }).lean();
      if (!c) throw new NotFoundException('Contact not found');
      return c;
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('A contact with this email already exists');
      throw e;
    }
  }

  async setSuppressed(userId: string, id: string, suppressed: boolean) {
    const c = await this.model.findOneAndUpdate({ _id: id, userId }, { $set: { suppressed } }, { new: true }).lean();
    if (!c) throw new NotFoundException('Contact not found');
    await this.audit.record({ userId, actor: 'user', action: suppressed ? 'contact.suppressed' : 'contact.unsuppressed', entityType: 'contact', entityId: id, result: 'success' });
    return c;
  }

  async remove(userId: string, id: string) {
    const r = await this.model.deleteOne({ _id: id, userId });
    if (!r.deletedCount) throw new NotFoundException('Contact not found');
    return { deleted: true };
  }

  /** One row per company, combining jobs, applications and contacts. */
  async companies(userId: string) {
    const [jobs, contacts, apps] = await Promise.all([
      this.jobs.find({ userId }).select('company').lean(),
      this.model.find({ userId }).select('company suppressed').lean(),
      this.apps.find({ userId }).populate('jobId', 'company').select('status jobId sentAt').lean(),
    ]);
    const m = new Map<string, { company: string; jobs: number; contacts: number; applications: number; replied: number; lastSentAt?: Date }>();
    const row = (name: string) => { const k = name.trim().toLowerCase(); if (!m.has(k)) m.set(k, { company: name.trim(), jobs: 0, contacts: 0, applications: 0, replied: 0 }); return m.get(k)!; };
    jobs.forEach((j) => { row(j.company).jobs++; });
    contacts.forEach((c) => { row(c.company).contacts++; });
    const REPLIED = ['hr_replied', 'interview', 'assessment', 'offer', 'accepted', 'rejected'];
    apps.forEach((a: any) => {
      if (!a.jobId?.company) return;
      const r = row(a.jobId.company); r.applications++;
      if (REPLIED.includes(a.status)) r.replied++;
      if (a.sentAt && (!r.lastSentAt || a.sentAt > r.lastSentAt)) r.lastSentAt = a.sentAt;
    });
    return [...m.values()].sort((a, b) => b.applications - a.applications || a.company.localeCompare(b.company));
  }

  isSuppressed(userId: string, email: string) { return this.model.exists({ userId, email: email.toLowerCase(), suppressed: true }); }
}
