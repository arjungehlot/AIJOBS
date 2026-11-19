import { z } from 'zod';

// The model is not perfectly consistent (empty strings, "Remote", numbers as text, null lists, a bad email). Normalise instead of failing.
const clean = (v: unknown) => (typeof v === 'string' ? (/^(null|n\/a|na|none|not (specified|available|mentioned)|-)$/i.test(v.trim()) ? null : v.trim() || null) : v);
const s = z.preprocess((v) => { v = clean(v); return typeof v === 'number' ? String(v) : Array.isArray(v) ? v.join(', ') : v; },
  z.string().max(20000).nullish().catch(undefined)).transform((v) => v ?? undefined);
const n = z.preprocess((v) => {
  v = clean(v);
  if (typeof v === 'string') { const m = v.replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : null; }
  return v;
}, z.number().finite().nonnegative().nullish().catch(undefined)).transform((v) => v ?? undefined);
const list = z.preprocess((v) => (typeof v === 'string' ? v.split(/[,;\n]/) : v),
  z.array(z.preprocess((x) => (typeof x === 'string' ? x.trim().slice(0, 100) : x), z.string().min(1))
    .catch('')).catch([])).transform((a) => a.filter((x) => x).slice(0, 60));

/** What the model may return. Anything it cannot see must be null, never guessed. */
export const ExtractedJobSchema = z.object({
  company: s, title: s, description: s, location: s,
  workMode: z.preprocess((v) => {
    const t = String(clean(v) ?? '').toLowerCase();
    return /remote|wfh|work from home/.test(t) ? 'remote' : /hybrid/.test(t) ? 'hybrid' : /on-?\s?site|office|in-?person/.test(t) ? 'onsite' : null;
  }, z.enum(['remote', 'hybrid', 'onsite']).nullish()).transform((v) => v ?? undefined),
  employmentType: s,
  requiredSkills: list, preferredSkills: list,
  experienceMin: n, experienceMax: n, salaryMin: n, salaryMax: n,
  currency: s, applicationUrl: s,
  applicationEmail: z.preprocess((v) => { v = clean(v); return typeof v === 'string' ? (v.match(/[^\s<>(),;:]+@[^\s<>(),;:]+\.[a-z]{2,}/i)?.[0] ?? null) : null; },
    z.string().email().nullish().catch(undefined)).transform((v) => v ?? undefined),
  hrContactName: s, providerJobId: s, applicationInstructions: s,
});
export type ExtractedJob = z.infer<typeof ExtractedJobSchema>;

export const REQUIRED_FOR_SAVE: (keyof ExtractedJob)[] = ['company', 'title'];
export const REVIEW_FIELDS: (keyof ExtractedJob)[] = [
  'company', 'title', 'location', 'workMode', 'experienceMin', 'salaryMax', 'applicationEmail', 'applicationUrl',
];

export function missingFields(j: ExtractedJob): string[] {
  return REVIEW_FIELDS.filter((k) => j[k] === undefined);
}
