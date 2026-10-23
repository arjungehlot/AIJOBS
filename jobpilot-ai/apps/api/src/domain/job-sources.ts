/** Pure normalizers for public job-board APIs. No network here; the service fetches and passes JSON in. */
export interface RawJob {
  source: string; providerJobId: string; company: string; title: string; description: string;
  location?: string; workMode?: 'remote' | 'hybrid' | 'onsite'; employmentType?: string;
  applicationUrl?: string; applicationEmail?: string; salaryMin?: number; salaryMax?: number; currency?: string;
  postedAt?: Date; tags: string[];
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** HTML job descriptions to readable plain text. */
export function htmlToText(html: unknown): string {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ENT[n])
    .replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
/** Only an address that the posting itself states. Image/asset filenames and no-reply senders are ignored. */
export function findApplyEmail(text: string): string | undefined {
  const bad = /(no-?reply|donotreply|\.(png|jpe?g|gif|svg|webp)$|example\.com$|sentry|wixpress)/i;
  return (text.match(EMAIL) ?? []).find((e) => !bad.test(e))?.toLowerCase();
}

/** A phone number the posting itself states (international +CC form, or a 10-digit Indian mobile). Returns it as written, trimmed. */
export function findPhone(text: string): string | undefined {
  const m = text.match(/(?:\+\d{1,3}[\s.-]?)\(?\d{2,5}\)?(?:[\s.-]?\d{2,5}){2,3}|(?<![\d.])[6-9]\d{4}[\s-]?\d{5}(?![\d])/g) ?? [];
  return m.map((x) => x.trim()).find((x) => { const d = x.replace(/\D/g, '').length; return d >= 10 && d <= 13; });
}

const mode = (s: string): RawJob['workMode'] | undefined => (/\bremote\b|anywhere|worldwide/i.test(s) ? 'remote' : /\bhybrid\b/i.test(s) ? 'hybrid' : /\bon-?site\b|in[- ]office/i.test(s) ? 'onsite' : undefined);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; };
const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const date = (v: unknown) => { const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v ?? '')); return isNaN(d.getTime()) ? undefined : d; };
const finish = (j: Omit<RawJob, 'applicationEmail'>): RawJob | null =>
  j.providerJobId && j.company && j.title ? { ...j, applicationEmail: findApplyEmail(j.description) } : null;

export function fromRemotive(json: any): RawJob[] {
  return (Array.isArray(json?.jobs) ? json.jobs : []).map((x: any) => finish({
    source: 'remotive', providerJobId: String(x.id ?? ''), company: str(x.company_name), title: str(x.title), description: htmlToText(x.description).slice(0, 20000),
    location: str(x.candidate_required_location) || 'Remote', workMode: 'remote', employmentType: str(x.job_type, 50).replace(/_/g, ' ') || undefined,
    applicationUrl: str(x.url, 500) || undefined, postedAt: date(x.publication_date), tags: Array.isArray(x.tags) ? x.tags.map((t: unknown) => str(t, 40)).filter(Boolean) : [],
  })).filter(Boolean) as RawJob[];
}

export function fromArbeitnow(json: any): RawJob[] {
  return (Array.isArray(json?.data) ? json.data : []).map((x: any) => finish({
    source: 'arbeitnow', providerJobId: String(x.slug ?? ''), company: str(x.company_name), title: str(x.title), description: htmlToText(x.description).slice(0, 20000),
    location: str(x.location) || undefined, workMode: x.remote ? 'remote' : mode(str(x.location)), employmentType: Array.isArray(x.job_types) ? str(x.job_types[0], 50) || undefined : undefined,
    applicationUrl: str(x.url, 500) || undefined, postedAt: date(x.created_at), tags: Array.isArray(x.tags) ? x.tags.map((t: unknown) => str(t, 40)).filter(Boolean) : [],
  })).filter(Boolean) as RawJob[];
}

export function fromRemoteOk(json: any): RawJob[] {
  // The first element is a legal notice, not a job.
  return (Array.isArray(json) ? json.slice(1) : []).map((x: any) => finish({
    source: 'remoteok', providerJobId: String(x.id ?? ''), company: str(x.company), title: str(x.position), description: htmlToText(x.description).slice(0, 20000),
    location: str(x.location) || 'Remote', workMode: 'remote', applicationUrl: str(x.apply_url || x.url, 500) || undefined,
    salaryMin: num(x.salary_min), salaryMax: num(x.salary_max), currency: num(x.salary_min) ? 'USD' : undefined,
    postedAt: date(x.date), tags: Array.isArray(x.tags) ? x.tags.map((t: unknown) => str(t, 40)).filter(Boolean) : [],
  })).filter(Boolean) as RawJob[];
}

export function fromJobicy(json: any): RawJob[] {
  return (Array.isArray(json?.jobs) ? json.jobs : []).map((x: any) => finish({
    source: 'jobicy', providerJobId: String(x.id ?? ''), company: str(x.companyName), title: str(x.jobTitle), description: htmlToText(x.jobDescription || x.jobExcerpt).slice(0, 20000),
    location: Array.isArray(x.jobGeo) ? x.jobGeo.join(', ') : str(x.jobGeo) || 'Remote', workMode: 'remote',
    employmentType: Array.isArray(x.jobType) ? str(x.jobType[0], 50) || undefined : str(x.jobType, 50) || undefined,
    applicationUrl: str(x.url, 500) || undefined, salaryMin: num(x.annualSalaryMin ?? x.salaryMin), salaryMax: num(x.annualSalaryMax ?? x.salaryMax),
    currency: str(x.salaryCurrency, 3) || undefined, postedAt: date(x.pubDate), tags: Array.isArray(x.jobIndustry) ? x.jobIndustry.map((t: unknown) => str(t, 40)).filter(Boolean) : [],
  })).filter(Boolean) as RawJob[];
}

export function fromHimalayas(json: any): RawJob[] {
  return (Array.isArray(json?.jobs) ? json.jobs : []).map((x: any) => {
    const loc = Array.isArray(x.locationRestrictions) && x.locationRestrictions.length ? x.locationRestrictions.join(', ') : 'Worldwide';
    const annual = !x.salaryPeriod || /year|annual/i.test(String(x.salaryPeriod));
    return finish({
      source: 'himalayas', providerJobId: String(x.guid ?? x.applicationLink ?? ''), company: str(x.companyName), title: str(x.title), description: htmlToText(x.description || x.excerpt).slice(0, 20000),
      location: loc, workMode: 'remote', employmentType: str(x.employmentType, 50) || undefined, applicationUrl: str(x.applicationLink || x.guid, 500) || undefined,
      salaryMin: annual ? num(x.minSalary) : undefined, salaryMax: annual ? num(x.maxSalary) : undefined, currency: annual && num(x.maxSalary) ? str(x.currency, 3) || 'USD' : undefined,
      postedAt: date(x.pubDate), tags: Array.isArray(x.categories) ? x.categories.map((t: unknown) => str(t, 40)).filter(Boolean) : [],
    });
  }).filter(Boolean) as RawJob[];
}

export function fromTheMuse(json: any): RawJob[] {
  return (Array.isArray(json?.results) ? json.results : []).map((x: any) => {
    const loc = Array.isArray(x.locations) ? x.locations.map((l: any) => str(l?.name, 80)).filter(Boolean).join(', ') : '';
    return finish({
      source: 'themuse', providerJobId: String(x.id ?? ''), company: str(x.company?.name), title: str(x.name), description: htmlToText(x.contents).slice(0, 20000),
      location: loc || undefined, workMode: mode(loc), applicationUrl: str(x.refs?.landing_page, 500) || undefined, postedAt: date(x.publication_date),
      tags: [...(Array.isArray(x.categories) ? x.categories : []), ...(Array.isArray(x.levels) ? x.levels : [])].map((t: any) => str(t?.name, 40)).filter(Boolean),
    });
  }).filter(Boolean) as RawJob[];
}

/** Adzuna, one country per call. Salaries are yearly, in that country's currency. Descriptions are short snippets, so apply emails are rarely found. */
const ADZ_CUR: Record<string, string> = { in: 'INR', us: 'USD', gb: 'GBP', ca: 'CAD', au: 'AUD', de: 'EUR', fr: 'EUR', nl: 'EUR', es: 'EUR', it: 'EUR', at: 'EUR', be: 'EUR', pl: 'PLN', sg: 'SGD', nz: 'NZD', za: 'ZAR', br: 'BRL', mx: 'MXN', ch: 'CHF' };
export function fromAdzuna(json: any, country = 'in'): RawJob[] {
  return (Array.isArray(json?.results) ? json.results : []).map((x: any) => finish({
    source: 'adzuna', providerJobId: String(x.id ?? ''), company: str(x.company?.display_name), title: htmlToText(x.title).slice(0, 300), description: htmlToText(x.description).slice(0, 20000),
    location: str(x.location?.display_name) || undefined, workMode: mode(`${x.title ?? ''} ${x.description ?? ''}`), employmentType: str(x.contract_time, 50).replace(/_/g, ' ') || undefined,
    applicationUrl: str(x.redirect_url, 500) || undefined, salaryMin: num(x.salary_min), salaryMax: num(x.salary_max), currency: num(x.salary_max) ? ADZ_CUR[country] ?? undefined : undefined,
    postedAt: date(x.created), tags: x.category?.label ? [str(x.category.label, 40)] : [],
  })).filter(Boolean) as RawJob[];
}

export const SOURCES = ['remotive', 'arbeitnow', 'remoteok', 'jobicy', 'himalayas', 'themuse', 'adzuna'] as const;
export type SourceId = (typeof SOURCES)[number];

/** Public, key-less endpoints. `q` is a free-text title/skill query. */
export function sourceUrl(id: SourceId, q: string, keys: { adzunaId?: string; adzunaKey?: string; country?: string } = {}): string {
  const e = encodeURIComponent(q);
  switch (id) {
    case 'remotive': return `https://remotive.com/api/remote-jobs?limit=60${q ? `&search=${e}` : ''}`;
    case 'arbeitnow': return 'https://www.arbeitnow.com/api/job-board-api';
    case 'remoteok': return 'https://remoteok.com/api';
    case 'jobicy': return `https://jobicy.com/api/v2/remote-jobs?count=50${q ? `&tag=${e}` : ''}`;
    case 'himalayas': return q ? `https://himalayas.app/jobs/api/search?q=${e}&limit=20` : 'https://himalayas.app/jobs/api?limit=20';
    case 'themuse': return 'https://www.themuse.com/api/public/jobs?page=1&descending=true';
    case 'adzuna': return `https://api.adzuna.com/v1/api/jobs/${keys.country ?? 'in'}/search/1?app_id=${encodeURIComponent(keys.adzunaId ?? '')}&app_key=${encodeURIComponent(keys.adzunaKey ?? '')}&results_per_page=50&sort_by=date&max_days_old=30${q ? `&what=${e}` : ''}`;
  }
}
export const PARSERS: Record<SourceId, (j: any) => RawJob[]> = { remotive: fromRemotive, arbeitnow: fromArbeitnow, remoteok: fromRemoteOk, jobicy: fromJobicy, himalayas: fromHimalayas, themuse: fromTheMuse, adzuna: fromAdzuna };

export interface Relevance { titles: string[]; skills: string[]; query?: string }
/** Cheap pre-filter so only plausible jobs are stored and (later) sent to the AI. 0 = unrelated. */
export function relevance(j: Pick<RawJob, 'title' | 'description' | 'tags'>, r: Relevance): number {
  const title = j.title.toLowerCase();
  const body = `${j.description} ${j.tags.join(' ')}`.toLowerCase();
  const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 2 && !['and', 'the', 'for', 'senior', 'junior', 'lead'].includes(w));
  let s = 0;
  const wanted = r.query ? [r.query] : r.titles;
  for (const t of wanted) {
    const ws = words(t); if (!ws.length) continue;
    const hit = ws.filter((w) => title.includes(w)).length / ws.length;
    s = Math.max(s, hit * 3);
  }
  const sk = r.skills.filter((k) => new RegExp(`(?<![a-z0-9])${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`).test(`${title} ${body}`)).length;
  return s + Math.min(sk, 6) * 0.35;
}

/** True when a posting is recent enough. Postings with no date are kept (we cannot tell), future dates count as fresh. */
export function isFresh(postedAt: Date | undefined, maxAgeDays: number, now = new Date()): boolean {
  if (!postedAt || Number.isNaN(postedAt.getTime())) return true;
  return now.getTime() - postedAt.getTime() <= maxAgeDays * 86_400_000;
}

/** Pre-filled searches on sites that have no public API and forbid scraping. The user opens them; nothing is fetched here. */
export function externalSearchLinks(q: string, days: number, location = 'India') {
  const e = encodeURIComponent(q), l = encodeURIComponent(location);
  return [
    { id: 'linkedin', name: 'LinkedIn', url: `https://www.linkedin.com/jobs/search/?keywords=${e}&location=${l}&f_TPR=r${days * 86400}&sortBy=DD` },
    { id: 'naukri', name: 'Naukri', url: `https://www.naukri.com/${q.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'jobs'}-jobs?jobAge=${days}` },
    { id: 'indeed', name: 'Indeed', url: `https://in.indeed.com/jobs?q=${e}&l=${l}&fromage=${days}&sort=date` },
    { id: 'wellfound', name: 'Wellfound', url: `https://wellfound.com/jobs?keywords=${e}` },
  ];
}
