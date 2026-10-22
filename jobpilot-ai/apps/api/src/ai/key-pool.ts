/**
 * Several API keys, used in turn. A key that hits a limit is put aside for a while and the next one takes over,
 * so one exhausted free-tier account never shows up as an error while another still has quota.
 * Pure (time is passed in), so it is unit-tested. Keys are never exposed: status shows position and last 4 chars only.
 */
export type KeyState = 'ready' | 'cooling' | 'invalid';
export interface KeyStatus { label: string; tail: string; state: KeyState; retryInSec: number | null }

/** "k1, k2;k3\nk4" -> unique, trimmed, unquoted keys. */
export function parseKeys(...raw: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const r of raw) for (const k of (r ?? '').split(/[\s,;]+/)) { const v = k.replace(/^["']|["']$/g, '').trim(); if (v && !out.includes(v)) out.push(v); }
  return out;
}

export class KeyPool {
  private cooldown = new Map<string, number>(); // key -> epoch ms until usable
  private bad = new Set<string>();
  private cursor = 0;
  readonly keys: string[];
  constructor(keys: string[]) { this.keys = keys; }

  get size() { return this.keys.length; }

  /** Usable keys in rotation order, starting after the one used last (spreads load evenly). */
  available(now = Date.now()): string[] {
    const n = this.keys.length; const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const k = this.keys[(this.cursor + i) % n];
      if (!this.bad.has(k) && (this.cooldown.get(k) ?? 0) <= now) out.push(k);
    }
    return out;
  }
  notInvalid(): string[] { return this.keys.filter((k) => !this.bad.has(k)); }
  /** Call after a key worked: the next request starts with the following key. */
  used(key: string) { const i = this.keys.indexOf(key); if (i >= 0) this.cursor = (i + 1) % this.keys.length; }
  limited(key: string, seconds: number, now = Date.now()) { this.cooldown.set(key, now + Math.max(5, seconds) * 1000); }
  invalid(key: string) { this.bad.add(key); }
  /** Soonest time any non-invalid key frees up, in seconds (null if none will). */
  soonestRetrySec(now = Date.now()): number | null {
    const t = this.keys.filter((k) => !this.bad.has(k)).map((k) => Math.max(0, (this.cooldown.get(k) ?? 0) - now));
    return t.length ? Math.ceil(Math.min(...t) / 1000) : null;
  }
  allInvalid() { return this.keys.length > 0 && this.keys.every((k) => this.bad.has(k)); }

  status(now = Date.now()): KeyStatus[] {
    return this.keys.map((k, i) => {
      const left = (this.cooldown.get(k) ?? 0) - now;
      const state: KeyState = this.bad.has(k) ? 'invalid' : left > 0 ? 'cooling' : 'ready';
      return { label: `Key ${i + 1}`, tail: k.slice(-4), state, retryInSec: state === 'cooling' ? Math.ceil(left / 1000) : null };
    });
  }
}
