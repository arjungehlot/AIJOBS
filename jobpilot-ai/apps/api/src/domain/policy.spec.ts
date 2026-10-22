import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, type AgentRules, type JobContext } from './policy.ts';

const rules: AgentRules = { mode: 'copilot', paused: false, minScore: 70, autoSendMinScore: 85, maxPerDay: 10, maxPerCompany30d: 1, autoSendEnabled: true, windowStartHour: 9, windowEndHour: 18 };
const ctx: JobContext = { score: 90, recommendation: 'apply', mandatoryFailures: [], alreadyApplied: false, sentToday: 0, sentToCompany30d: 0,
  recipient: { email: 'jobs@x.com', confidence: 'verified' }, hasResume: true, hourNow: 11, jobActive: true };

test('copilot prepares a draft and never sends', () => assert.equal(decide(rules, ctx).action, 'draft'));
test('manual mode only recommends', () => assert.equal(decide({ ...rules, mode: 'manual' }, ctx).action, 'recommend'));
test('autonomous sends only when every gate passes', () => assert.equal(decide({ ...rules, mode: 'autonomous' }, ctx).action, 'auto_send'));

test('autonomous falls back to a draft with every reason listed', () => {
  const d = decide({ ...rules, mode: 'autonomous' }, { ...ctx, score: 78, hourNow: 22, recipient: { email: 'a@b.c', confidence: 'inferred' }, sentToday: 10 });
  assert.equal(d.action, 'draft');
  assert.ok(d.reasons.length >= 5);
});

test('autonomous with auto-send switched off still never sends', () =>
  assert.equal(decide({ ...rules, mode: 'autonomous', autoSendEnabled: false }, ctx).action, 'draft'));

test('skips below threshold, duplicates, exclusions and inactive jobs', () => {
  assert.equal(decide(rules, { ...ctx, score: 50 }).action, 'skip');
  assert.equal(decide(rules, { ...ctx, alreadyApplied: true }).action, 'skip');
  assert.equal(decide(rules, { ...ctx, mandatoryFailures: ['Excluded company'] }).action, 'skip');
  assert.equal(decide(rules, { ...ctx, jobActive: false }).action, 'skip');
});

test('paused agent holds everything that would qualify', () => assert.equal(decide({ ...rules, paused: true }, ctx).action, 'hold'));
test('company limit holds the job', () => assert.equal(decide(rules, { ...ctx, sentToCompany30d: 1 }).action, 'hold'));
test('no recipient or resume holds the job', () => {
  assert.equal(decide(rules, { ...ctx, recipient: undefined }).action, 'hold');
  assert.equal(decide(rules, { ...ctx, hasResume: false }).action, 'hold');
});
test('overnight run windows wrap past midnight', () => {
  const r = { ...rules, mode: 'autonomous' as const, windowStartHour: 22, windowEndHour: 6 };
  assert.equal(decide(r, { ...ctx, hourNow: 23 }).action, 'auto_send');
  assert.equal(decide(r, { ...ctx, hourNow: 12 }).action, 'draft');
});
