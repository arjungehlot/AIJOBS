import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { AiSettingsService } from '../ai/ai-settings.service';
import { AI_PROVIDER, AiProvider } from '../ai/ai.provider';
import { AuditService } from '../audit/audit.service';
import { CareerProfile } from '../career-profiles/career-profile.schema';
import { extractSkills } from '../domain/ats';
import { dedupeKey } from '../domain/dedupe';
import { PARSERS, RawJob, SOURCES, SourceId, findApplyEmail, relevance, sourceUrl } from '../domain/job-sources';
import { scoreMatch } from '../domain/scoring';
import { Job, JobMatch } from '../jobs/job.schema';

export const DiscoverDto = z.object({
  careerProfileId: z.string().regex(/^[a-f0-9]{24}$/i),
  query: z.string().trim().max(100).optional(),
  sources: z.array(z.enum(SOURCES)).min(1).max(SOURCES.length).optional(),
  limit: z.number().int().min(5).max(40).default(20),
  enrich: z.boolean().default(true),
});
export type DiscoverInput = z.infer<typeof DiscoverDto>;

export const CREDITS: Record<SourceId, { name: string; url: string }> = {
  remotive: { name: 'Remotive', url: 'https://remotive.com' },
  arbeitnow: { name: 'Arbeitnow', url: 'https://www.arbeitnow.com' },
  remoteok: { name: 'Remote OK', url: 'https://remoteok.com' },
  jobicy: { name: 'Jobicy', url: 'https://jobicy.com' },
};

const UA = 'JobPilotAI/0.1 (personal job search; contact: owner)';
const yearsIn = (t: string) => { const m = t.match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i); return m ? Number(m[1]) : undefined; };

@Injectable()
export class DiscoveryService {
  constructor(
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
    @InjectModel(JobMatch.name) private readonly matches: Model<JobMatch>,
    @InjectModel(CareerProfile.name) private readonly profiles: Model<CareerProfile>,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly aiSettings: AiSettingsService,
    private readonly audit: AuditService,
  ) {}

  sources() { return SOURCES.map((id) => ({ id, ...CREDITS[id] })); }

  /**
   * Finds real, current openings on public job boards, stores the relevant ones, scores them against the profile.
   * It never applies to anything. Applying is a separate, gated step.
   */
  async search(userId: string, dto: DiscoverInput, actor: 'user' | 'agent' = 'user') {
    const profile = await this.profiles.findOne({ _id: dto.careerProfileId, userId }).lean();
    if (!profile) throw new NotFoundException('Career profile not found');
    if (!dto.query && !profile.targetTitles.length && !profile.skills.length) throw new BadRequestException('Add target job titles or skills to your career profile (or type a search) first.');
    const ids = dto.sources ?? [...SOURCES];
    const q = dto.query ?? profile.targetTitles[0] ?? profile.skills[0] ?? '';

    const fetched = await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetch(sourceUrl(id, q), { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
        if (!res.ok) return { id, ok: false, error: `HTTP ${res.status}`, jobs: [] as RawJob[] };
        return { id, ok: true, jobs: PARSERS[id](await res.json()) };
      } catch { return { id, ok: false, error: 'Could not reach this source', jobs: [] as RawJob[] }; }
    }));
    const sourceReport = fetched.map((f) => ({ id: f.id, ok: f.ok, count: f.jobs.length, error: (f as any).error ?? null, ...CREDITS[f.id] }));

    const excl = profile.excludedCompanies.map((c) => c.toLowerCase());
    const bad = profile.excludedKeywords.map((k) => k.toLowerCase());
    const seen = new Set<string>();
    const rel = { titles: dto.query ? [] : profile.targetTitles, skills: profile.skills, query: dto.query };
    const candidates = fetched.flatMap((f) => f.jobs).filter((j) => {
      const k = `${j.source}:${j.providerJobId}`; if (seen.has(k)) return false; seen.add(k);
      if (excl.includes(j.company.toLowerCase())) return false;
      const hay = `${j.title} ${j.description}`.toLowerCase();
      return !bad.some((w) => hay.includes(w));
    }).map((j) => ({ j, r: relevance(j, rel) })).filter((x) => x.r >= 1);

    const scored = candidates.map(({ j, r }) => {
      const skills = extractSkills(`${j.title} ${j.tags.join(' ')} ${j.description}`);
      const facts = { company: j.company, title: j.title, description: j.description, location: j.location, workMode: j.workMode, employmentType: j.employmentType, requiredSkills: skills, preferredSkills: [] as string[], experienceMin: yearsIn(j.description), salaryMax: j.salaryMax };
      return { j, r, facts, report: scoreMatch(profile as any, facts) };
    }).sort((a, b) => b.report.score - a.report.score || b.r - a.r).slice(0, dto.limit);

    const now = new Date();
    const stored: { id: any; isNew: boolean; row: (typeof scored)[number] }[] = [];
    for (const row of scored) {
      const { j, facts } = row;
      const key = dedupeKey({ source: j.source, providerJobId: j.providerJobId, applicationUrl: j.applicationUrl, company: j.company, title: j.title, location: j.location });
      const res: any = await this.jobs.findOneAndUpdate({ userId, dedupeKey: key }, {
        $set: { lastSeenAt: now },
        $setOnInsert: { source: j.source, providerJobId: j.providerJobId, company: j.company, title: j.title, description: j.description, location: j.location, workMode: j.workMode, employmentType: j.employmentType,
          requiredSkills: facts.requiredSkills, preferredSkills: [], experienceMin: facts.experienceMin, salaryMax: j.salaryMax, salaryMin: j.salaryMin, currency: j.currency, applicationUrl: j.applicationUrl, applicationEmail: j.applicationEmail, firstSeenAt: now },
      }, { upsert: true, new: true, includeResultMetadata: true });
      const isNew = !res.lastErrorObject?.updatedExisting;
      if (!isNew) { // Already known (maybe AI-reviewed before): score from what is stored, not the fresh baseline.
        const d = res.value;
        const f2 = { ...facts, requiredSkills: d.requiredSkills ?? facts.requiredSkills, preferredSkills: d.preferredSkills ?? [], experienceMin: d.experienceMin ?? facts.experienceMin, experienceMax: d.experienceMax, workMode: d.workMode ?? facts.workMode };
        stored.push({ id: d._id, isNew, row: { ...row, facts: f2, report: scoreMatch(profile as any, f2), j: { ...j, applicationEmail: d.applicationEmail ?? j.applicationEmail } } });
      } else stored.push({ id: res.value._id, isNew, row });
    }

    // Optional AI pass on the best few: reads the full posting for real skills, experience and apply email.
    let aiNote: string | null = null;
    const enriched = new Set<string>();
    if (dto.enrich && this.ai.name !== 'mock') {
      const model = await this.aiSettings.modelFor(userId);
      const top = stored.slice(0, 8); let i = 0; let stop = false;
      await Promise.all(Array.from({ length: 3 }, async () => {
        while (!stop && i < top.length) {
          const s = top[i++]; const { j } = s.row;
          try {
            const x = await this.ai.extractJob({ kind: 'text', text: `Title: ${j.title}\nCompany: ${j.company}\nLocation: ${j.location ?? ''}\n\n${j.description}`.slice(0, 14000) }, { model });
            const facts = { ...s.row.facts, requiredSkills: x.requiredSkills.length ? x.requiredSkills : s.row.facts.requiredSkills, preferredSkills: x.preferredSkills, experienceMin: x.experienceMin ?? s.row.facts.experienceMin, experienceMax: x.experienceMax, workMode: x.workMode ?? s.row.facts.workMode, salaryMax: x.salaryMax ?? s.row.facts.salaryMax };
            const email = x.applicationEmail ?? findApplyEmail(j.description);
            await this.jobs.updateOne({ _id: s.id }, { $set: { requiredSkills: facts.requiredSkills, preferredSkills: facts.preferredSkills, experienceMin: facts.experienceMin, experienceMax: facts.experienceMax, ...(facts.workMode && { workMode: facts.workMode }), ...(email && { applicationEmail: email }) } });
            s.row = { ...s.row, facts, report: scoreMatch(profile as any, facts), j: { ...j, applicationEmail: email ?? j.applicationEmail } };
            enriched.add(String(s.id));
          } catch (e: any) {
            if (/quota|rate limit|rejected|refused|not set/i.test(String(e?.message))) { stop = true; aiNote = String(e.message); }
          }
        }
      }));
    }

    stored.sort((a, b) => b.row.report.score - a.row.report.score);
    await this.matches.insertMany(stored.map((s) => ({ userId, jobId: s.id, careerProfileId: profile._id, score: s.row.report.score, recommendation: s.row.report.recommendation, report: s.row.report as any })), { ordered: false }).catch(() => undefined);
    await this.audit.record({ userId, actor, action: 'discovery.search', entityType: 'career_profile', entityId: String(profile._id), result: 'success', meta: { query: q, found: candidates.length, stored: stored.length, newJobs: stored.filter((s) => s.isNew).length } });

    return {
      query: q, scanned: fetched.reduce((n, f) => n + f.jobs.length, 0), relevant: candidates.length, sources: sourceReport, aiNote,
      items: stored.map((s) => ({
        jobId: String(s.id), isNew: s.isNew, source: s.row.j.source, company: s.row.j.company, title: s.row.j.title, location: s.row.j.location ?? null, workMode: s.row.j.workMode ?? null,
        score: s.row.report.score, recommendation: s.row.report.recommendation, matched: s.row.report.matchedRequired, missing: s.row.report.missingRequired,
        applyMethod: s.row.j.applicationEmail ? 'email' : 'link', applicationEmail: s.row.j.applicationEmail ?? null, applicationUrl: s.row.j.applicationUrl ?? null,
        postedAt: s.row.j.postedAt ?? null, aiReviewed: enriched.has(String(s.id)),
      })),
    };
  }
}
