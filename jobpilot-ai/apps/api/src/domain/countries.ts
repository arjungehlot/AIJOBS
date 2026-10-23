/** Countries a user can filter by. Matching is on the posting's own location text; nothing is guessed from the company. */
export interface Country { code: string; name: string; aliases: string[]; eu?: boolean; adzuna?: string }

export const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India', adzuna: 'in', aliases: ['india', 'bengaluru', 'bangalore', 'mumbai', 'delhi', 'new delhi', 'gurgaon', 'gurugram', 'noida', 'pune', 'hyderabad', 'chennai', 'kolkata', 'ahmedabad', 'indore', 'jaipur'] },
  { code: 'US', name: 'United States', adzuna: 'us', aliases: ['united states', 'usa', 'u.s.', 'america', 'new york', 'san francisco', 'seattle', 'austin', 'boston', 'chicago', 'los angeles', 'california', 'texas', 'florida', 'washington dc'] },
  { code: 'GB', name: 'United Kingdom', adzuna: 'gb', aliases: ['united kingdom', 'uk', 'england', 'scotland', 'wales', 'london', 'manchester', 'edinburgh', 'britain'] },
  { code: 'CA', name: 'Canada', adzuna: 'ca', aliases: ['canada', 'toronto', 'vancouver', 'montreal', 'ottawa', 'calgary'] },
  { code: 'AU', name: 'Australia', adzuna: 'au', aliases: ['australia', 'sydney', 'melbourne', 'brisbane', 'perth'] },
  { code: 'DE', name: 'Germany', adzuna: 'de', eu: true, aliases: ['germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne'] },
  { code: 'FR', name: 'France', adzuna: 'fr', eu: true, aliases: ['france', 'paris', 'lyon', 'marseille'] },
  { code: 'NL', name: 'Netherlands', adzuna: 'nl', eu: true, aliases: ['netherlands', 'holland', 'amsterdam', 'rotterdam', 'utrecht'] },
  { code: 'ES', name: 'Spain', adzuna: 'es', eu: true, aliases: ['spain', 'madrid', 'barcelona', 'valencia'] },
  { code: 'IT', name: 'Italy', adzuna: 'it', eu: true, aliases: ['italy', 'milan', 'rome', 'turin'] },
  { code: 'PL', name: 'Poland', adzuna: 'pl', eu: true, aliases: ['poland', 'warsaw', 'krakow', 'wroclaw'] },
  { code: 'PT', name: 'Portugal', eu: true, aliases: ['portugal', 'lisbon', 'porto'] },
  { code: 'IE', name: 'Ireland', eu: true, aliases: ['ireland', 'dublin'] },
  { code: 'SE', name: 'Sweden', eu: true, aliases: ['sweden', 'stockholm'] },
  { code: 'CH', name: 'Switzerland', adzuna: 'ch', eu: true, aliases: ['switzerland', 'zurich', 'zürich', 'geneva'] },
  { code: 'AT', name: 'Austria', adzuna: 'at', eu: true, aliases: ['austria', 'vienna'] },
  { code: 'BE', name: 'Belgium', adzuna: 'be', eu: true, aliases: ['belgium', 'brussels'] },
  { code: 'SG', name: 'Singapore', adzuna: 'sg', aliases: ['singapore'] },
  { code: 'AE', name: 'United Arab Emirates', aliases: ['united arab emirates', 'uae', 'dubai', 'abu dhabi'] },
  { code: 'SA', name: 'Saudi Arabia', aliases: ['saudi arabia', 'saudi', 'riyadh', 'jeddah'] },
  { code: 'NZ', name: 'New Zealand', adzuna: 'nz', aliases: ['new zealand', 'auckland', 'wellington'] },
  { code: 'ZA', name: 'South Africa', adzuna: 'za', aliases: ['south africa', 'cape town', 'johannesburg'] },
  { code: 'BR', name: 'Brazil', adzuna: 'br', aliases: ['brazil', 'brasil', 'sao paulo', 'são paulo'] },
  { code: 'MX', name: 'Mexico', adzuna: 'mx', aliases: ['mexico', 'méxico'] },
  { code: 'JP', name: 'Japan', aliases: ['japan', 'tokyo', 'osaka'] },
  { code: 'PH', name: 'Philippines', aliases: ['philippines', 'manila'] },
  { code: 'PK', name: 'Pakistan', aliases: ['pakistan', 'karachi', 'lahore', 'islamabad'] },
  { code: 'BD', name: 'Bangladesh', aliases: ['bangladesh', 'dhaka'] },
  { code: 'LK', name: 'Sri Lanka', aliases: ['sri lanka', 'colombo'] },
  { code: 'NG', name: 'Nigeria', aliases: ['nigeria', 'lagos'] },
  { code: 'MY', name: 'Malaysia', aliases: ['malaysia', 'kuala lumpur'] },
  { code: 'ID', name: 'Indonesia', aliases: ['indonesia', 'jakarta'] },
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = (a: string) => new RegExp(`(?<![a-z0-9])${esc(a)}(?![a-z0-9])`, 'i');
const ALL = COUNTRIES.map((c) => ({ c, res: c.aliases.map(word) }));
const EUROPE = /(?<![a-z])(europe|european union|eu|emea)(?![a-z])/i;
const WORLD = /worldwide|anywhere|global|remote|work from home|any location/i;

/** Which known countries a location string points at. */
export function countriesIn(location: string): string[] {
  const out = new Set<string>();
  for (const { c, res } of ALL) if (res.some((r) => r.test(location))) out.add(c.code);
  if (/(?<![A-Za-z])(US|USA)(?![A-Za-z])/.test(location)) out.add('US');
  if (/(?<![A-Za-z])UK(?![A-Za-z])/.test(location)) out.add('GB');
  if (EUROPE.test(location)) for (const c of COUNTRIES) if (c.eu) out.add(c.code);
  return [...out];
}

/**
 * Keeps a posting when its location names one of the chosen countries. A posting that names no country at all
 * ("Remote", "Worldwide", empty) is kept only when `includeWorldwide` is on. No selection means no filtering.
 */
export function inCountries(location: string | undefined, selected: string[], includeWorldwide = true): boolean {
  if (!selected.length) return true;
  const loc = (location ?? '').trim();
  const found = countriesIn(loc);
  if (found.length) return found.some((c) => selected.includes(c));
  return includeWorldwide && (loc === '' || WORLD.test(loc));
}
