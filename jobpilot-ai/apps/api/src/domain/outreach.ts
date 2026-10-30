/** Pure helpers for HR outreach: reading a pasted list of recipients, filling the template, and building the HTML email. */
// Same rule as gmail-format's EMAIL_RE (kept local so this file has no imports and stays testable on its own).
const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

export interface Recipient { email: string; name?: string; company?: string }
export interface ParseResult { valid: Recipient[]; invalid: { line: string; reason: string }[]; duplicates: number; truncated: number }

export const MAX_RECIPIENTS = 100;
const ANY_EMAIL = /[^\s@<>",;()\[\]]+@[^\s@<>",;()\[\]]+\.[^\s@<>",;()\[\]]+/;
const NOREPLY = /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster)@/i;
const tidy = (s: string) => s.replace(/["']/g, '').replace(/\s+/g, ' ').trim();

/**
 * Accepts one recipient per line (or separated by ; ,): `hr@acme.com`, `Priya Shah <priya@acme.com>`,
 * or CSV-style `priya@acme.com, Priya Shah, Acme`. A header row and blank lines are ignored.
 */
export function parseRecipients(text: string, opts: { selfEmail?: string; max?: number } = {}): ParseResult {
  const max = opts.max ?? MAX_RECIPIENTS; const self = opts.selfEmail?.toLowerCase();
  const out: ParseResult = { valid: [], invalid: [], duplicates: 0, truncated: 0 };
  const seen = new Set<string>();
  // Several bare addresses on one line ("a@x.com; b@y.com") become separate rows; a line with names/company stays one row.
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim(); if (!l) continue;
    const bare = l.split(/[;\s]+/).filter(Boolean);
    if (bare.length > 1 && bare.every((t) => EMAIL_RE.test(t.replace(/,$/, '')))) bare.forEach((t) => lines.push(t.replace(/,$/, ''))); else lines.push(l);
  }
  for (const line of lines) {
    if (/^\s*(e-?mail|email address)\b/i.test(line) && !ANY_EMAIL.test(line)) continue; // header row
    const m = line.match(ANY_EMAIL);
    if (!m) { out.invalid.push({ line: line.slice(0, 80), reason: 'No email address found' }); continue; }
    const email = m[0].toLowerCase().replace(/[.,;:]+$/, '');
    if (!EMAIL_RE.test(email)) { out.invalid.push({ line: line.slice(0, 80), reason: 'Not a valid email address' }); continue; }
    if (NOREPLY.test(email)) { out.invalid.push({ line: email, reason: 'No-reply address' }); continue; }
    if (self && email === self) { out.invalid.push({ line: email, reason: 'This is your own address' }); continue; }
    if (seen.has(email)) { out.duplicates++; continue; }
    seen.add(email);
    // Remaining text: either "Name <email>" or the other CSV cells.
    const rest = line.replace(m[0], '').replace(/[<>]/g, ' ');
    const cells = rest.split(/[,;\t|]/).map(tidy).filter(Boolean);
    const [name, company] = cells;
    if (out.valid.length >= max) { out.truncated++; continue; }
    out.valid.push({ email, ...(name ? { name: name.slice(0, 80) } : {}), ...(company ? { company: company.slice(0, 80) } : {}) });
  }
  return out;
}

/** {{name}}, {{first_name}}, {{company}} with polite fallbacks, so a missing cell never leaves a hole in the sentence. */
export function fillTemplate(t: string, r: Recipient): string {
  const name = r.name?.trim() || 'Hiring Team';
  const first = r.name?.trim() ? r.name.trim().split(/\s+/)[0] : 'there';
  const company = r.company?.trim() || 'your company';
  return t.replace(/\{\{\s*(name|first_name|company)\s*\}\}/gi, (_m, k: string) => ({ name, first_name: first, company } as Record<string, string>)[k.toLowerCase()]);
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Escapes first, then turns links and addresses into clickable ones. */
export function linkify(s: string): string {
  return esc(s).replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" style="color:#2563eb;text-decoration:none">${u.replace(/^https?:\/\//, '')}</a>`)
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+[\w]/g, (e) => (e.includes('</a>') ? e : `<a href="mailto:${e}" style="color:#2563eb;text-decoration:none">${e}</a>`));
}

export interface HtmlOpts { body: string; signature?: string; senderName: string; attachmentNames: string[]; preheader?: string }

/** A clean, mobile-friendly HTML email using inline styles only (what mail clients reliably support). All user text is escaped. */
export function renderOutreachHtml(o: HtmlOpts): string {
  const paras = o.body.trim().split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const body = paras.map((p, i) => `<p style="margin:0 0 16px;font-size:15.5px;line-height:1.7;color:#1f2937${i === 0 ? ';font-weight:600' : ''}">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const sig = (o.signature ?? '').trim();
  const sigHtml = sig
    ? `<div style="margin-top:22px;padding:14px 0 0 16px;border-left:3px solid #38bdf8;font-size:14px;line-height:1.7;color:#374151">${linkify(sig).replace(/\n/g, '<br>')}</div>`
    : `<div style="margin-top:22px;padding-left:16px;border-left:3px solid #38bdf8;font-size:14px;color:#374151">Best regards,<br><b>${esc(o.senderName)}</b></div>`;
  const chips = o.attachmentNames.length
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb"><div style="font-size:12px;color:#6b7280;margin-bottom:8px;letter-spacing:.04em;text-transform:uppercase">Attached</div>${o.attachmentNames.map((n) => `<span style="display:inline-block;margin:0 8px 8px 0;padding:7px 12px;border-radius:999px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:13px">&#128206; ${esc(n)}</span>`).join('')}</div>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader ?? '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(15,23,42,.08)">
<tr><td style="height:6px;background:linear-gradient(90deg,#3b82f6,#22d3ee,#8b5cf6);font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 30px 26px">${body}${sigHtml}${chips}</td></tr>
<tr><td style="padding:14px 30px;background:#f9fafb;border-top:1px solid #eef0f3;font-size:12px;line-height:1.5;color:#6b7280">Not the right person to write to? Just reply &ldquo;no thanks&rdquo; and I will not write again.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Plain-text twin of the HTML email (also the fallback for clients that do not show HTML). */
export function renderOutreachText(body: string, signature: string, senderName: string): string {
  return `${body.trim()}\n\n${signature.trim() || `Best regards,\n${senderName}`}\n\n--\nNot the right person? Reply "no thanks" and I will not write again.`;
}

/** Wait between two sends: base seconds plus up to 60% random jitter, so the pattern is human-like. */
export function nextGapMs(baseSec: number, rand: () => number = Math.random): number {
  const base = Math.max(10, baseSec);
  return Math.round((base + base * 0.6 * rand()) * 1000);
}

/** A starter message built only from facts the user has (name, role, skills). No claims are invented. */
export function starterTemplate(o: { name: string; role?: string; skills?: string[]; years?: number }): { subject: string; body: string } {
  const role = o.role?.trim() || 'a role that fits my background';
  const skills = (o.skills ?? []).slice(0, 5).join(', ');
  const exp = o.years && o.years > 0 ? ` with ${o.years}+ years of experience` : '';
  return {
    subject: `${o.role?.trim() ? `${o.role.trim()} candidate` : 'Job enquiry'} — ${o.name}`,
    body: `Hello {{name}},\n\nI hope you are doing well. I am ${o.name}, a ${o.role?.trim() || 'professional'}${exp}${skills ? `, working with ${skills}` : ''}. I am writing to ask whether {{company}} has openings for ${role}.\n\nMy resume is attached so you can see my projects and experience. If there is a suitable position now or in the near future, I would be glad to talk.\n\nThank you for your time.`,
  };
}
