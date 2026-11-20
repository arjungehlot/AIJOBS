import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Model } from 'mongoose';
import { z } from 'zod';
import { AiSettingsService } from '../ai/ai-settings.service';
import { AuditService } from '../audit/audit.service';
import { env } from '../common/env';
import { normalizePhone, renderWhatsAppText, urlsIn } from '../domain/outreach';
import { Job } from '../jobs/job.schema';
import { ResumesService } from '../resumes/resumes.service';
import { User } from '../users/user.schema';

export class WhatsappError extends Error {
  constructor(message: string, readonly code?: number, readonly accountWide = false) { super(message); }
}
export interface WaFile { filename: string; mime: string; data: Buffer }
export interface WaSend { to: string; text: string; /** Reused as the gateway's Idempotency-Key so a retry never double-sends. */ key?: string; resume?: WaFile | null; /** Values for the template body, in order: first name, sender, company, role. */ vars?: string[] }

export const SendJobDto = z.object({ jobId: z.string().regex(/^[a-f0-9]{24}$/i), phone: z.string().max(40).optional(), resumeId: z.string().regex(/^[a-f0-9]{24}$/i).optional() });

/** Meta error codes worth explaining in plain words. */
const HINTS: Record<number, string> = {
  131047: 'WhatsApp only allows a free-form message within 24 hours of the person last writing to you. To start a new chat, create an approved message template and set WHATSAPP_TEMPLATE_NAME.',
  131026: 'This number is not on WhatsApp (or cannot receive messages).',
  131030: 'This number is not on your WhatsApp test list. In Meta developer mode you can only message numbers added under API Setup, or use a live phone number.',
  131056: 'Too many messages to this number too quickly. Try again later.',
  132000: 'The template needs a different number of values. Set WHATSAPP_TEMPLATE_PARAMS to match its {{1}}, {{2}}… count.',
  132001: 'The template name or language was not found. Check WHATSAPP_TEMPLATE_NAME and WHATSAPP_TEMPLATE_LANG.',
  132012: 'A template value has the wrong format. Check WHATSAPP_TEMPLATE_PARAMS and the template body.',
  132015: 'The template is paused or disabled by WhatsApp.',
  132016: 'The template is paused for low quality.',
};
/** Errors that affect the whole account (not one number): stop and let the user fix the setup. */
const ACCOUNT_CODES = new Set([0, 3, 10, 190, 200, 368, 130429, 131005, 131031, 133010]);

@Injectable()
export class WhatsappService {
  private readonly log = new Logger('WhatsApp');
  private readonly media = new Map<string, { id: string; at: number }>();
  constructor(
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly resumes: ResumesService, private readonly settings: AiSettingsService, private readonly audit: AuditService,
  ) {}

  get configured() { return env.waConfigured; }
  status() {
    if (env.waGatewayOn) return { configured: true, mode: 'gateway', template: null, defaultCountry: env.waDefaultCc, phone: env.waConnectedPhone || null, channel: env.waChannel || null,
      note: `Sends from your connected WhatsApp${env.waConnectedPhone ? ` (${env.waConnectedPhone})` : ''}${env.waChannel ? `, channel ${env.waChannel}` : ''}, with the resume attached. Unofficial gateway: keep the gap at 10 sec or more.` };
    return { configured: env.waConfigured, mode: env.waTemplate ? 'template' : 'session', template: env.waTemplate || null, defaultCountry: env.waDefaultCc,
      note: env.waConfigured ? (env.waTemplate ? 'Messages go out as your approved template, with the resume attached.' : 'Messages go out as normal chat messages. WhatsApp delivers them only to people who messaged you in the last 24 hours; set WHATSAPP_TEMPLATE_NAME to message new people.') : 'Add WHATSAPP_BASE_URL and WHATSAPP_API_KEY to the server .env to turn this on.' };
  }

  private async call(path: string, init: RequestInit): Promise<any> {
    if (!env.waConfigured) throw new WhatsappError('WhatsApp is not set up. Add WHATSAPP_BASE_URL and WHATSAPP_API_KEY to the server .env.', 0, true);
    let res: Response;
    try { res = await fetch(`https://graph.facebook.com/${env.waVersion}/${env.waPhoneId}/${path}`, { ...init, headers: { Authorization: `Bearer ${env.waToken}`, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(30_000) }); }
    catch (e: any) { throw new WhatsappError(`Could not reach WhatsApp: ${String(e?.message ?? e).slice(0, 120)}`); }
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const er = json?.error ?? {}; const code = Number(er.code ?? 0);
      const detail = er.error_data?.details ?? er.message ?? `HTTP ${res.status}`;
      throw new WhatsappError(HINTS[code] ?? `WhatsApp refused it: ${String(detail).slice(0, 200)}`, code, ACCOUNT_CODES.has(code) || res.status === 401);
    }
    return json;
  }

  /** Uploads the PDF once and reuses the id for every recipient in the same run (WhatsApp keeps media 30 days). */
  private async mediaId(file: WaFile): Promise<string> {
    const key = createHash('sha1').update(file.data).digest('hex'); const hit = this.media.get(key);
    if (hit && Date.now() - hit.at < 20 * 60_000) return hit.id;
    const fd = new FormData(); fd.append('messaging_product', 'whatsapp'); fd.append('type', file.mime);
    fd.append('file', new Blob([new Uint8Array(file.data)], { type: file.mime }), file.filename);
    const j = await this.call('media', { method: 'POST', body: fd });
    if (!j?.id) throw new WhatsappError('WhatsApp did not accept the resume file.');
    this.media.set(key, { id: j.id, at: Date.now() }); return j.id;
  }

  private authMode: 'key' | 'bearer' | null = null;
  /** Calls the unofficial gateway. The key header is not in its docs, so x-api-key and Authorization: Bearer are tried (once) and the winner is remembered. */
  private async gw(path: string, init: RequestInit & { headers?: Record<string, string> }): Promise<any> {
    const order: ('key' | 'bearer')[] = this.authMode ? [this.authMode] : env.waAuthHeader === 'bearer' ? ['bearer', 'key'] : ['key', 'bearer'];
    let res: Response | null = null; let json: any = {};
    for (const mode of order) {
      const auth: Record<string, string> = mode === 'bearer' ? { Authorization: `Bearer ${env.waGatewayKey}` } : { [env.waAuthHeader && env.waAuthHeader !== 'bearer' ? env.waAuthHeader : 'x-api-key']: env.waGatewayKey };
      try { res = await fetch(`${env.waGatewayUrl}${path}`, { ...init, headers: { Accept: 'application/json', ...auth, ...(init.headers ?? {}) } as Record<string, string>, signal: AbortSignal.timeout(45_000) }); }
      catch (e: any) { throw new WhatsappError(`Could not reach the WhatsApp gateway: ${String(e?.message ?? e).slice(0, 120)}`); }
      json = await res.json().catch(() => ({}));
      if (res.status !== 401) { this.authMode = mode; break; }
    }
    if (!res!.ok) {
      const det = json?.details && Object.keys(json.details).length ? ` ${JSON.stringify(json.details).slice(0, 160)}` : '';
      const base = `${json?.message ?? `HTTP ${res!.status}`}${det}`;
      const hint = res!.status === 401 ? 'The gateway rejected the API key. Check WHATSAPP_API_KEY (and WHATSAPP_AUTH_HEADER if its docs name a different header).'
        : res!.status === 403 ? 'The API key has no permission to send (scope or plan).' : res!.status === 409 ? 'The connected WhatsApp session is not ready. Open the gateway dashboard and reconnect the phone.' : res!.status === 429 ? 'The gateway is rate limiting you. Wait a while.'
        : res!.status === 422 ? `WhatsApp rejected this number or message: ${base}` : `The WhatsApp gateway refused it: ${base}`;
      throw new WhatsappError(hint.slice(0, 260), res!.status, [401, 403, 409, 429].includes(res!.status));
    }
    return json;
  }
  /** Asks the gateway which WhatsApp number/channel is connected (for the Test button). */
  async check() { if (!env.waGatewayOn) return { ok: env.waConfigured, mode: 'meta' }; const j = await this.gw('/v1/account/detail', { method: 'GET' }); return { ok: true, mode: 'gateway', account: j?.result ?? j }; }

  private async sendGateway(to: string, o: WaSend): Promise<{ messageId: string }> {
    const headers: Record<string, string> = o.key ? { 'Idempotency-Key': o.key } : {};
    let j: any;
    if (o.resume) {
      const fd = new FormData(); fd.append('receiverMobileNo', to); fd.append('message', o.text);
      fd.append('uploadFile', new Blob([new Uint8Array(o.resume.data)], { type: o.resume.mime }), o.resume.filename);
      j = await this.gw('/v1/message/create', { method: 'POST', headers, body: fd });
    } else j = await this.gw('/v1/message/create', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ receiverMobileNo: to, message: [o.text] }) });
    const id = j?.result?.id ?? j?.result?.groupId; if (!id) throw new WhatsappError('The WhatsApp gateway did not confirm the message.');
    return { messageId: String(id) };
  }

  /** Sends one message with the resume attached. Returns the provider's message id (it means "accepted", not "read"). */
  async send(o: WaSend): Promise<{ messageId: string }> {
    const to = normalizePhone(o.to, env.waDefaultCc); if (!to) throw new WhatsappError('That phone number looks invalid.');
    if (env.waGatewayOn) return this.sendGateway(to, o);
    const docId = o.resume ? await this.mediaId(o.resume) : null;
    const json = { 'Content-Type': 'application/json' };
    let body: any;
    if (env.waTemplate) {
      const components: any[] = [];
      if (docId && env.waTemplateDocHeader) components.push({ type: 'header', parameters: [{ type: 'document', document: { id: docId, filename: o.resume!.filename } }] });
      const vars = (o.vars ?? []).slice(0, env.waTemplateParams);
      if (env.waTemplateParams > 0) components.push({ type: 'body', parameters: Array.from({ length: env.waTemplateParams }, (_, i) => ({ type: 'text', text: (vars[i] || '-').replace(/[\n\t]+/g, ' ').slice(0, 120) })) });
      body = { messaging_product: 'whatsapp', to, type: 'template', template: { name: env.waTemplate, language: { code: env.waTemplateLang }, components } };
    } else if (docId) {
      body = { messaging_product: 'whatsapp', to, type: 'document', document: { id: docId, filename: o.resume!.filename, caption: o.text.slice(0, 1024) } };
    } else body = { messaging_product: 'whatsapp', to, type: 'text', text: { body: o.text.slice(0, 4000), preview_url: true } };
    const j = await this.call('messages', { method: 'POST', headers: json, body: JSON.stringify(body) });
    const id = j?.messages?.[0]?.id; if (!id) throw new WhatsappError('WhatsApp did not confirm the message.');
    // In template mode with no document header, also deliver the resume as a follow-up file (only allowed once the chat is open, so failure here is non-fatal).
    if (env.waTemplate && docId && !env.waTemplateDocHeader) await this.call('messages', { method: 'POST', headers: json, body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'document', document: { id: docId, filename: o.resume!.filename } }) }).catch(() => undefined);
    return { messageId: id };
  }

  /** Job Finder button: one WhatsApp message with the user's resume for a listed job. */
  async sendForJob(userId: string, dto: z.infer<typeof SendJobDto>) {
    if (!env.waConfigured) throw new BadRequestException('WhatsApp sending is not set up on the server yet. Add WHATSAPP_BASE_URL and WHATSAPP_API_KEY to .env.');
    const [job, u] = await Promise.all([this.jobs.findById(dto.jobId).lean(), this.users.findById(userId).lean()]);
    if (!job || !u) throw new NotFoundException('Job not found');
    const phone = normalizePhone(dto.phone || (job as any).contactPhone || '', env.waDefaultCc);
    if (!phone) throw new BadRequestException('This job has no valid phone number. Add the HR contact first.');
    const rid = dto.resumeId ?? (await this.settings.defaultResumeId(userId));
    const file = rid ? await this.resumes.file(userId, rid) : null;
    if (!file) throw new BadRequestException('Choose a resume that has its PDF uploaded. WhatsApp sends it as an attachment.');
    const meta = await this.resumes.pick(userId, rid ?? undefined); const sig = await this.settings.signatureFor(userId);
    const text = renderWhatsAppText({ senderName: u.name, role: job.title, company: job.company, skills: meta?.skills, links: urlsIn(sig ?? ''), custom: `I'm *${u.name}*. I'm interested in the *${job.title}* role at *${job.company}*, and I'm sharing my resume for your review.` });
    try {
      const r = await this.send({ to: phone, text, key: `job-${dto.jobId}-${phone}`, resume: file, vars: ['there', u.name, job.company ?? '', job.title ?? ''] });
      await this.audit.record({ userId, actor: 'user', action: 'whatsapp.sent', entityType: 'job', entityId: dto.jobId, result: 'success', meta: { to: `+${phone.slice(0, 4)}…${phone.slice(-2)}` } });
      return { ok: true, to: `+${phone}`, messageId: r.messageId };
    } catch (e: any) {
      const msg = String(e?.message ?? 'WhatsApp send failed');
      await this.audit.record({ userId, actor: 'user', action: 'whatsapp.failed', entityType: 'job', entityId: dto.jobId, result: 'failure', detail: msg });
      return { ok: false, message: msg };
    }
  }
}
