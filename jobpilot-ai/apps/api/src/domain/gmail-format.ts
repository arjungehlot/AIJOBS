/** Pure helpers for building and reading Gmail messages. No network, no framework. */
export const MSGID_DOMAIN = 'jobpilot.local';
export const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim(); // blocks header injection
const encWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`);

/** Builds a plain-text RFC 5322 message. The Message-ID carries the idempotency key so findSent can locate it. */
export function buildMime(m: { from: string; to: string; subject: string; body: string; key: string; inReplyTo?: string; references?: string }): string {
  const lines = [
    `From: ${clean(m.from)}`, `To: ${clean(m.to)}`, `Subject: ${encWord(clean(m.subject))}`,
    `Message-ID: <${m.key}@${MSGID_DOMAIN}>`,
    ...(m.inReplyTo ? [`In-Reply-To: ${clean(m.inReplyTo)}`] : []),
    ...(m.references ? [`References: ${clean(m.references)}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '',
    Buffer.from(m.body.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
  ];
  return lines.join('\r\n');
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
