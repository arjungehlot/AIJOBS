import { createHash } from 'node:crypto';

/** Lower-case host without www, no tracking params or fragment, no trailing slash. */
export function normalizeUrl(input: string): string {
  try {
    const u = new URL(input.trim());
    u.hash = '';
    const drop: string[] = [];
    u.searchParams.forEach((_v, k) => {
      if (/^(utm_|ref$|source$|gclid$|fbclid$)/i.test(k)) drop.push(k);
    });
    drop.forEach((k) => u.searchParams.delete(k));
    u.searchParams.sort();
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '') || '';
    const qs = u.searchParams.toString();
    return `${host}${path}${qs ? '?' + qs : ''}`;
  } catch {
    return input.trim().toLowerCase();
  }
}

const squash = (s: string | undefined | null) =>
  (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export interface DedupeInput {
  source?: string;
  providerJobId?: string;
  applicationUrl?: string;
  company: string;
  title: string;
  location?: string;
}

/**
 * Stable identity for a job. Provider ID wins; otherwise the normalized
 * URL; otherwise company + title + location.
 */
export function dedupeKey(j: DedupeInput): string {
  if (j.source && j.providerJobId) return `p:${squash(j.source)}:${j.providerJobId.trim()}`;
  if (j.applicationUrl) return `u:${hash(normalizeUrl(j.applicationUrl))}`;
  return `c:${hash([squash(j.company), squash(j.title), squash(j.location)].join('|'))}`;
}

function hash(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 32);
}
