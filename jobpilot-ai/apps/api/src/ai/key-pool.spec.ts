import test from 'node:test';
import assert from 'node:assert/strict';
import { KeyPool, parseKeys } from './key-pool.ts';

test('parseKeys splits commas, spaces, semicolons and newlines, drops quotes and duplicates', () => {
  assert.deepEqual(parseKeys('a1, "b2";c3\nd4', 'a1', undefined), ['a1', 'b2', 'c3', 'd4']);
  assert.deepEqual(parseKeys(''), []);
});
test('rotates: after a key is used the next one goes first', () => {
  const p = new KeyPool(['k1', 'k2', 'k3']);
  assert.deepEqual(p.available(), ['k1', 'k2', 'k3']);
  p.used('k1'); assert.deepEqual(p.available(), ['k2', 'k3', 'k1']);
  p.used('k3'); assert.deepEqual(p.available(), ['k1', 'k2', 'k3']);
});
test('a limited key is skipped until its cooldown ends, then comes back', () => {
  const p = new KeyPool(['k1', 'k2']); const t = 1_000_000;
  p.limited('k1', 60, t);
  assert.deepEqual(p.available(t + 1000), ['k2']);
  assert.equal(p.status(t + 1000)[0].state, 'cooling');
  assert.deepEqual(p.available(t + 61_000), ['k1', 'k2']);
});
test('an invalid key is never used again; all invalid is detectable', () => {
  const p = new KeyPool(['k1', 'k2']);
  p.invalid('k1'); assert.deepEqual(p.available(), ['k2']); assert.equal(p.allInvalid(), false);
  p.invalid('k2'); assert.deepEqual(p.available(), []); assert.equal(p.allInvalid(), true); assert.equal(p.soonestRetrySec(), null);
});
test('soonestRetrySec reports when the first limited key frees up', () => {
  const p = new KeyPool(['k1', 'k2']); const t = 5_000_000;
  p.limited('k1', 90, t); p.limited('k2', 30, t);
  assert.equal(p.soonestRetrySec(t), 30);
});
test('status never contains a whole key', () => {
  const s = JSON.stringify(new KeyPool(['AIzaSyABCDEFGHIJKLMNOP1234']).status());
  assert.ok(!s.includes('AIzaSyABCDEFGHIJKLMNOP1234')); assert.match(s, /1234/);
});
