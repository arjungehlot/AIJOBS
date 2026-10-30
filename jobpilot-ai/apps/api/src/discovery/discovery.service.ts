import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { AiSettingsService } from '../ai/ai-settings.service';
import { AI_PROVIDER, AiProvider } from '../ai/ai.provider';
import { AuditService } from '../audit/audit.service';
import { CareerProfile } from '../career-profiles/career-profile.schema';
import { extractSkills } from '../domain/ats';
import { dedupeKey } from '../domain/dedupe';
import { env } from '../common/env';
import { PARSERS, fromAdzuna, RawJob, SOURCES, SourceId, findApplyEmail, findPhone, isFresh, relevance, sourceUrl, externalSearchLinks } from '../domain/job-sources';
import { scoreMatch } from '../domain/scoring';
import { COUNTRIES, inCountries } from '../domain/countries';
import { Application } from '../applications/application.schema';
import { Job, JobMatch } from '../jobs/job.schema';

export const DiscoverDto = z.object({
  careerProfileId: z.string().regex(/^[a-f0-9]{24}$/i),
  query: z.string().trim().max(300).optional(),
  sources: z.array(z.enum(SOURCES)).min(1).max(SOURCES.length).optional(),
  limit: z.number().int().min(5).max(40).default(20),
  enrich: z.boolean().default(true),
  /** Only postings from the last N days. Older ones are never shown. */
  maxAgeDays: z.number().int().min(1).max(30).default(5),
  /** ISO codes. Empty or missing means every country. */
  countries: z.array(z.string().length(2).transform((c) => c.toUpperCase())).max(40).optional(),
  /** Keep postings that name no country ("Remote", "Worldwide") when a country filter is on. */
  includeWorldwide: z.boolean().default(true),
});
/** "Frontend developer, full stack developer / software developer" becomes three separate searches (max 5). */
export function splitRoles(q?: string | null): string[] {
  const out: string[] = [];
  for (const part of String(q ?? '').split(/[,;|\n]+|\s\/\s|\s+or\s+/i)) { const t = part.trim().replace(/\s+/g, ' ').slice(0, 80); if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t); }
  return out.slice(0, 5);
}
const INDIA_CITIES = ['Bengaluru', 'Bangalore', 'Mumbai', 'Delhi', 'New Delhi', 'Gurugram', 'Gurgaon', 'Noida', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Indore', 'Chandigarh', 'Kochi', 'Coimbatore', 'Thiruvananthapuram', 'Nagpur', 'Surat', 'Lucknow', 'Bhopal', 'Vadodara'];
/** City names the posting text mentions (an indication, not a guarantee: the job feed itself only gives countries). */
export function citiesIn(text: string): string[] {
  const out: string[] = [];
  for (const c of INDIA_CITIES) { if (new RegExp(`(?<![A-Za-z])${c}(?![A-Za-z])`, 'i').test(text)) { const canon = c === 'Bangalore' ? 'Bengaluru' : c === 'Gurgaon' ? 'Gurugram' : c; if (!out.includes(canon)) out.push(canon); } }
  return out.slice(0, 4);
}
export const ContactDto = z.object({
  jobId: z.string().regex(/^[a-f0-9]{24}$/i),
  email: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(30).regex(/^[+\d][\d\s().-]{6,28}$/, 'Enter a valid phone number').optional().or(z.literal('')),
});
export type DiscoverInput = z.infer<typeof DiscoverDto>;

export const CREDITS: Record<SourceId, { name: string; url: string }> = {
  remotive: { name: 'Remotive', url: 'https://remotive.com' },
  arbeitnow: { name: 'Arbeitnow', url: 'https://www.arbeitnow.com' },
  remoteok: { name: 'Remote OK', url: 'https://remoteok.com' },
  jobicy: { name: 'Jobicy', url: 'https://jobicy.com' },
  himalayas: { name: 'Himalayas', url: 'https://himalayas.app' },
  themuse: { name: 'The Muse', url: 'https://www.themuse.com' },
  adzuna: { name: 'Adzuna India', url: 'https://www.adzuna.in' },
};
const available = () => SOURCES.filter((id) => id !== 'adzuna' || env.adzunaConfigured);

export interface ProgressStep { at: number; pct: number; text: string }
interface SearchJob { userId: string; startedAt: number; pct: number; steps: ProgressStep[]; done: boolean; error?: string; result?: unknown }
type Report = (pct: number, text: string) => void;

const UA = 'JobPilotAI/0.1 (personal job search; contact: owner)';
const yearsIn = (t: string) => { const m = t.match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i); return m ? Number(m[1]) : undefined; };

@Injectable()
export class DiscoveryService {
  private readonly runs = new Map<string, SearchJob>();
  constructor(
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
    @InjectModel(JobMatch.name) private readonly matches: Model<JobMatch>,
    @InjectModel(CareerProfile.name) private readonly profiles: Model<CareerProfile>,
    @InjectModel(Application.name) private readonly apps: Model<Application>,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly aiSettings: AiSettingsService,
    private readonly audit: AuditService,
  ) {}

  /** Countries offered in the filter. */
  countries() { return COUNTRIES.map(({ code, name }) => ({ code, name })); }

  /** Saves an HR email / phone the user found (for example on LinkedIn) onto the job, so it can be emailed and messaged from here. */
  async setContact(userId: string, dto: z.infer<typeof ContactDto>) {
    const set: Record<string, string> = {}; const unset: Record<string, ''> = {};
    if (dto.email !== undefined) (dto.email ? (set.applicationEmail = dto.email) : (unset.applicationEmail = ''));
    if (dto.phone !== undefined) (dto.phone ? (set.contactPhone = dto.phone) : (unset.contactPhone = ''));
    const j: any = await this.jobs.findOneAndUpdate({ _id: dto.jobId, userId }, { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { new: true }).lean();
    if (!j) throw new NotFoundException('Job not found');
    return { applicationEmail: j.applicationEmail ?? null, contactPhone: j.contactPhone ?? null, applyMethod: j.applicationEmail ? 'email' : 'link' };
  }

  sources() { return available().map((id) => ({ id, ...CREDITS[id] })); }

  /** Pre-filled LinkedIn / Naukri / Indeed searches for the user to open. */
  externalLinks(q: string, days: number, loc = '') { return externalSearchLinks(q.slice(0, 120), Math.min(Math.max(days, 1), 30), loc.slice(0, 60) || undefined); }

  /** Starts a search in the background and returns an id to poll. The steps reported are real, as they happen. */
  start(userId: string, dto: DiscoverInput) {
    for (const [k, v] of this.runs) if (Date.now() - v.startedAt > 15 * 60_000) this.runs.delete(k); // forget old runs
    const id = randomUUID();
    const job: SearchJob = { userId, startedAt: Date.now(), pct: 0, steps: [], done: false };
    this.runs.set(id, job);
    const report: Report = (pct, text) => { job.pct = Math.max(job.pct, pct); job.steps.push({ at: Date.now() - job.startedAt, pct: job.pct, text }); };
    this.search(userId, dto, 'user', report)
      .then((r) => { job.result = r; job.pct = 100; job.done = true; })
      .catch((e: any) => { job.error = String(e?.response?.message ?? e?.message ?? 'Search failed').slice(0, 300); job.done = true; });
    return { id };
  }

  status(userId: string, id: string, since = 0) {
    const j = this.runs.get(id);
    if (!j || j.userId !== userId) throw new NotFoundException('Search not found (it may have expired)');
    return { done: j.done, pct: j.pct, elapsedMs: Date.now() - j.startedAt, steps: j.steps.slice(since), total: j.steps.length, error: j.error ?? null, result: j.done && !j.error ? j.result : null };
  }

  /**
   * Finds real, current openings on public job boards, stores the relevant ones, scores them against the profile.
   * It never applies to anything. Applying is a separate, gated step.
   */
  async search(userId: string, dto: DiscoverInput, actor: 'user' | 'agent' = 'user', report: Report = () => undefined) {
    report(3, 'Reading your career profile');
    const profile = await this.profiles.findOne({ _id: dto.careerProfileId, userId }).lean();
    if (!profile) throw new NotFoundException('Career profile not found');
    if (!dto.query && !profile.targetTitles.length && !profile.skills.length) throw new BadRequestException('Add target job titles or skills to your career profile (or type a search) first.');
    const ids = (dto.sources ?? [...SOURCES]).filter((i) => available().includes(i));
    if (!ids.length) throw new BadRequestException('No job sources are available.');
    const roles = splitRoles(dto.query).length ? splitRoles(dto.query) : (profile.targetTitles.length ? profile.targetTitles.slice(0, 4) : profile.skills.slice(0, 1));
    // Gemini widens the search: related titles this candidate could be hired for, based on their own skills.
    let aiRoles: string[] = []; let aiRoleNote: string | null = null;
    const useAi = dto.enrich && this.ai.name !== 'mock';
    if (useAi && this.ai.suggestRoles) {
      report(4, 'AI is suggesting related job titles from your skills');
      try {
        const sug = await this.ai.suggestRoles({ titles: profile.targetTitles.slice(0, 8), skills: profile.skills.slice(0, 30), searching: roles }, { model: await this.aiSettings.modelFor(userId) });
        aiRoles = (sug ?? []).filter((r) => !roles.some((x) => x.toLowerCase() === r.toLowerCase())).slice(0, Math.max(0, 6 - roles.length));
        roles.push(...aiRoles);
      } catch (e: any) { aiRoleNote = String(e?.message ?? 'unavailable').slice(0, 120); }
    }
    const q = roles.join(', ');

    report(6, `Searching ${ids.length} job boards for ${roles.length} role${roles.length === 1 ? '' : 's'}: ${q}`);
    const wanted = dto.countries ?? [];
    let fetchedN = 0;
    const fetched = await Promise.all(ids.map(async (id) => {
      const done = (r: { id: SourceId; ok: boolean; error?: string; jobs: RawJob[] }) => { fetchedN++; report(6 + Math.round((fetchedN / ids.length) * 24), r.ok ? `${CREDITS[id].name}: ${r.jobs.length} openings found` : `${CREDITS[id].name}: unavailable (${r.error})`); return r; };
      try {
        const keys = { adzunaId: env.adzunaId, adzunaKey: env.adzunaKey };
        // Adzuna is one country per request: ask for every chosen country it covers (India when none chosen).
        const adz = id === 'adzuna' ? (wanted.map((c) => COUNTRIES.find((x) => x.code === c)?.adzuna).filter(Boolean) as string[]) : [];
        // Sources that take a text query are asked once per role. The others return one general feed.
        const perRole = id === 'adzuna' || id === 'remotive' || id === 'jobicy' || id === 'himalayas';
        const qs = perRole ? roles : [''];
        const countries = id === 'adzuna' ? (adz.length ? adz : wanted.length ? [] : ['in']) : id === 'himalayas' ? (wanted.length ? wanted.slice(0, 3) : ['']) : ['in'];
        const pages = id === 'himalayas' ? [1, 2] : [1]; // Himalayas returns 20 per page: take the two newest pages per search
        const calls = countries.flatMap((country) => qs.flatMap((role) => pages.map((page) => ({ url: sourceUrl(id, role, { ...keys, country, page }), plain: sourceUrl(id, '', { ...keys, country, page }), country })))).slice(0, 24);
        if (!calls.length) return done({ id, ok: true, jobs: [] }); // chosen countries are not covered by this source
        const results = await Promise.allSettled(calls.map(async (c) => {
          const hdrs: Record<string, string> = { 'user-agent': UA, accept: 'application/json' };
          const authed = id === 'himalayas' && !!env.himalayasKey; if (authed) hdrs.authorization = `Bearer ${env.himalayasKey}`;
          let res = await fetch(c.url, { headers: hdrs, signal: AbortSignal.timeout(20_000) });
          if (res.status === 401 && authed) { delete hdrs.authorization; res = await fetch(c.url, { headers: hdrs, signal: AbortSignal.timeout(20_000) }); } // the key was rejected: the public feed still works without it
          if ((res.status === 400 || res.status === 404) && c.plain !== c.url && id !== 'adzuna') res = await fetch(c.plain, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(20_000) }); // this board rejects the text query: take its general feed and filter here
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          return id === 'adzuna' ? fromAdzuna(json, c.country) : PARSERS[id](json);
        }));
        const parts = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
        if (!parts.length) throw (results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason;
        return done({ id, ok: true, jobs: parts.flat() });
      } catch (e: any) { return done({ id, ok: false, error: /HTTP \d+/.test(String(e?.message)) ? String(e.message) : 'could not connect', jobs: [] }); }
    }));
    const sourceReport = fetched.map((f) => ({ id: f.id, ok: f.ok, count: f.jobs.length, error: (f as any).error ?? null, ...CREDITS[f.id] }));

    const excl = profile.excludedCompanies.map((c) => c.toLowerCase());
    const bad = profile.excludedKeywords.map((k) => k.toLowerCase());
    const seen = new Set<string>();
    const maxAge = dto.maxAgeDays ?? 5;
    let staleSkipped = 0; let countrySkipped = 0; const nowD = new Date();
    const relFor = (j: RawJob) => Math.max(...roles.map((role) => relevance(j, { titles: [], skills: profile.skills, query: role })), 0);
    const candidates = fetched.flatMap((f) => f.jobs).filter((j) => {
      const k = `${j.source}:${j.providerJobId}`; if (seen.has(k)) return false; seen.add(k);
      if (!isFresh(j.postedAt, maxAge, nowD)) { staleSkipped++; return false; }
      if (!inCountries(j.location, wanted, dto.includeWorldwide ?? true)) { countrySkipped++; return false; }
      if (excl.includes(j.company.toLowerCase())) return false;
      const hay = `${j.title} ${j.description}`.toLowerCase();
      return !bad.some((w) => hay.includes(w));
    }).map((j) => ({ j, r: relFor(j) })).filter((x) => x.r >= 1);

    report(36, `Filtering: ${candidates.length} of ${fetched.reduce((n, f) => n + f.jobs.length, 0)} match your skills (${staleSkipped} older than ${maxAge} days skipped)`);
    const scoredAll = candidates.map(({ j, r }) => {
      const skills = extractSkills(`${j.title} ${j.tags.join(' ')} ${j.description}`);
      const facts = { company: j.company, title: j.title, description: j.description, location: j.location, workMode: j.workMode, employmentType: j.employmentType, requiredSkills: skills, preferredSkills: [] as string[], experienceMin: yearsIn(j.description), salaryMax: j.salaryMax, currency: j.currency };
      return { j, r, facts, report: scoreMatch(profile as any, facts), aiFit: undefined as number | undefined, aiReason: undefined as string | undefined };
    }).sort((a, b) => b.report.score - a.report.score || b.r - a.r);
    // Gemini reads the best 30 keyword matches in ONE call and rates the real fit, so ordering follows skills and role, not just keywords.
    let rankNote: string | null = null; let aiRanked = 0;
    if (useAi && this.ai.rankJobs && scoredAll.length) {
      report(40, `AI is rating the fit of the top ${Math.min(30, scoredAll.length)} openings`);
      try {
        const pool = scoredAll.slice(0, 30);
        const out = await this.ai.rankJobs({ titles: profile.targetTitles.slice(0, 8), skills: profile.skills.slice(0, 30), yearsExperience: (profile as any).yearsExperience }, pool.map((x, i) => ({ id: String(i), title: x.j.title, company: x.j.company, location: x.j.location, text: x.j.description ?? '' })), { model: await this.aiSettings.modelFor(userId) });
        for (const o of out ?? []) { const row = pool[Number(o.id)]; if (row) { row.aiFit = o.fit; row.aiReason = o.reason; aiRanked++; } }
        scoredAll.sort((a, b) => (b.aiFit !== undefined ? b.aiFit * 0.6 + b.report.score * 0.4 : b.report.score * 0.7) - (a.aiFit !== undefined ? a.aiFit * 0.6 + a.report.score * 0.4 : a.report.score * 0.7));
      } catch (e: any) { rankNote = String(e?.message ?? 'unavailable').slice(0, 120); }
    }
    const scored = scoredAll.slice(0, dto.limit);

    report(44, `Scored against your profile. Best keyword match: ${scored[0]?.report.score ?? 0}/100`);
    const now = new Date();
    const stored: { id: any; isNew: boolean; row: (typeof scored)[number]; phone?: string }[] = [];
    for (const row of scored) {
      const { j, facts } = row;
      const key = dedupeKey({ source: j.source, providerJobId: j.providerJobId, applicationUrl: j.applicationUrl, company: j.company, title: j.title, location: j.location });
      const res: any = await this.jobs.findOneAndUpdate({ userId, dedupeKey: key }, {
        $set: { lastSeenAt: now },
        $setOnInsert: { source: j.source, providerJobId: j.providerJobId, company: j.company, title: j.title, description: j.description, location: j.location, workMode: j.workMode, employmentType: j.employmentType,
          requiredSkills: facts.requiredSkills, preferredSkills: [], experienceMin: facts.experienceMin, salaryMax: j.salaryMax, salaryMin: j.salaryMin, currency: j.currency, applicationUrl: j.applicationUrl, applicationEmail: j.applicationEmail, contactPhone: findPhone(j.description ?? ''), firstSeenAt: now },
      }, { upsert: true, new: true, includeResultMetadata: true });
      const isNew = !res.lastErrorObject?.updatedExisting;
      if (!isNew) { // Already known (maybe AI-reviewed before): score from what is stored, not the fresh baseline.
        const d = res.value;
        const f2 = { ...facts, requiredSkills: d.requiredSkills ?? facts.requiredSkills, preferredSkills: d.preferredSkills ?? [], experienceMin: d.experienceMin ?? facts.experienceMin, experienceMax: d.experienceMax, workMode: d.workMode ?? facts.workMode };
        stored.push({ id: d._id, isNew, row: { ...row, facts: f2, report: scoreMatch(profile as any, f2), j: { ...j, applicationEmail: d.applicationEmail ?? j.applicationEmail } }, phone: d.contactPhone ?? findPhone(j.description ?? '') } as any);
      } else stored.push({ id: res.value._id, isNew, row, phone: findPhone(j.description ?? '') } as any);
    }

    report(52, `Saved ${stored.length} openings (${stored.filter((x) => x.isNew).length} new)`);
    // Optional AI pass on the best few: reads the full posting for real skills, experience and apply email.
    let aiNote: string | null = null;
    const enriched = new Set<string>();
    if (dto.enrich && this.ai.name !== 'mock') {
      const model = await this.aiSettings.modelFor(userId);
      const top = stored.slice(0, 5); let i = 0; let stop = false; // few calls: free-tier keys allow only a handful per minute
      await Promise.all(Array.from({ length: 2 }, async () => {
        while (!stop && i < top.length) {
          const s = top[i++]; const { j } = s.row;
          report(52 + Math.round((i / top.length) * 42), `AI is reading: ${j.title} · ${j.company}`);
          try {
            const x = await this.ai.extractJob({ kind: 'text', text: `Title: ${j.title}\nCompany: ${j.company}\nLocation: ${j.location ?? ''}\n\n${j.description}`.slice(0, 14000) }, { model });
            const facts = { ...s.row.facts, requiredSkills: x.requiredSkills.length ? x.requiredSkills : s.row.facts.requiredSkills, preferredSkills: x.preferredSkills, experienceMin: x.experienceMin ?? s.row.facts.experienceMin, experienceMax: x.experienceMax, workMode: x.workMode ?? s.row.facts.workMode, salaryMax: x.salaryMax ?? s.row.facts.salaryMax };
            const email = j.applicationEmail ?? x.applicationEmail ?? findApplyEmail(j.description); // an email already saved (or added by the user) is kept
            await this.jobs.updateOne({ _id: s.id }, { $set: { requiredSkills: facts.requiredSkills, preferredSkills: facts.preferredSkills, experienceMin: facts.experienceMin, experienceMax: facts.experienceMax, ...(facts.workMode && { workMode: facts.workMode }), ...(email && { applicationEmail: email }) } });
            s.row = { ...s.row, facts, report: scoreMatch(profile as any, facts), j: { ...j, applicationEmail: email ?? j.applicationEmail } };
            enriched.add(String(s.id));
            report(52 + Math.round((i / top.length) * 42), `Understood ${j.company}: ${facts.requiredSkills.length} skills${email ? ', apply email found' : ''}, now scores ${s.row.report.score}`);
          } catch (e: any) {
            if (/quota|rate limit|too many|rejected|refused|not set|no free/i.test(String(e?.response?.message ?? e?.message))) { stop = true; aiNote = String(e?.response?.message ?? e.message); }
          }
        }
      }));
    }

    stored.sort((a, b) => b.row.report.score - a.row.report.score);
    report(97, 'Ranking the results');
    await this.matches.insertMany(stored.map((s) => ({ userId, jobId: s.id, careerProfileId: profile._id, score: s.row.report.score, recommendation: s.row.report.recommendation, report: s.row.report as any })), { ordered: false }).catch(() => undefined);
    await this.audit.record({ userId, actor, action: 'discovery.search', entityType: 'career_profile', entityId: String(profile._id), result: 'success', meta: { query: q, found: candidates.length, stored: stored.length, newJobs: stored.filter((s) => s.isNew).length } });

    const hints: string[] = [];
    if (wanted.includes('IN') || !wanted.length) {
      if (!env.adzunaConfigured) hints.push('Most free job boards list very few jobs in India. Add the free Adzuna keys (ADZUNA_APP_ID and ADZUNA_APP_KEY) on the server to search Indian openings.');
      if (countrySkipped > candidates.length * 2) hints.push(`${countrySkipped} openings were outside your chosen countries. Remote-worldwide roles are kept; widen "Posted within" to 14 days for more.`);
    }
    if (staleSkipped > candidates.length) hints.push(`${staleSkipped} openings were older than ${maxAge} days. Try "Posted within" 14 or 30 days.`);
    const appRows = await this.apps.find({ userId, jobId: { $in: stored.map((x) => x.id) } }).select('jobId status sentAt lastError').lean();
    const appBy = new Map(appRows.map((a: any) => [String(a.jobId), a]));
    return {
      query: q, roles, aiRoles, aiRoleNote, rankNote, aiRanked, hints, staleSkipped, countrySkipped, countries: wanted, maxAgeDays: maxAge, scanned: fetched.reduce((n, f) => n + f.jobs.length, 0), relevant: candidates.length, sources: sourceReport, aiNote,
      items: stored.map((s) => ({
        jobId: String(s.id), isNew: s.isNew, source: s.row.j.source, company: s.row.j.company, title: s.row.j.title, location: s.row.j.location ?? null, workMode: s.row.j.workMode ?? null,
        score: s.row.report.score, recommendation: s.row.report.recommendation, matched: s.row.report.matchedRequired, missing: s.row.report.missingRequired,
        contactPhone: s.phone ?? null, cities: citiesIn(`${s.row.j.title} ${s.row.j.location ?? ''} ${(s.row.j.description ?? '').slice(0, 2500)}`), countriesList: (s.row.j.location ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12), logoLetter: (s.row.j.company ?? '?').trim().charAt(0).toUpperCase(), salary: s.row.j.salaryMax ? { min: s.row.j.salaryMin ?? null, max: s.row.j.salaryMax, currency: s.row.j.currency ?? null } : null, employmentType: s.row.j.employmentType ?? null,
        applyMethod: s.row.j.applicationEmail ? 'email' : 'link', applicationEmail: s.row.j.applicationEmail ?? null, applicationUrl: s.row.j.applicationUrl ?? null,
        aiFit: (s.row as any).aiFit ?? null, aiReason: (s.row as any).aiReason ?? null, postedAt: s.row.j.postedAt ?? null, aiReviewed: enriched.has(String(s.id)),
        application: (() => { const a: any = appBy.get(String(s.id)); return a ? { id: String(a._id), status: a.status, sentAt: a.sentAt ?? null, error: a.lastError ?? null } : null; })(),
      })),
    };
  }
}
