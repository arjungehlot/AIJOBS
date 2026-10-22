import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import jwt from 'jsonwebtoken';
import { Model } from 'mongoose';
import { Application } from '../applications/application.schema';
import { AuditService } from '../audit/audit.service';
import { env } from '../common/env';
import { decryptSecret, encryptSecret } from '../domain/crypto';
import { EMAIL_RE, buildMime, extractText, parseAddress } from '../domain/gmail-format';
import { classifyReply } from '../domain/reply-classifier';
import { InboundMessage } from '../inbox/message.schema';
import { MailAccount } from './mail-account.schema';
import { MailOutcomeUnknownError, MailRejectedError, OutgoingMail, SentMail } from './mail.provider';

const SCOPES = [
  'openid', 'email',
  'https://www.googleapis.com/auth/gmail.send',     // send the applications you approve
  'https://www.googleapis.com/auth/gmail.readonly', // read replies in threads of applications you sent
];
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
import { MSGID_DOMAIN } from '../domain/gmail-format';
import { randomUUID } from 'node:crypto';

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

interface Tok { value: string; exp: number }

@Injectable()
export class GmailService {
  private readonly cache = new Map<string, Tok>();
  constructor(
    @InjectModel(MailAccount.name) private readonly accounts: Model<MailAccount>,
    @InjectModel(InboundMessage.name) private readonly inbound: Model<InboundMessage>,
    @InjectModel(Application.name) private readonly apps: Model<Application>,
    private readonly audit: AuditService,
  ) {}

  // ---- connection ----
  async status(userId: string) {
    const a = await this.accounts.findOne({ userId, provider: 'gmail' }).lean();
    return {
      configured: env.gmailConfigured, mailMode: env.mailProvider, redirectUri: env.gmailRedirectUri,
      connected: !!a && a.status === 'active', email: a?.email ?? null, accountStatus: a?.status ?? null,
      lastError: a?.lastError ?? null, lastSyncAt: a?.lastSyncAt ?? null,
    };
  }

  connectUrl(userId: string): string {
    if (!env.gmailConfigured) throw new BadRequestException('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set on the server');
    const state = jwt.sign({ sub: userId, purpose: 'gmail_connect' }, env.authSecret, { expiresIn: '10m' });
    const q = new URLSearchParams({
      client_id: env.googleClientId, redirect_uri: env.gmailRedirectUri, response_type: 'code', scope: SCOPES.join(' '),
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }

  /** Returns a web path to redirect the browser to. Never throws raw provider errors to the page. */
  async handleCallback(code?: string, state?: string, error?: string): Promise<string> {
    const back = (q: string) => `${env.webUrl}/settings/email?${q}`;
    if (error) return back(`error=${encodeURIComponent(error === 'access_denied' ? 'You declined access' : 'Google returned an error')}`);
    let userId: string;
    try {
      const p = jwt.verify(state ?? '', env.authSecret) as jwt.JwtPayload;
      if (p.purpose !== 'gmail_connect') throw new Error('bad purpose');
      userId = String(p.sub);
    } catch { return back('error=' + encodeURIComponent('The connection link expired. Please try again')); }
    if (!code) return back('error=' + encodeURIComponent('Missing authorization code'));
    try {
      const tok = await this.tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: env.gmailRedirectUri });
      if (!tok.refresh_token) return back('error=' + encodeURIComponent('Google did not return a refresh token. Remove JobPilot from your Google account permissions and connect again'));
      const granted = String(tok.scope ?? '').split(' ');
      if (!granted.includes(SCOPES[2])) return back('error=' + encodeURIComponent('Sending permission was not granted. Please tick every box on the Google screen'));
      const info = await this.json(await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { authorization: `Bearer ${tok.access_token}` } }));
      if (!info.email) throw new Error('no email');
      await this.accounts.findOneAndUpdate(
        { userId, provider: 'gmail' },
        { $set: { email: String(info.email).toLowerCase(), refreshTokenEnc: encryptSecret(tok.refresh_token, env.tokenKey), scopes: granted, status: 'active' }, $unset: { lastError: '' } },
        { upsert: true },
      );
      this.cache.delete(userId);
      await this.audit.record({ userId, actor: 'user', action: 'mail.gmail_connected', entityType: 'mail_account', entityId: userId, result: 'success', meta: { email: info.email } });
      return back('connected=1');
    } catch {
      await this.audit.record({ userId, actor: 'integration', action: 'mail.gmail_connect', entityType: 'mail_account', entityId: userId, result: 'failure' });
      return back('error=' + encodeURIComponent('Could not complete the Google connection. Check the client ID, secret and redirect URI'));
    }
  }

  async disconnect(userId: string) {
    const a = await this.accounts.findOne({ userId, provider: 'gmail' });
    if (a) {
      try { await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: decryptSecret(a.refreshTokenEnc, env.tokenKey) }) }); } catch { /* best effort */ }
      await a.deleteOne();
    }
    this.cache.delete(userId);
    await this.audit.record({ userId, actor: 'user', action: 'mail.gmail_disconnected', entityType: 'mail_account', entityId: userId, result: 'success' });
    return { connected: false };
  }

  async hasAccount(userId: string) { return !!(await this.accounts.exists({ userId, provider: 'gmail', status: 'active' })); }

  // ---- sending ----
  async send(userId: string, m: OutgoingMail): Promise<SentMail> {
    const acct = await this.accounts.findOne({ userId, provider: 'gmail', status: 'active' }).lean();
    if (!acct) throw new MailRejectedError('Connect your Gmail account first (Email setup)');
    let access: string;
    try { access = await this.accessToken(userId, acct); }
    catch { throw new MailRejectedError('Gmail access expired. Reconnect your account in Email setup'); } // nothing was sent
    const raw = b64url(buildMime({ from: acct.email, to: m.to, subject: m.subject, body: m.body, key: m.idempotencyKey }));
    let res: Response;
    try {
      res = await fetch(`${GMAIL}/messages/send`, {
        method: 'POST', headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
        body: JSON.stringify({ raw }), signal: AbortSignal.timeout(20_000),
      });
    } catch { throw new MailOutcomeUnknownError('No response from Gmail. The message may or may not have been sent'); }
    if (res.ok) { const j: any = await res.json(); return { messageId: j.id, threadId: j.threadId }; }
    if (res.status >= 500) throw new MailOutcomeUnknownError(`Gmail error ${res.status}`);
    if (res.status === 401) { this.cache.delete(userId); throw new MailRejectedError('Gmail rejected the credentials. Reconnect your account'); }
    if (res.status === 429) throw new MailRejectedError('Gmail rate limit reached. Try again later');
    throw new MailRejectedError(`Gmail refused the message (${res.status})`);
  }

  async findSent(userId: string, key: string): Promise<SentMail | null> {
    const acct = await this.accounts.findOne({ userId, provider: 'gmail', status: 'active' }).lean();
    if (!acct) return null;
    const access = await this.accessToken(userId, acct);
    const q = new URLSearchParams({ q: `rfc822msgid:${key}@${MSGID_DOMAIN} in:sent`, maxResults: '1' });
    const j: any = await this.json(await fetch(`${GMAIL}/messages?${q}`, { headers: { authorization: `Bearer ${access}` } }));
    const hit = j.messages?.[0];
    return hit ? { messageId: hit.id, threadId: hit.threadId } : null;
  }

  // ---- reading replies ----
  /** Imports replies from threads of applications you sent. Never changes an application status. */
  async sync(userId: string) {
    const acct = await this.accounts.findOne({ userId, provider: 'gmail', status: 'active' }).lean();
    if (!acct) throw new BadRequestException('Connect your Gmail account first');
    if (!acct.scopes.includes('https://www.googleapis.com/auth/gmail.readonly')) throw new BadRequestException('Reading permission was not granted. Reconnect and tick every box');
    const access = await this.accessToken(userId, acct);
    const since = new Date(Date.now() - 60 * 86_400_000);
    const sent = await this.apps.find({ userId, providerThreadId: { $exists: true }, sentAt: { $gte: since } }).sort({ sentAt: -1 }).limit(30).select('providerThreadId').lean();
    let imported = 0, checked = 0;
    for (const a of sent) {
      checked++;
      const t: any = await this.json(await fetch(`${GMAIL}/threads/${a.providerThreadId}?format=full`, { headers: { authorization: `Bearer ${access}` } })).catch(() => null);
      for (const msg of t?.messages ?? []) {
        if ((msg.labelIds ?? []).includes('SENT')) continue;
        const h = (n: string) => (msg.payload?.headers ?? []).find((x: any) => x.name.toLowerCase() === n)?.value as string | undefined;
        const fromRaw = h('from') ?? '';
        const fromEmail = (fromRaw.match(/<([^>]+)>/)?.[1] ?? fromRaw).trim().toLowerCase();
        if (fromEmail === acct.email) continue;
        const subject = (h('subject') ?? '(no subject)').slice(0, 300);
        const body = extractText(msg.payload).slice(0, 20_000) || (msg.snippet ?? '');
        if (body.trim().length < 5) continue;
        try {
          await this.inbound.create({
            userId, applicationId: a._id, source: 'gmail', gmailMessageId: msg.id, fromEmail: fromEmail.slice(0, 320), subject, body,
            receivedAt: new Date(Number(msg.internalDate) || Date.now()), analysis: classifyReply({ subject, body, from: fromEmail }),
          });
          imported++;
        } catch (e: any) { if (e?.code !== 11000) throw e; } // already imported
      }
    }
    await this.accounts.updateOne({ userId, provider: 'gmail' }, { $set: { lastSyncAt: new Date() } });
    await this.audit.record({ userId, actor: 'integration', action: 'mail.gmail_sync', entityType: 'mail_account', entityId: userId, result: 'success', meta: { threads: checked, imported } });
    return { threadsChecked: checked, imported };
  }

  // ---- mailbox ----
  private async authed(userId: string, needRead = true) {
    const acct = await this.accounts.findOne({ userId, provider: 'gmail', status: 'active' }).lean();
    if (!acct) throw new BadRequestException('Connect your Gmail account first (Email Setup)');
    if (needRead && !acct.scopes.includes('https://www.googleapis.com/auth/gmail.readonly')) throw new BadRequestException('Reading permission was not granted. Reconnect and tick every box');
    try { return { acct, access: await this.accessToken(userId, acct) }; }
    catch { throw new BadRequestException('Gmail access expired. Reconnect your account in Email Setup'); }
  }
  private gget(access: string, path: string) { return fetch(`${GMAIL}${path}`, { headers: { authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(20_000) }).then((r) => this.json(r)); }

  async listMessages(userId: string, q: { folder: 'inbox' | 'sent' | 'all'; q?: string; pageToken?: string }) {
    const { access } = await this.authed(userId);
    const params = new URLSearchParams({ maxResults: '20' });
    if (q.folder === 'inbox') params.append('labelIds', 'INBOX');
    if (q.folder === 'sent') params.append('labelIds', 'SENT');
    if (q.q) params.set('q', q.q);
    if (q.pageToken) params.set('pageToken', q.pageToken);
    const list: any = await this.gget(access, `/messages?${params}`).catch(() => { throw new BadRequestException('Could not read your mailbox from Gmail'); });
    const meta = (id: string) => this.gget(access, `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`).catch(() => null);
    const full = (await Promise.all((list.messages ?? []).map((m: any) => meta(m.id)))).filter(Boolean) as any[];
    const items = full.map((m) => {
      const h = (n: string) => (m.payload?.headers ?? []).find((x: any) => x.name.toLowerCase() === n)?.value ?? '';
      const from = parseAddress(h('from'));
      return { id: m.id, threadId: m.threadId, from, to: h('to').slice(0, 200), subject: h('subject') || '(no subject)', snippet: m.snippet ?? '', date: new Date(Number(m.internalDate) || Date.now()), unread: (m.labelIds ?? []).includes('UNREAD'), sent: (m.labelIds ?? []).includes('SENT') };
    });
    return { items, nextPageToken: list.nextPageToken ?? null };
  }

  /** Whole conversation as plain text. HTML is never returned, so nothing from an email can run in the page. */
  async getThread(userId: string, threadId: string) {
    const { acct, access } = await this.authed(userId);
    const t: any = await this.gget(access, `/threads/${encodeURIComponent(threadId)}?format=full`).catch(() => { throw new NotFoundException('Conversation not found'); });
    const messages = (t.messages ?? []).map((m: any) => {
      const h = (n: string) => (m.payload?.headers ?? []).find((x: any) => x.name.toLowerCase() === n)?.value ?? '';
      const atts: string[] = []; const walk = (p: any) => { if (p?.filename) atts.push(p.filename); (p?.parts ?? []).forEach(walk); }; walk(m.payload);
      return { id: m.id, from: parseAddress(h('from')), to: h('to').slice(0, 300), subject: h('subject') || '(no subject)', date: new Date(Number(m.internalDate) || Date.now()), mine: parseAddress(h('from')).email === acct.email,
        body: (extractText(m.payload) || m.snippet || '').slice(0, 30_000), attachments: atts, messageIdHeader: h('message-id') };
    });
    return { threadId, messages };
  }

  /** Reply status for sent conversations. Based on whether anyone other than you wrote in the thread. No tracking pixels. */
  async tracking(userId: string, threadIds: string[]) {
    const { acct, access } = await this.authed(userId);
    const out: Record<string, { replied: boolean; replies: number; lastReplyAt: Date | null; messages: number }> = {};
    await Promise.all(threadIds.slice(0, 20).map(async (id) => {
      const t: any = await this.gget(access, `/threads/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From`).catch(() => null);
      if (!t) return;
      const theirs = (t.messages ?? []).filter((m: any) => parseAddress((m.payload?.headers ?? []).find((x: any) => x.name.toLowerCase() === 'from')?.value ?? '').email !== acct.email);
      out[id] = { replied: theirs.length > 0, replies: theirs.length, lastReplyAt: theirs.length ? new Date(Number(theirs[theirs.length - 1].internalDate)) : null, messages: (t.messages ?? []).length };
    }));
    return out;
  }

  /** User-written mail (compose or reply). Only real when MAIL_PROVIDER=gmail; capped per day. */
  async compose(userId: string, d: { to: string; subject: string; body: string; threadId?: string }) {
    if (env.mailProvider !== 'gmail') throw new BadRequestException('Test mode: set MAIL_PROVIDER=gmail in the API .env and restart to send real email');
    if (!EMAIL_RE.test(d.to)) throw new BadRequestException('Enter one valid recipient address');
    const since = new Date(Date.now() - 86_400_000);
    if ((await this.audit.countSince(userId, 'mail.composed', since)) >= 50) throw new BadRequestException('Daily limit of 50 messages reached');
    const { acct, access } = await this.authed(userId, false);
    let inReplyTo: string | undefined, references: string | undefined;
    if (d.threadId) {   // headers come from Gmail, never from the browser
      const t: any = await this.gget(access, `/threads/${encodeURIComponent(d.threadId)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`).catch(() => null);
      const last = t?.messages?.[t.messages.length - 1];
      const hv = (n: string) => last?.payload?.headers?.find((x: any) => x.name.toLowerCase() === n)?.value as string | undefined;
      inReplyTo = hv('message-id'); references = [hv('references'), inReplyTo].filter(Boolean).join(' ') || undefined;
    }
    const raw = b64url(buildMime({ from: acct.email, to: d.to, subject: d.subject, body: d.body, key: randomUUID(), inReplyTo, references }));
    let res: Response;
    try { res = await fetch(`${GMAIL}/messages/send`, { method: 'POST', headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' }, body: JSON.stringify({ raw, ...(d.threadId ? { threadId: d.threadId } : {}) }), signal: AbortSignal.timeout(20_000) }); }
    catch { throw new BadRequestException('No response from Gmail. Check your Sent folder before trying again, so it is not sent twice'); }
    if (!res.ok) throw new BadRequestException(res.status === 401 ? 'Gmail rejected the credentials. Reconnect your account' : `Gmail refused the message (${res.status})`);
    const j: any = await res.json();
    await this.audit.record({ userId, actor: 'user', action: 'mail.composed', entityType: 'mail_account', entityId: userId, result: 'success', meta: { to: d.to, threadId: j.threadId, reply: !!d.threadId } });
    return { id: j.id, threadId: j.threadId };
  }

  // ---- internals ----
  private async accessToken(userId: string, acct: { refreshTokenEnc: string }): Promise<string> {
    const c = this.cache.get(userId);
    if (c && c.exp > Date.now() + 30_000) return c.value;
    let tok: any;
    try { tok = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: decryptSecret(acct.refreshTokenEnc, env.tokenKey) }); }
    catch (e) {
      await this.accounts.updateOne({ userId, provider: 'gmail' }, { $set: { status: 'error', lastError: 'Google refused the saved access. Reconnect your account' } });
      throw e;
    }
    this.cache.set(userId, { value: tok.access_token, exp: Date.now() + Number(tok.expires_in ?? 3000) * 1000 });
    return tok.access_token;
  }

  private async tokenRequest(params: Record<string, string>) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(15_000),
      body: new URLSearchParams({ client_id: env.googleClientId, client_secret: env.googleClientSecret, ...params }),
    });
    return this.json(res);
  }

  private async json(res: Response): Promise<any> {
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`HTTP ${res.status}`); // body deliberately not included: it can echo secrets
    return j;
  }
}
