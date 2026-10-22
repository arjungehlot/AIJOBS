import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageDays, groupRates, rate, scoreBucket } from './stats.ts';
import { buildPrep } from './interview-prep.ts';

test('small samples are flagged, empty denominators give null', () => {
  assert.deepEqual(rate(3, 10), { n: 3, d: 10, pct: 30, lowSample: true });
  assert.equal(rate(0, 0).pct, null);
  assert.equal(rate(10, 40).lowSample, false);
});
test('groupRates groups and sorts by volume', () => {
  const g = groupRates([{ k: 'a', r: true }, { k: 'a', r: false }, { k: 'b', r: true }], (x) => x.k, (x) => x.r);
  assert.equal(g[0].key, 'a'); assert.equal(g[0].rate.pct, 50);
});
test('score buckets', () => {
  assert.deepEqual([90, 75, 60, 45, 10, undefined].map(scoreBucket), ['85+', '70–84', '55–69', '40–54', '0–39', 'Unscored']);
});
test('average days ignores negative intervals', () => {
  assert.equal(averageDays([{ from: new Date('2026-10-01'), to: new Date('2026-10-04') }, { from: new Date('2026-10-05'), to: new Date('2026-10-01') }]), 3);
  assert.equal(averageDays([]), null);
});
test('prep kit covers known skills, names gaps honestly and uses no invented facts', () => {
  const k = buildPrep({ title: 'Backend Engineer', company: 'Northwind', required: ['node.js', 'kubernetes'], preferred: ['graphql', 'cobol'], missingRequired: ['kubernetes'] });
  assert.deepEqual(k.technical.map((t) => t.skill), ['node.js', 'kubernetes', 'graphql']);
  assert.equal(k.gaps[0].skill, 'kubernetes');
  assert.match(k.gaps[0].talkingPoint, /not used kubernetes in production/);
  assert.ok(k.askThem.some((q) => q.includes('Northwind')));
});
