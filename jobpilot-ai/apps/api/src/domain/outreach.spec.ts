import test from 'node:test';
import assert from 'node:assert/strict';
import { fillTemplate, linkify, nextGapMs, parseRecipients, renderOutreachHtml, renderOutreachText, starterTemplate } from './outreach.ts';
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
  assert.equal(nextGapMs(45, () => 0), 45000); assert.equal(nextGapMs(45, () => 1), 72000); assert.equal(nextGapMs(1, () => 0), 20000);
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
