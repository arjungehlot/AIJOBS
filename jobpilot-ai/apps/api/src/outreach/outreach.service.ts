import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { z } from 'zod';
import { AI_PROVIDER, AiProvider } from '../ai/ai.provider';
import { AiSettingsService } from '../ai/ai-settings.service';
import { AuditService } from '../audit/audit.service';
import { env } from '../common/env';
import { MAX_RECIPIENTS, fillTemplate, fillWa, isPhoneOnly, nextGapMs, parseRecipients, renderOutreachHtml, renderOutreachText, renderWhatsAppText, starterTemplate, urlsIn } from '../domain/outreach';
import { WhatsappError, WhatsappService } from '../whatsapp/whatsapp.service';
import { MAIL_PROVIDER, MailOutcomeUnknownError, MailProvider, MailRejectedError } from '../mail/mail.provider';
import { GmailService } from '../mail/gmail.service';
import { ResumesService } from '../resumes/resumes.service';
import { User } from '../users/user.schema';
import { OutreachCampaign, OutreachRecipient } from './outreach.schema';

const oid = z.string().regex(/^[a-f0-9]{24}$/i);
export const ParseDto = z.object({ text: z.string().max(60_000) });
export const PreviewDto = z.object({ subject: z.string().max(300), body: z.string().max(8000), resumeId: oid.optional(), name: z.string().max(80).optional(), company: z.string().max(80).optional(), waText: z.string().max(1000).optional() });
export const DraftDto = z.object({ role: z.string().trim().max(120).optional(), tone: z.enum(['professional', 'concise', 'friendly', 'technical']).default('professional') });
export const ImageDto = z.object({ image: z.string().max(11_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Use a PNG, JPEG or WebP image') });
export const ReplyDto = z.object({ threadId: z.string().regex(/^[a-f0-9]{8,32}$/i), tone: z.enum(['professional', 'concise', 'friendly', 'enthusiastic']).default('professional'), instruction: z.string().trim().max(300).optional() });
export const EnhanceDto = z.object({ body: z.string().trim().min(20).max(8000), action: z.enum(['improve', 'shorter', 'friendlier', 'formal', 'confident', 'grammar']) });
const ACTIONS: Record<string, string> = {
  improve: 'Improve clarity, flow and polish while keeping about the same length.',
  shorter: 'Make it clearly shorter and tighter (about 40% fewer words) without losing the key points.',
  friendlier: 'Make the tone warmer and more personable, still professional.',
  formal: 'Make the tone more formal and polished.',
  confident: 'Make it sound more confident and specific, without exaggerating or inventing anything.',
  grammar: 'Fix spelling, grammar and punctuation only. Do not change wording otherwise.',
};
export const CampaignDto = z.object({
  name: z.string().trim().min(1).max(120), subject: z.string().trim().min(3).max(300), body: z.string().trim().min(20).max(8000),
  resumeId: oid, includeExtraFiles: z.boolean().default(true), gapSec: z.number().int().min(10).max(600).default(45),
  recipientsText: z.string().max(60_000), start: z.boolean().default(false),
  whatsapp: z.boolean().default(false), waText: z.string().trim().max(1000).optional(),
});

const DAY = 24 * 3600_000;
const SKIP_WINDOW = 60 * DAY;
/** Errors that affect the whole account, not one address: pause and wait for the user. */
const ACCOUNT_WIDE = /reconnect|connect your gmail|rate limit|expired/i;

@Injectable()
export class OutreachService {
  private readonly log = new Logger('Outreach');
  private readonly busy = new Set<string>();
  constructor(
    @InjectModel(OutreachCampaign.name) private readonly camps: Model<OutreachCampaign>,
    @InjectModel(OutreachRecipient.name) private readonly recs: Model<OutreachRecipient>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly resumes: ResumesService, private readonly settings: AiSettingsService, private readonly audit: AuditService, private readonly gmail: GmailService, private readonly wa: WhatsappService,
  ) {}

  // ---- info ----
  async limits(userId: string) {
    const sent = await this.sentSince(userId, new Date(Date.now() - DAY));
    return { dailyLimit: env.outreachDailyLimit, sentLast24h: sent, maxRecipients: MAX_RECIPIENTS, minGapSec: 10, mailMode: env.mailProvider, gmailConnected: await this.gmail.hasAccount(userId), whatsapp: this.wa.status() };
  }
  private sentSince(userId: string, since: Date) { return this.recs.countDocuments({ userId, status: 'sent', sentAt: { $gte: since } }); }

  async parse(userId: string, text: string) {
    const u = await this.users.findById(userId).lean();
    const r = parseRecipients(text, { selfEmail: u?.email, defaultCc: env.waDefaultCc });
    const prior = r.valid.length ? await this.recs.find({ userId, email: { $in: r.valid.map((v) => v.email) }, status: 'sent', sentAt: { $gte: new Date(Date.now() - SKIP_WINDOW) } }).select('email').lean() : [];
    const already = new Set(prior.map((p) => p.email));
    return { ...r, alreadyContacted: r.valid.filter((v) => already.has(v.email)).map((v) => v.email) };
  }

  async draft(userId: string, dto: z.infer<typeof DraftDto>) {
    const [u, resume] = await Promise.all([this.users.findById(userId).lean(), this.resumes.pick(userId)]);
    const name = u?.name ?? 'Candidate'; const skills = resume?.skills ?? [];
    const base = starterTemplate({ name, role: dto.role, skills });
    try {
      const d = await this.ai.draftEmail({ candidateName: name, jobTitle: dto.role || 'a suitable role', company: 'your company', tone: dto.tone, matchedSkills: skills.slice(0, 8), missingRequiredSkills: [], yearsExperience: 0, resumeAttached: true, signatureAppended: true, resumeFacts: resume?.text?.slice(0, 3000), jobExcerpt: 'General enquiry to an HR team about openings. No specific job post.' });
      if (d.body && d.body.trim().length > 40) return { subject: d.subject || base.subject, body: this.withPlaceholders(d.body), source: this.ai.name };
    } catch { /* fall back to the plain starter below */ }
    return { ...base, source: 'template' };
  }
  /** Makes sure the greeting and company are personalised per recipient even when the model wrote generic text. */
  private withPlaceholders(b: string) {
    let t = b.trim().replace(/^(hello|hi|dear)[^\n,]*,?/i, 'Hello {{name}},');
    if (!/\{\{name\}\}/i.test(t)) t = `Hello {{name}},\n\n${t}`;
    return t.replace(/\byour company\b/gi, '{{company}}');
  }

  /** Reads addresses out of a pasted screenshot. The AI only proposes; every address is re-validated here and the user ticks which to use. */
  async fromImage(userId: string, dto: z.infer<typeof ImageDto>) {
    if (!this.ai.extractEmails) throw new BadRequestException('Reading images needs the Gemini AI provider. Set GEMINI_API_KEY on the server.');
    const m = /^data:(image\/(?:png|jpeg|webp));base64,(.*)$/.exec(dto.image)!;
    const found = await this.ai.extractEmails({ mime: m[1] as any, base64: m[2] });
    if (!found) throw new BadRequestException('Reading images needs the Gemini AI provider. Set GEMINI_API_KEY on the server.');
    const u = await this.users.findById(userId).lean();
    const text = found.map((f) => [f.email ?? '', f.phone ?? '', f.name ?? '', f.company ?? ''].map((x) => x.replace(/[,\n]/g, ' ').trim()).filter(Boolean).join(', ')).filter(Boolean).join('\n');
    const r = parseRecipients(text, { selfEmail: u?.email, max: MAX_RECIPIENTS, defaultCc: env.waDefaultCc });
    const prior = r.valid.length ? await this.recs.find({ userId, email: { $in: r.valid.map((v) => v.email) }, status: 'sent', sentAt: { $gte: new Date(Date.now() - 60 * 86_400_000) } }).select('email').lean() : [];
    const already = new Set(prior.map((p) => p.email));
    return { ...r, alreadyContacted: r.valid.filter((v) => already.has(v.email)).map((v) => v.email), seen: found.length };
  }

  /** Reads a mailbox conversation and proposes a reply. Nothing is sent: the user edits and presses Send. */
  async suggestReply(userId: string, dto: z.infer<typeof ReplyDto>) {
    if (!this.ai.suggestReply) throw new BadRequestException('AI replies need the Gemini AI provider. Set GEMINI_API_KEY on the server.');
    const [t, u, resume] = await Promise.all([this.gmail.getThread(userId, dto.threadId), this.users.findById(userId).lean(), this.resumes.pick(userId)]);
    // Newest text only: drop quoted history ("On ... wrote:", "> ..." lines) so the model sees each message once.
    const fresh = (b: string) => { const lines = String(b ?? '').replace(/\r/g, '').split('\n'); const cut = lines.findIndex((l) => /^\s*(on .{5,120} wrote:|-{2,}\s*original message|from:\s.+@)/i.test(l) || /^>/.test(l)); return (cut > 0 ? lines.slice(0, cut) : lines).join('\n').replace(/\n{3,}/g, '\n\n').trim(); };
    const thread = t.messages.map((m: any) => ({ from: m.mine ? 'Candidate' : `${m.from?.name ?? ''} <${m.from?.email ?? ''}>`.trim(), mine: !!m.mine, date: new Date(m.date).toISOString().slice(0, 16).replace('T', ' '), text: fresh(m.body) })).filter((m: any) => m.text);
    if (!thread.length) throw new BadRequestException('This conversation has no readable text.');
    const model = await this.settings.modelFor(userId);
    const out = await this.ai.suggestReply({ candidateName: u?.name ?? '', resumeText: resume?.text, skills: resume?.skills, tone: dto.tone, instruction: dto.instruction, thread }, model ? { model } : undefined);
    if (!out) throw new BadRequestException('AI replies need the Gemini AI provider. Set GEMINI_API_KEY on the server.');
    return out;
  }

  async enhance(userId: string, dto: z.infer<typeof EnhanceDto>) {
    if (!this.ai.rewriteText) throw new BadRequestException('Text enhancement needs the Gemini AI provider. Set GEMINI_API_KEY on the server.');
    const out = await this.ai.rewriteText(dto.body, ACTIONS[dto.action]);
    if (!out) throw new BadRequestException('Text enhancement needs the Gemini AI provider. Set GEMINI_API_KEY on the server.');
    return { body: this.withPlaceholders(out) };
  }

  async preview(userId: string, dto: z.infer<typeof PreviewDto>) {
    const { u, resume, signature, names } = await this.context(userId, dto.resumeId, true);
    const r = { email: 'hr@example.com', name: dto.name || 'Priya Sharma', company: dto.company || 'Acme Technologies' };
    const body = fillTemplate(dto.body, r);
    const waText = renderWhatsAppText({ recipientName: r.name, company: r.company, senderName: u.name, skills: (await this.resumes.pick(userId, dto.resumeId))?.skills, links: urlsIn(signature), custom: dto.waText ? fillWa(dto.waText, r) : undefined });
    return { whatsapp: waText, to: r.email, subject: fillTemplate(dto.subject, r), html: renderOutreachHtml({ body, signature, senderName: u.name, attachmentNames: names, preheader: body.slice(0, 90) }), text: renderOutreachText(body, signature, u.name), resumeName: resume?.filename ?? null };
  }

  private async context(userId: string, resumeId: string | undefined, soft = false) {
    const u = await this.users.findById(userId).lean(); if (!u) throw new NotFoundException();
    const rid = resumeId ?? (await this.settings.defaultResumeId(userId));
    const resume = rid ? await this.resumes.file(userId, rid) : null;
    if (!resume && !soft) throw new BadRequestException('Choose a resume that has its PDF uploaded. The email is sent with the resume attached.');
    const extra = await this.settings.extraAttachments(userId);
    const signature = (await this.settings.signatureFor(userId)).trim();
    return { u, resume, extra, signature, names: [resume?.filename, ...extra.map((e) => e.filename)].filter(Boolean) as string[] };
  }

  // ---- campaigns ----
  async create(userId: string, dto: z.infer<typeof CampaignDto>) {
    await this.context(userId, dto.resumeId); // resume must exist with a file
    const u = await this.users.findById(userId).lean();
    const parsed = parseRecipients(dto.recipientsText, { selfEmail: u?.email, defaultCc: env.waDefaultCc });
    if (dto.whatsapp && !this.wa.configured) throw new BadRequestException('WhatsApp sending is not set up on the server yet. Add WHATSAPP_BASE_URL and WHATSAPP_API_KEY to .env, or turn WhatsApp off.');
    // Without WhatsApp, people who only have a phone number cannot be reached, so they are left out (and counted).
    const people = dto.whatsapp ? parsed.valid : parsed.valid.filter((r) => !isPhoneOnly(r.email));
    const skippedPhoneOnly = parsed.valid.length - people.length;
    if (!people.length) throw new BadRequestException(skippedPhoneOnly ? 'These contacts only have phone numbers. Turn on “Also send on WhatsApp” to message them.' : 'Add at least one valid HR email address or phone number');
    const camp = await this.camps.create({ userId, name: dto.name, subject: dto.subject, body: dto.body, resumeId: dto.resumeId, includeExtraFiles: dto.includeExtraFiles, gapSec: dto.gapSec, status: 'draft', whatsapp: dto.whatsapp, waText: dto.waText || undefined });
    await this.recs.insertMany(people.map((r, i) => ({ campaignId: camp._id, userId, email: r.email, phone: dto.whatsapp ? r.phone : undefined, name: r.name, company: r.company, order: i, key: randomBytes(16).toString('hex') })));
    await this.audit.record({ userId, actor: 'user', action: 'outreach.created', entityType: 'outreach', entityId: String(camp._id), result: 'success', meta: { recipients: people.length, whatsapp: dto.whatsapp } });
    if (dto.start) await this.start(userId, String(camp._id));
    return { id: String(camp._id), recipients: people.length, withPhone: dto.whatsapp ? people.filter((r) => r.phone).length : 0, skippedPhoneOnly, skippedInvalid: parsed.invalid.length, duplicates: parsed.duplicates, truncated: parsed.truncated };
  }

  private async own(userId: string, id: string) {
    const c = await this.camps.findOne({ _id: id, userId }); if (!c) throw new NotFoundException('Campaign not found'); return c;
  }

  async start(userId: string, id: string) {
    const c = await this.own(userId, id);
    if (['done', 'cancelled'].includes(c.status)) throw new BadRequestException('This campaign has finished. Create a new one.');
    if (c.whatsapp && !this.wa.configured) throw new BadRequestException('WhatsApp sending is not set up on the server yet (WHATSAPP_BASE_URL / WHATSAPP_API_KEY).');
    const needsMail = !!(await this.recs.exists({ campaignId: c._id, status: 'queued', email: { $not: /@phone\.jobpilot\.invalid$/ } }));
    if (needsMail && env.mailProvider === 'gmail' && !(await this.gmail.hasAccount(userId))) throw new BadRequestException('Connect your Gmail first (sign in with Google or Email Setup). Emails are sent from your own address.');
    await this.context(userId, c.resumeId ? String(c.resumeId) : undefined);
    c.status = 'running'; c.nextAt = new Date(); c.startedAt ??= new Date(); c.note = undefined; await c.save();
    await this.audit.record({ userId, actor: 'user', action: 'outreach.started', entityType: 'outreach', entityId: id, result: 'success' });
    return { status: c.status };
  }
  async pause(userId: string, id: string) { const c = await this.own(userId, id); if (c.status === 'running') { c.status = 'paused'; await c.save(); } return { status: c.status }; }
  async cancel(userId: string, id: string) {
    const c = await this.own(userId, id); if (['done', 'cancelled'].includes(c.status)) return { status: c.status };
    c.status = 'cancelled'; c.finishedAt = new Date(); await c.save();
    await this.recs.updateMany({ campaignId: c._id, status: 'queued' }, { $set: { status: 'skipped', error: 'Campaign cancelled' } });
    await this.audit.record({ userId, actor: 'user', action: 'outreach.cancelled', entityType: 'outreach', entityId: id, result: 'success' });
    return { status: c.status };
  }
  async retryFailed(userId: string, id: string) {
    const c = await this.own(userId, id);
    const r = await this.recs.updateMany({ campaignId: c._id, status: 'failed', error: { $not: /outcome unknown/i } }, { $set: { status: 'queued' }, $unset: { error: '' } });
    if (r.modifiedCount && c.status === 'done') { c.status = 'paused'; c.finishedAt = undefined; await c.save(); }
    return { requeued: r.modifiedCount };
  }

  async list(userId: string) {
    const camps = await this.camps.find({ userId }).sort({ createdAt: -1 }).limit(30).lean();
    const agg = await this.recs.aggregate([{ $match: { campaignId: { $in: camps.map((c) => c._id) } } }, { $group: { _id: { c: '$campaignId', s: '$status' }, n: { $sum: 1 } } }]);
    return camps.map((c) => {
      const counts: Record<string, number> = { queued: 0, sending: 0, sent: 0, failed: 0, skipped: 0 };
      for (const a of agg) if (String(a._id.c) === String(c._id)) counts[a._id.s] = a.n;
      return { id: String(c._id), name: c.name, subject: c.subject, status: c.status, gapSec: c.gapSec, nextAt: c.nextAt ?? null, note: c.note ?? null, createdAt: (c as any).createdAt, counts, total: Object.values(counts).reduce((x, y) => x + y, 0) };
    });
  }
  async detail(userId: string, id: string) {
    const c = await this.own(userId, id);
    const recipients = await this.recs.find({ campaignId: c._id }).sort({ order: 1 }).select('email phone name company status error sentAt order waStatus waError').lean();
    return { id, whatsapp: !!c.whatsapp, name: c.name, subject: c.subject, body: c.body, status: c.status, note: c.note ?? null, nextAt: c.nextAt ?? null, gapSec: c.gapSec, recipients: recipients.map((r) => ({ email: isPhoneOnly(r.email) ? `+${r.phone}` : r.email, phone: r.phone ?? null, phoneOnly: isPhoneOnly(r.email), waStatus: r.waStatus ?? null, waError: r.waError ?? null, name: r.name ?? null, company: r.company ?? null, status: r.status, error: r.error ?? null, sentAt: r.sentAt ?? null })) };
  }

  // ---- sender: one email per due campaign per tick ----
  async tick(now = new Date()) {
    await this.reconcileStuck(now);
    const due = await this.camps.find({ status: 'running', nextAt: { $lte: now } }).limit(20).lean();
    for (const c of due) {
      const id = String(c._id); if (this.busy.has(id)) continue;
      this.busy.add(id);
      try { await this.sendNext(id, now); } catch (e: any) { this.log.warn(`outreach tick failed: ${String(e?.message ?? e).slice(0, 160)}`); } finally { this.busy.delete(id); }
    }
  }

  private async sendNext(id: string, now: Date) {
    const c = await this.camps.findOne({ _id: id, status: 'running' }); if (!c) return;
    const userId = String(c.userId);
    const used = await this.sentSince(userId, new Date(now.getTime() - DAY));
    if (used >= env.outreachDailyLimit) { c.nextAt = new Date(now.getTime() + 15 * 60_000); c.note = `Daily limit of ${env.outreachDailyLimit} reached. Sending resumes on its own when the limit allows.`; await c.save(); return; }
    const rec = await this.recs.findOneAndUpdate({ campaignId: c._id, status: 'queued' }, { $set: { status: 'sending' } }, { sort: { order: 1 }, new: true });
    if (!rec) { // nothing left to claim
      if (!(await this.recs.exists({ campaignId: c._id, status: 'sending' }))) { c.status = 'done'; c.finishedAt = now; c.nextAt = undefined; await c.save(); await this.audit.record({ userId, actor: 'agent', action: 'outreach.finished', entityType: 'outreach', entityId: String(c._id), result: 'success' }); }
      return;
    }
    // Never write twice to the same person within 60 days (any campaign).
    const dup = await this.recs.exists({ userId, email: rec.email, status: 'sent', sentAt: { $gte: new Date(now.getTime() - SKIP_WINDOW) }, _id: { $ne: rec._id } });
    if (dup) { rec.status = 'skipped'; rec.error = isPhoneOnly(rec.email) ? 'Already messaged in the last 60 days' : 'Already emailed in the last 60 days'; await rec.save(); c.nextAt = now; await c.save(); return; }

    let ctx: Awaited<ReturnType<OutreachService['context']>>;
    try { ctx = await this.context(userId, c.resumeId ? String(c.resumeId) : undefined); }
    catch (e: any) { await this.requeue(rec); c.status = 'paused'; c.note = `Paused: ${String(e?.message ?? 'resume not available')}`; await c.save(); return; }
    const r = { email: rec.email, name: rec.name, company: rec.company };
    const phoneOnly = isPhoneOnly(rec.email);
    if (!phoneOnly) {
    const body = fillTemplate(c.body, r); const subject = fillTemplate(c.subject, r);
    const html = renderOutreachHtml({ body, signature: ctx.signature, senderName: ctx.u.name, attachmentNames: ctx.names, preheader: body.slice(0, 90) });
    const text = renderOutreachText(body, ctx.signature, ctx.u.name);
    try {
      const sent = await this.mail.send({ userId, idempotencyKey: rec.key, from: ctx.u.email, to: rec.email, subject, body: text, html, attachments: [...(ctx.resume ? [ctx.resume] : []), ...(c.includeExtraFiles ? ctx.extra : [])] } as any);
      rec.status = 'sent'; rec.sentAt = new Date(); rec.messageId = sent.messageId; rec.threadId = sent.threadId; rec.error = undefined; await rec.save();
      await this.audit.record({ userId, actor: 'agent', action: 'outreach.sent', entityType: 'outreach', entityId: String(c._id), result: 'success', meta: { to: rec.email } });
      c.note = undefined;
    } catch (e: any) {
      const msg = String(e?.message ?? 'Send failed').slice(0, 200);
      if (e instanceof MailOutcomeUnknownError) {
        const hit = await this.mail.findSent(rec.key, userId).catch(() => null);
        if (hit) { rec.status = 'sent'; rec.sentAt = new Date(); rec.messageId = hit.messageId; rec.threadId = hit.threadId; }
        else { rec.status = 'failed'; rec.error = 'Outcome unknown: check your Gmail Sent folder before retrying'; }
        await rec.save();
      } else if (e instanceof MailRejectedError && ACCOUNT_WIDE.test(msg)) {
        await this.requeue(rec); c.status = 'paused'; c.note = `Paused: ${msg}`; await c.save();
        await this.audit.record({ userId, actor: 'agent', action: 'outreach.paused', entityType: 'outreach', entityId: String(c._id), result: 'failure', detail: msg });
        return;
      } else { rec.status = 'failed'; rec.error = msg; await rec.save(); await this.audit.record({ userId, actor: 'agent', action: 'outreach.failed', entityType: 'outreach', entityId: String(c._id), result: 'failure', detail: msg, meta: { to: rec.email } }); }
    }
    }
    // WhatsApp: same person, same resume, a short message. Independent of the email result.
    if (c.whatsapp && rec.phone) { if (!(await this.sendWhatsapp(c, rec, ctx, r, phoneOnly))) return; }
    else if (phoneOnly) { rec.status = 'skipped'; rec.error = 'WhatsApp is off for this campaign'; await rec.save(); }
    c.nextAt = new Date(Date.now() + nextGapMs(c.gapSec)); await c.save();
  }
  /** Returns false when the whole campaign was paused (a setup problem, not this person's number). */
  private async sendWhatsapp(c: any, rec: any, ctx: Awaited<ReturnType<OutreachService['context']>>, r: { name?: string; company?: string }, phoneOnly: boolean): Promise<boolean> {
    const userId = String(c.userId);
    try {
      const meta = await this.resumes.pick(userId, c.resumeId ? String(c.resumeId) : undefined);
      const text = renderWhatsAppText({ recipientName: r.name, company: r.company, senderName: ctx.u.name, skills: meta?.skills, links: urlsIn(ctx.signature), custom: c.waText ? fillWa(c.waText, r) : undefined });
      const first = r.name?.trim() ? r.name.trim().split(/\s+/)[0] : 'there';
      const out = await this.wa.send({ to: rec.phone, text, resume: ctx.resume, key: rec.key, vars: [first, ctx.u.name, r.company?.trim() || 'your company', ''] });
      rec.waStatus = 'sent'; rec.waSentAt = new Date(); rec.waMessageId = out.messageId; rec.waError = undefined;
      if (phoneOnly) { rec.status = 'sent'; rec.sentAt = new Date(); rec.error = undefined; }
      await rec.save();
      await this.audit.record({ userId, actor: 'agent', action: 'outreach.whatsapp_sent', entityType: 'outreach', entityId: String(c._id), result: 'success', meta: { to: `+${String(rec.phone).slice(0, 4)}…${String(rec.phone).slice(-2)}` } });
    } catch (e: any) {
      const msg = String(e?.message ?? 'WhatsApp send failed').slice(0, 220);
      if (e instanceof WhatsappError && e.accountWide) {
        if (phoneOnly) await this.requeue(rec);
        else { rec.waStatus = 'failed'; rec.waError = msg; await rec.save(); }
        c.status = 'paused'; c.note = `Paused: ${msg}`; await c.save();
        await this.audit.record({ userId, actor: 'agent', action: 'outreach.paused', entityType: 'outreach', entityId: String(c._id), result: 'failure', detail: msg });
        return false;
      }
      rec.waStatus = 'failed'; rec.waError = msg; if (phoneOnly) { rec.status = 'failed'; rec.error = msg; }
      await rec.save();
      await this.audit.record({ userId, actor: 'agent', action: 'outreach.whatsapp_failed', entityType: 'outreach', entityId: String(c._id), result: 'failure', detail: msg });
    }
    return true;
  }
  private requeue(rec: any) { rec.status = 'queued'; return rec.save(); }

  /** A crash between "claimed" and "recorded" leaves a row in `sending`. Look in Sent before deciding it failed. */
  private async reconcileStuck(now: Date) {
    const stuck = await this.recs.find({ status: 'sending', updatedAt: { $lt: new Date(now.getTime() - 5 * 60_000) } }).limit(20);
    for (const r of stuck) {
      if (this.busy.has(String(r.campaignId))) continue;
      const hit = await this.mail.findSent(r.key, String(r.userId)).catch(() => null);
      if (hit) { r.status = 'sent'; r.sentAt = new Date(); r.messageId = hit.messageId; r.threadId = hit.threadId; } else { r.status = 'failed'; r.error = 'Outcome unknown: check your Gmail Sent folder before retrying'; }
      await r.save();
    }
  }
}
