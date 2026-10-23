/**
 * Bytes out of whatever MongoDB hands back. Mongoose's lean() returns Buffer fields as a BSON `Binary` object,
 * and Buffer.from(binary) does not copy its contents, so attachments came out wrong. This handles Buffer, Uint8Array and Binary.
 */
export function toBuffer(v: any): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (v && typeof v.read === 'function' && typeof v.length === 'function') return Buffer.from(v.read(0, v.length())); // bson Binary
  if (v?.buffer instanceof Uint8Array) return Buffer.from(v.buffer.subarray(0, typeof v.position === 'number' ? v.position : undefined));
  if (v?.type === 'Buffer' && Array.isArray(v.data)) return Buffer.from(v.data);
  throw new Error('Unsupported binary value');
}
