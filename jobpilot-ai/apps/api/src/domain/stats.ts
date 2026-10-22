/** Rate helpers that refuse to overstate small samples. */
export const MIN_SAMPLE = 20;
export interface Rate { n: number; d: number; pct: number | null; lowSample: boolean }

export function rate(n: number, d: number): Rate {
  return { n, d, pct: d ? Math.round((n / d) * 100) : null, lowSample: d < MIN_SAMPLE };
}

export function groupRates<T>(items: T[], key: (t: T) => string, hit: (t: T) => boolean): { key: string; rate: Rate }[] {
  const m = new Map<string, { n: number; d: number }>();
  for (const it of items) { const k = key(it); const g = m.get(k) ?? { n: 0, d: 0 }; g.d++; if (hit(it)) g.n++; m.set(k, g); }
  return [...m.entries()].map(([k, g]) => ({ key: k, rate: rate(g.n, g.d) })).sort((a, b) => b.rate.d - a.rate.d);
}

export const scoreBucket = (s?: number) => (s === undefined ? 'Unscored' : s >= 85 ? '85+' : s >= 70 ? '70–84' : s >= 55 ? '55–69' : s >= 40 ? '40–54' : '0–39');

export function averageDays(pairs: { from: Date; to: Date }[]): number | null {
  const v = pairs.map((p) => (p.to.getTime() - p.from.getTime()) / 86_400_000).filter((x) => x >= 0);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}
