import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBusinessDays, businessDaysBetween } from './business-days.ts';

test('skips weekends', () => {
  // Friday 2026-10-23 + 1 business day = Monday 2026-10-26
  assert.equal(addBusinessDays(new Date('2026-10-23T00:00:00Z'), 1).toISOString().slice(0, 10), '2026-10-26');
  assert.equal(addBusinessDays(new Date('2026-10-22T00:00:00Z'), 5).toISOString().slice(0, 10), '2026-10-29');
});

test('skips listed holidays', () => {
  assert.equal(addBusinessDays(new Date('2026-10-22T00:00:00Z'), 2, ['2026-10-23']).toISOString().slice(0, 10), '2026-10-27');
});

test('zero days returns the same day', () => {
  assert.equal(addBusinessDays(new Date('2026-10-24T00:00:00Z'), 0).toISOString().slice(0, 10), '2026-10-24');
});

test('businessDaysBetween counts weekdays and is symmetric in sign', () => {
  const a = new Date('2026-10-19T00:00:00Z'), b = new Date('2026-10-26T00:00:00Z');
  assert.equal(businessDaysBetween(a, b), 5);
  assert.equal(businessDaysBetween(b, a), -5);
});
