/** Business-day arithmetic in UTC. Saturdays, Sundays and optional ISO-date holidays are skipped. */
const iso = (d: Date) => d.toISOString().slice(0, 10);
const isBusiness = (d: Date, holidays: Set<string>) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !holidays.has(iso(d));

export function addBusinessDays(from: Date, days: number, holidays: string[] = []): Date {
  const h = new Set(holidays);
  const d = new Date(from.getTime());
  let left = Math.max(0, Math.floor(days));
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isBusiness(d, h)) left--;
  }
  return d;
}

/** Whole business days from a (exclusive) to b (inclusive). Negative if b is earlier. */
export function businessDaysBetween(a: Date, b: Date, holidays: string[] = []): number {
  if (b < a) return -businessDaysBetween(b, a, holidays);
  const h = new Set(holidays);
  const d = new Date(a.getTime());
  let n = 0;
  while (iso(d) < iso(b)) { d.setUTCDate(d.getUTCDate() + 1); if (isBusiness(d, h)) n++; }
  return n;
}
