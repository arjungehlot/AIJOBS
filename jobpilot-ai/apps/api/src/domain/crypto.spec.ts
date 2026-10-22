import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret } from './crypto.ts';

const key = 'a'.repeat(64);

test('round-trips and never stores plaintext', () => {
  const t = encryptSecret('refresh-token-123', key);
  assert.ok(!t.includes('refresh-token-123'));
  assert.equal(decryptSecret(t, key), 'refresh-token-123');
});

test('same input yields different ciphertext (random IV)', () => {
  assert.notEqual(encryptSecret('x', key), encryptSecret('x', key));
});

test('tampering or the wrong key fails loudly', () => {
  const t = encryptSecret('secret', key);
  const bad = t.slice(0, -2) + (t.endsWith('AA') ? 'BB' : 'AA');
  assert.throws(() => decryptSecret(bad, key));
  assert.throws(() => decryptSecret(t, 'b'.repeat(64)));
  assert.throws(() => encryptSecret('x', 'short'), /64 hex/);
});
