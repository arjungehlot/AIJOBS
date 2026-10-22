import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { z } from 'zod';
import { Application } from '../applications/application.schema';
import { AuditLog } from '../audit/audit.schema';
import { AuditService } from '../audit/audit.service';
import { invalidateAuthCache } from '../common/auth';
import { env } from '../common/env';
import { Contact } from '../contacts/contact.schema';
import { InboundMessage } from '../inbox/message.schema';
import { Job } from '../jobs/job.schema';
import { MailAccount } from '../mail/mail-account.schema';
import { Resume } from '../resumes/resume.schema';
import { User } from '../users/user.schema';

export const UserListQuery = z.object({ q: z.string().max(100).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) });
export const UserPatchDto = z.object({
  plan: z.enum(['free', 'pro', 'premium_agent', 'teams']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  role: z.enum(['user', 'admin', 'super_admin']).optional(),
}).refine((d) => Object.keys(d).length > 0, 'Nothing to change');
export const AuditQuery = z.object({
  action: z.string().max(80).optional(), result: z.enum(['success', 'failure', 'blocked']).optional(), actor: z.string().max(20).optional(),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(40),
});

const days = (n: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - (n - 1)); return d; };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
    @InjectModel(Application.name) private readonly apps: Model<Application>,
    @InjectModel(AuditLog.name) private readonly logs: Model<AuditLog>,
    @InjectModel(InboundMessage.name) private readonly inbound: Model<InboundMessage>,
    @InjectModel(Contact.name) private readonly contacts: Model<Contact>,
    @InjectModel(Resume.name) private readonly resumes: Model<Resume>,
    @InjectModel(MailAccount.name) private readonly mailAccounts: Model<MailAccount>,
    @InjectConnection() private readonly conn: Connection,
    private readonly audit: AuditService,
  ) {}

  async overview() {
    const since = days(14);
    const perDay = (field: string, match: Record<string, unknown> = {}) => [
      { $match: { [field]: { $gte: since }, ...match } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}` } }, n: { $sum: 1 } } },
    ];
    const [totalUsers, byPlan, byRole, suspended, newUsers, signupRows, sentRows, byStatus, jobs, sentTotal, inbound, contacts, resumes, gmail, failures24h, events24h, active7d] = await Promise.all([
      this.users.countDocuments(), this.users.aggregate([{ $group: { _id: '$plan', n: { $sum: 1 } } }]), this.users.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
      this.users.countDocuments({ status: 'suspended' }), this.users.countDocuments({ createdAt: { $gte: days(7) } }),
      this.users.aggregate(perDay('createdAt')), this.apps.aggregate(perDay('sentAt')),
      this.apps.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      this.jobs.countDocuments(), this.apps.countDocuments({ sentAt: { $exists: true } }), this.inbound.countDocuments(), this.contacts.countDocuments(), this.resumes.countDocuments(),
      this.mailAccounts.countDocuments({ status: 'active' }),
      this.logs.countDocuments({ result: { $in: ['failure', 'blocked'] }, createdAt: { $gte: new Date(Date.now() - 86_400_000) } }),
      this.logs.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86_400_000) } }),
      this.users.countDocuments({ lastLoginAt: { $gte: days(7) } }),
    ]);
    const list = Array.from({ length: 14 }, (_, i) => { const d = new Date(since); d.setUTCDate(since.getUTCDate() + i); return d.toISOString().slice(0, 10); });
    const pick = (rows: any[]) => { const m = new Map(rows.map((r) => [r._id, r.n])); return list.map((d) => m.get(d) ?? 0); };
    const map = (rows: any[]) => Object.fromEntries(rows.map((r) => [r._id ?? 'unknown', r.n]));
    return {
      kpis: { users: totalUsers, newUsers7d: newUsers, active7d, suspended, jobs, applicationsSent: sentTotal, replies: inbound, contacts, resumes, gmailConnected: gmail, events24h, failures24h },
      byPlan: map(byPlan), byRole: map(byRole), byStatus: map(byStatus),
      series: { days: list, signups: pick(signupRows), sent: pick(sentRows) },
    };
  }

  async listUsers(q: z.infer<typeof UserListQuery>) {
    const f: Record<string, unknown> = {};
    if (q.q) { const rx = new RegExp(esc(q.q), 'i'); f.$or = [{ email: rx }, { name: rx }]; }
    const [items, total] = await Promise.all([
      this.users.find(f).select('-passwordHash').sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      this.users.countDocuments(f),
    ]);
    const ids = items.map((u) => u._id);
    const [appRows, sentRows, gm] = await Promise.all([
      this.apps.aggregate([{ $match: { userId: { $in: ids } } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]),
      this.apps.aggregate([{ $match: { userId: { $in: ids }, sentAt: { $exists: true } } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]),
      this.mailAccounts.find({ userId: { $in: ids }, status: 'active' }).select('userId').lean(),
    ]);
    const a = new Map(appRows.map((r: any) => [String(r._id), r.n])), s = new Map(sentRows.map((r: any) => [String(r._id), r.n])), g = new Set(gm.map((x) => String(x.userId)));
    return { total, page: q.page, limit: q.limit, items: items.map((u) => ({ ...u, applications: a.get(String(u._id)) ?? 0, sent: s.get(String(u._id)) ?? 0, gmailConnected: g.has(String(u._id)) })) };
  }

  async updateUser(adminId: string, id: string, dto: z.infer<typeof UserPatchDto>) {
    const u = await this.users.findById(id);
    if (!u) throw new NotFoundException('User not found');
    const self = id === adminId;
    if (self && (dto.role !== undefined || dto.status !== undefined)) throw new BadRequestException('You cannot change your own role or status');
    if (u.email === env.superAdminEmail && (dto.role !== undefined || dto.status !== undefined)) throw new BadRequestException('The .env super admin account is managed in the .env file');
    const before = { plan: u.plan, status: u.status, role: u.role };
    if (dto.plan) u.plan = dto.plan; if (dto.status) u.status = dto.status; if (dto.role) u.role = dto.role;
    await u.save();
    invalidateAuthCache(id);
    await this.audit.record({ userId: id, actor: 'admin', action: 'admin.user_updated', entityType: 'user', entityId: id, result: 'success', meta: { by: adminId, before, after: dto } });
    const { passwordHash, ...safe } = u.toObject();
    return safe;
  }

  async auditLog(q: z.infer<typeof AuditQuery>) {
    const f: Record<string, unknown> = {};
    if (q.action) f.action = new RegExp(esc(q.action), 'i');
    if (q.result) f.result = q.result;
    if (q.actor) f.actor = q.actor;
    const [items, total] = await Promise.all([
      this.logs.find(f).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      this.logs.countDocuments(f),
    ]);
    const owners = await this.users.find({ _id: { $in: [...new Set(items.map((i) => String(i.userId)))].map((x) => new Types.ObjectId(x)) } }).select('email').lean();
    const email = new Map(owners.map((o) => [String(o._id), o.email]));
    return { total, page: q.page, limit: q.limit, items: items.map((i) => ({ ...i, userEmail: email.get(String(i.userId)) ?? null })) };
  }

  system() {
    const checks: { name: string; status: 'ok' | 'warn' | 'bad'; detail: string }[] = [];
    const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'][this.conn.readyState] ?? 'unknown';
    checks.push({ name: 'Database', status: this.conn.readyState === 1 ? 'ok' : 'bad', detail: `MongoDB ${dbState} (${this.conn.name || 'default'})` });
    checks.push({ name: 'Mail mode', status: env.mailProvider === 'gmail' ? 'ok' : 'warn', detail: env.mailProvider === 'gmail' ? 'Live: approved applications send through each user\'s Gmail' : 'Mock: no real email is sent' });
    checks.push({ name: 'Google OAuth', status: env.gmailConfigured ? 'ok' : 'warn', detail: env.gmailConfigured ? `Configured. Redirect: ${env.gmailRedirectUri}` : 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set' });
    checks.push({ name: 'AI provider', status: env.aiProvider === 'mock' ? 'warn' : 'ok', detail: env.aiProvider === 'mock' ? 'Mock (offline heuristics)' : env.aiProvider });
    const zeroKey = /^0{64}$/.test(process.env.TOKEN_ENCRYPTION_KEY ?? '');
    checks.push({ name: 'Token encryption key', status: zeroKey ? 'bad' : 'ok', detail: zeroKey ? 'Still the default all-zero key. Generate a real one before storing real Gmail tokens' : 'Custom key set' });
    const weak = ['change-me', ''].includes(process.env.AUTH_SECRET ?? '') || (process.env.AUTH_SECRET ?? '').length < 32;
    checks.push({ name: 'Auth secret', status: weak ? 'bad' : 'ok', detail: weak ? 'Short or default. Use at least 32 random characters' : 'Looks strong' });
    checks.push({ name: 'Super admin seed', status: env.superAdminEmail ? 'ok' : 'warn', detail: env.superAdminEmail ? `Seeded from .env (${env.superAdminEmail})` : 'Not configured' });
    if ((process.env.SUPER_ADMIN_PASSWORD ?? '').length > 0 && (process.env.SUPER_ADMIN_PASSWORD ?? '').length < 12) checks.push({ name: 'Super admin password', status: 'warn', detail: 'Shorter than 12 characters. Fine for local testing, not for production' });
    return { checks, runtime: { node: process.version, env: process.env.NODE_ENV ?? 'development', uptimeSec: Math.round(process.uptime()), port: env.port, webUrl: env.webUrl } };
  }
}
