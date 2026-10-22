import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertTransition, canTransition } from './application-state.ts';

test('happy path through sending', () => {
  assert.ok(canTransition('draft', 'awaiting_approval'));
  assert.ok(canTransition('awaiting_approval', 'approved'));
  assert.ok(canTransition('approved', 'sending'));
  assert.ok(canTransition('sending', 'applied'));
});

test('cannot skip approval', () => {
  assert.equal(canTransition('draft', 'approved'), false);
  assert.equal(canTransition('draft', 'sending'), false);
});

test('unknown outcome can only resolve to applied or failed, never straight to sending again', () => {
  assert.equal(canTransition('send_unknown', 'sending'), false);
  assert.ok(canTransition('send_unknown', 'applied'));
  assert.ok(canTransition('send_unknown', 'send_failed'));
});

test('a user cannot mark an application as applied or sending by hand', () => {
  assert.throws(() => assertTransition('sending', 'applied', 'user'), /send pipeline/);
  assert.doesNotThrow(() => assertTransition('sending', 'applied', 'system'));
});

test('an offer is never auto-accepted by the state machine alone', () => {
  assert.ok(canTransition('offer', 'accepted'));
  assert.equal(canTransition('applied', 'accepted'), false);
});
