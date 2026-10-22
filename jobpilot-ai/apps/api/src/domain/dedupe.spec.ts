import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeKey, normalizeUrl } from './dedupe.ts';

test('normalizeUrl strips tracking, www, fragment and trailing slash', () => {
  assert.equal(
    normalizeUrl('https://WWW.Example.com/jobs/42/?utm_source=x&b=2&a=1#apply'),
    'example.com/jobs/42?a=1&b=2',
  );
});

test('provider id beats everything else', () => {
  const a = dedupeKey({ source: 'api-x', providerJobId: '77', company: 'A', title: 'B' });
  const b = dedupeKey({ source: 'API-X', providerJobId: '77', company: 'Z', title: 'Q' });
  assert.equal(a, b);
});

test('same listing from two URL variants collapses to one key', () => {
  const a = dedupeKey({ applicationUrl: 'https://x.com/j/1?utm_campaign=a', company: 'C', title: 'T' });
  const b = dedupeKey({ applicationUrl: 'http://www.x.com/j/1/', company: 'C', title: 'T' });
  // scheme is intentionally ignored by normalizeUrl
  assert.equal(a, b);
});

test('without ids or URL, company/title/location define identity, case and punctuation insensitive', () => {
  const a = dedupeKey({ company: 'Orbit Pay', title: 'Backend Engineer', location: 'Pune' });
  const b = dedupeKey({ company: 'orbit  pay.', title: 'Backend-Engineer', location: 'PUNE' });
  const c = dedupeKey({ company: 'Orbit Pay', title: 'Backend Engineer', location: 'Delhi' });
  assert.equal(a, b);
  assert.notEqual(a, c);
});
