/** Pure helpers for building and reading Gmail messages. No network, no framework. */
export const MSGID_DOMAIN = 'jobpilot.local';
export const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim(); // blocks header injection
const encWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`);

export interface MimeAttachment { filename: string; mime: string; data: Buffer }
const wrap76 = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/(.{76})/g, '$1\r\n');
const safeName = (n: string) => n.replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || 'attachment';

/**
 * Builds an RFC 5322 message. Plain text only, or multipart/mixed when attachments are given.
 * The Message-ID carries the idempotency key so findSent can locate it.
 */
export function buildMime(m: { from: string; to: string; subject: string; body: string; key: string; inReplyTo?: string; references?: string; attachments?: MimeAttachment[] }): string {
  const head = [
    `From: ${clean(m.from)}`, `To: ${clean(m.to)}`, `Subject: ${encWord(clean(m.subject))}`,
    `Message-ID: <${m.key}@${MSGID_DOMAIN}>`,
    ...(m.inReplyTo ? [`In-Reply-To: ${clean(m.inReplyTo)}`] : []),
    ...(m.references ? [`References: ${clean(m.references)}`] : []),
    'MIME-Version: 1.0',
  ];
  const text = wrap76(m.body.replace(/\r?\n/g, '\r\n'));
  if (!m.attachments?.length) {
    return [...head, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', text].join('\r\n');
  }
  const b = `jp_${m.key.slice(0, 24)}`;
  const parts: string[] = [
    ...head, `Content-Type: multipart/mixed; boundary="${b}"`, '',
    `--${b}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', text,
  ];
  for (const a of m.attachments) {
    const n = safeName(a.filename);
    parts.push(`--${b}`, `Content-Type: ${clean(a.mime)}; name="${n}"`, `Content-Disposition: attachment; filename="${n}"`, 'Content-Transfer-Encoding: base64', '', wrap76(a.data));
  }
  parts.push(`--${b}--`, '');
  return parts.join('\r\n');
}


/** Plain text of a Gmail payload, falling back to tag-stripped HTML. */
export function extractText(p: any): string {
  if (!p) return '';
  const dec = (d?: string) => (d ? Buffer.from(d, 'base64url').toString('utf8') : '');
  const walk = (n: any, mime: string): string => {
    if (n.mimeType === mime && n.body?.data) return dec(n.body.data);
    for (const c of n.parts ?? []) { const r = walk(c, mime); if (r) return r; }
    return '';
  };
  const plain = walk(p, 'text/plain');
  if (plain.trim()) return plain;
  return walk(p, 'text/html').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

/** "Jane Doe <jane@x.com>" -> { name, email }. Tolerates bare addresses and quotes. */
export function parseAddress(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : raw).trim().toLowerCase();
  return { name: (m?.[1] ?? '').trim() || email, email };
}

export const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;
