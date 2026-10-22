import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuotaError, quotaMessage } from './gemini-errors.ts';

const body = (quotaId: string, quotaValue: string, retry?: string) => ({ error: { code: 429, message: 'You exceeded your current quota.', details: [
  { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId, quotaValue }] },
  ...(retry ? [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: retry }] : [])] } });

test('per-minute limit with a retry delay', () => {
  const q = parseQuotaError(body('GenerateRequestsPerMinutePerProjectPerModel-FreeTier', '10', '12.4s'));
  assert.equal(q.scope, 'minute'); assert.equal(q.retryAfterSec, 13); assert.equal(q.noFreeQuota, false);
  assert.match(quotaMessage('m', q, false), /last minute.*13 seconds/);
});
test('daily limit is reported as such', () => {
  const q = parseQuotaError(body('GenerateRequestsPerDayPerProjectPerModel-FreeTier', '250'));
  assert.equal(q.scope, 'day'); assert.match(quotaMessage('m', q, true), /Today's free quota.*used up/);
});
test('a limit of 0 means this key has no free quota for the model', () => {
  const q = parseQuotaError(body('GenerateRequestsPerDayPerProjectPerModel-FreeTier', '0'));
  assert.equal(q.noFreeQuota, true); assert.match(quotaMessage('gemini-2.5-pro', q, false), /no free quota/);
});
test('odd or empty bodies never throw', () => { assert.equal(parseQuotaError(null).scope, 'unknown'); assert.equal(parseQuotaError({ error: { message: 'limit: 0, model: x' } }).noFreeQuota, true); });
