import test from 'node:test';
import assert from 'node:assert/strict';
import { toBuffer } from './bytes.ts';

const pdf = Buffer.from('%PDF-1.4\n\u00e9\u0000\u00ff binary');
test('passes a Buffer through and copies a Uint8Array', () => {
  assert.equal(toBuffer(pdf), pdf);
  assert.deepEqual(toBuffer(new Uint8Array(pdf)), pdf);
});
test('reads a bson Binary-like object (read/length) byte for byte', () => {
  const bin = { length: () => pdf.length, read: (p: number, n: number) => pdf.subarray(p, p + n), buffer: Buffer.concat([pdf, Buffer.alloc(64)]), position: pdf.length };
  assert.deepEqual(toBuffer(bin), pdf);
});
test('falls back to buffer + position, and rejects junk', () => {
  assert.deepEqual(toBuffer({ buffer: Buffer.concat([pdf, Buffer.alloc(10)]), position: pdf.length }), pdf);
  assert.throws(() => toBuffer({ nope: 1 }));
});
