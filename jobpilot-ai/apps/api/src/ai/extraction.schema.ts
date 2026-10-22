import { z } from 'zod';

const s = z.string().trim().min(1).max(20000).nullish().transform((v) => v ?? undefined);
const n = z.number().finite().nonnegative().nullish().transform((v) => v ?? undefined);
const list = z.array(z.string().trim().min(1).max(100)).max(60).default([]);

/** What the model may return. Anything it cannot see must be null, never guessed. */
export const ExtractedJobSchema = z.object({
  company: s, title: s, description: s, location: s,
  workMode: z.enum(['remote', 'hybrid', 'onsite']).nullish().transform((v) => v ?? undefined),
  employmentType: s,
  requiredSkills: list, preferredSkills: list,
  experienceMin: n, experienceMax: n, salaryMin: n, salaryMax: n,
  currency: s, applicationUrl: s,
  applicationEmail: z.string().email().nullish().transform((v) => v ?? undefined),
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
