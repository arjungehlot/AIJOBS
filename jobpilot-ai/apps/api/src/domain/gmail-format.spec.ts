import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMime, extractText, parseAddress, EMAIL_RE } from './gmail-format.ts';

test('buildMime strips header injection from subject and recipient', () => {
  const raw = buildMime({ from: 'me@x.com', to: 'hr@y.com\r\nBcc: evil@z.com', subject: 'Hi\r\nBcc: evil@z.com', body: 'Hello', key: 'k1' });
  const head = raw.split('\r\n\r\n')[0];
  assert.ok(!/^Bcc:/im.test(head));
  assert.match(head, /Message-ID: <k1@jobpilot\.local>/);
});
test('buildMime encodes non-ASCII subjects and bodies', () => {
  const raw = buildMime({ from: 'a@b.com', to: 'c@d.com', subject: 'Résumé – Développeur', body: 'Grüße', key: 'k' });
  assert.match(raw, /Subject: =\?UTF-8\?B\?/);
  const body = raw.split('\r\n\r\n')[1].replace(/\r\n/g, '');
  assert.equal(Buffer.from(body, 'base64').toString('utf8'), 'Grüße');
});
test('extractText prefers text/plain and falls back to stripped html', () => {
  const b = (s: string) => Buffer.from(s).toString('base64url');
  const multi = { mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/html', body: { data: b('<p>HTML</p>') } }, { mimeType: 'text/plain', body: { data: b('Plain text') } }] };
  assert.equal(extractText(multi), 'Plain text');
  const htmlOnly = { mimeType: 'text/html', body: { data: b('<style>x{}</style><p>Hello&nbsp;<b>there</b></p>') } };
  assert.match(extractText(htmlOnly), /Hello\s+there/);
  assert.equal(extractText(undefined), '');
});

test('buildMime adds reply headers, stripped of newlines', () => {
  const raw = buildMime({ from: 'a@b.com', to: 'c@d.com', subject: 'Re: Hi', body: 'x', key: 'k', inReplyTo: '<abc@mail.gmail.com>\r\nBcc: z@z.com', references: '<abc@mail.gmail.com>' });
  const head = raw.split('\r\n\r\n')[0];
  assert.match(head, /^In-Reply-To: <abc@mail\.gmail\.com> Bcc: z@z\.com$/m);
  assert.ok(!/^Bcc:/im.test(head));
  assert.match(head, /^References: <abc@mail\.gmail\.com>$/m);
});
test('parseAddress handles names, quotes and bare addresses', () => {
  assert.deepEqual(parseAddress('"Priya Nair" <Priya@Acme.com>'), { name: 'Priya Nair', email: 'priya@acme.com' });
  assert.deepEqual(parseAddress('jobs@x.com'), { name: 'jobs@x.com', email: 'jobs@x.com' });
});
test('EMAIL_RE rejects injection attempts', () => {
  assert.ok(EMAIL_RE.test('a@b.co'));
  assert.ok(!EMAIL_RE.test('a@b.co, evil@x.com'));
  assert.ok(!EMAIL_RE.test('a@b.co\nBcc: x@y.com'));
});
