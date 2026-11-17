import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPhone, fillWa, isPhoneOnly, normalizePhone, renderWhatsAppText, fillTemplate, linkify, nextGapMs, parseRecipients, renderOutreachHtml, renderOutreachText, starterTemplate } from './outreach.ts';
import { buildMime } from './gmail-format.ts';

test('parses plain, named and CSV lines, dedupes and flags bad rows', () => {
  const r = parseRecipients('Email, Name, Company\nhr@acme.com\nPriya Shah <priya@zeta.io>\njob@x.in, Ravi, X Corp\nHR@ACME.COM\nnot an email\nnoreply@big.com\nme@mine.com', { selfEmail: 'me@mine.com' });
  assert.deepEqual(r.valid.map((v) => v.email), ['hr@acme.com', 'priya@zeta.io', 'job@x.in']);
  assert.equal(r.valid[1].name, 'Priya Shah'); assert.equal(r.valid[2].company, 'X Corp');
  assert.equal(r.duplicates, 1); assert.equal(r.invalid.length, 3);
});
test('several bare addresses on one line become separate rows, and the cap truncates', () => {
  assert.equal(parseRecipients('a@x.com; b@y.com c@z.com').valid.length, 3);
  const many = Array.from({ length: 12 }, (_, i) => `u${i}@x.com`).join('\n');
  const r = parseRecipients(many, { max: 10 }); assert.equal(r.valid.length, 10); assert.equal(r.truncated, 2);
});
test('template fills name, first name and company with polite fallbacks', () => {
  assert.equal(fillTemplate('Hello {{name}} at {{company}}', { email: 'a@b.c' }), 'Hello Hiring Team at your company');
  assert.equal(fillTemplate('Hi {{first_name}}, {{ company }}', { email: 'a@b.c', name: 'Priya Shah', company: 'Zeta' }), 'Hi Priya, Zeta');
});
test('HTML email escapes everything and lists attachments', () => {
  const h = renderOutreachHtml({ body: 'Hello <b>x</b>\n\nSecond "para"', signature: 'Arjun\nhttps://arjun.in\nme@x.com', senderName: 'Arjun', attachmentNames: ['Resume.pdf'] });
  assert.ok(!h.includes('<b>x</b>')); assert.ok(h.includes('&lt;b&gt;x&lt;/b&gt;')); assert.ok(h.includes('Resume.pdf')); assert.ok(h.includes('mailto:me@x.com')); assert.ok(h.includes('href="https://arjun.in"'));
  assert.match(linkify('<script>'), /&lt;script&gt;/);
  assert.match(renderOutreachText('Hi', '', 'Arjun'), /Best regards,\nArjun/);
});
test('gap has jitter and a floor', () => {
  assert.equal(nextGapMs(45, () => 0), 45000); assert.equal(nextGapMs(45, () => 1), 72000); assert.equal(nextGapMs(1, () => 0), 10000);
});
test('starter template uses only known facts', () => {
  const t = starterTemplate({ name: 'Arjun', role: 'Full Stack Developer', skills: ['Node.js', 'React'], years: 2 });
  assert.match(t.body, /Node\.js, React/); assert.match(t.body, /\{\{company\}\}/); assert.match(t.subject, /Arjun/);
});
test('buildMime: html adds a multipart/alternative part, and attachments wrap it in mixed', () => {
  const m = buildMime({ from: 'a@b.c', to: 'd@e.f', subject: 'Hi', body: 'plain', html: '<p>rich</p>', key: 'k'.repeat(32), attachments: [{ filename: 'r.pdf', mime: 'application/pdf', data: Buffer.from('%PDF-1') }] });
  assert.match(m, /multipart\/mixed/); assert.match(m, /multipart\/alternative/); assert.match(m, /text\/html/); assert.match(m, /filename="r\.pdf"/);
  const plain = buildMime({ from: 'a@b.c', to: 'd@e.f', subject: 'Hi', body: 'plain', key: 'k'.repeat(32) });
  assert.match(plain, /text\/plain/); assert.ok(!/multipart/.test(plain));
});


test('normalizes phone numbers (India default, international kept, junk rejected)', () => {
  assert.equal(normalizePhone('98765 43210'), '919876543210');
  assert.equal(normalizePhone('+91 98765-43210'), '919876543210');
  assert.equal(normalizePhone('09876543210'), '919876543210');
  assert.equal(normalizePhone('+1 (415) 555-2671'), '14155552671');
  assert.equal(normalizePhone('00447911123456'), '447911123456');
  assert.equal(normalizePhone('1234567890'), null); // 10 digits that cannot be an Indian mobile
  assert.equal(normalizePhone('2024'), null);
  assert.equal(extractPhone('Priya Shah, call 98765 43210').phone, '919876543210');
});

test('recipients can have an email, a phone, or both', () => {
  const r = parseRecipients('Priya Shah, priya@zeta.io, +91 98765 43210, Zeta\n98111 22233, Ravi\nContact: hr@acme.com or call 99887 76655 for details about this role\nname only\n98111 22233');
  assert.equal(r.valid.length, 3);
  assert.deepEqual([r.valid[0].email, r.valid[0].phone, r.valid[0].name, r.valid[0].company], ['priya@zeta.io', '919876543210', 'Priya Shah', 'Zeta']);
  assert.ok(isPhoneOnly(r.valid[1].email)); assert.equal(r.valid[1].phone, '919811122233'); assert.equal(r.valid[1].name, 'Ravi');
  assert.equal(r.valid[2].email, 'hr@acme.com'); assert.equal(r.valid[2].phone, '919988776655'); assert.equal(r.valid[2].name, undefined); // a sentence is not a name
  assert.equal(r.duplicates, 1); assert.equal(r.invalid.length, 1);
});

test('WhatsApp message is tidy, personal and within the caption limit', () => {
  const t = renderWhatsAppText({ recipientName: 'Priya Shah', company: 'Zeta', senderName: 'Arjun', skills: ['React', 'Node.js'], links: ['https://github.com/arjun'] });
  assert.match(t, /^👋 Hello Priya,/); assert.match(t, /\*Zeta\*/); assert.match(t, /\*My resume is attached\*/); assert.match(t, /React · Node\.js/); assert.match(t, /github\.com\/arjun/);
  assert.ok(renderWhatsAppText({ senderName: 'A', custom: 'x'.repeat(3000) }).length <= 1000);
  assert.equal(fillWa('Hi {{first_name}} at {{company}}', {}), 'Hi there at your company');
});
