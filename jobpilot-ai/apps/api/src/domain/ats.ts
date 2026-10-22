/** Resume-vs-job keyword coverage. Suggests; never invents skills. */
const ALIAS: Record<string, string> = { nodejs: 'node.js', node: 'node.js', reactjs: 'react', js: 'javascript', ts: 'typescript', postgres: 'postgresql', k8s: 'kubernetes', mongo: 'mongodb', golang: 'go' };
const norm = (s: string) => { const v = s.trim().toLowerCase().replace(/\s+/g, ' '); return ALIAS[v] ?? v; };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const VOCAB = ['node.js', 'react', 'typescript', 'javascript', 'python', 'java', 'go', 'postgresql', 'mongodb', 'mysql', 'redis', 'docker',
  'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'graphql', 'rest', 'next.js', 'nestjs', 'express', 'sql', 'git', 'ci/cd', 'linux', 'kafka', 'rabbitmq', 'jest', 'tailwind', 'html', 'css'];

/** Whole-word search that treats symbols like "." and "/" as part of the term. */
export function positionOf(text: string, term: string): number {
  const t = term.toLowerCase();
  const re = new RegExp(`(?<![a-z0-9])${esc(t)}(?![a-z0-9])`, 'i');
  const aliases = Object.entries(ALIAS).filter(([, v]) => v === t).map(([k]) => k);
  const hits = [text.search(re), ...aliases.map((a) => text.search(new RegExp(`(?<![a-z0-9])${esc(a)}(?![a-z0-9])`, 'i')))].filter((i) => i >= 0);
  return hits.length ? Math.min(...hits) : -1;
}

export function extractSkills(text: string): string[] {
  return VOCAB.filter((s) => positionOf(text, s) >= 0);
}

export interface Coverage {
  requiredCoverage: number | null; preferredCoverage: number | null; score: number | null;
  foundRequired: string[]; missingRequired: string[]; foundPreferred: string[]; missingPreferred: string[];
  buried: string[]; suggestions: string[];
}

export function coverage(resume: string, required: string[], preferred: string[]): Coverage {
  const req = [...new Set(required.map(norm))]; const pref = [...new Set(preferred.map(norm))];
  const has = (s: string) => positionOf(resume, s) >= 0;
  const foundRequired = req.filter(has), missingRequired = req.filter((s) => !has(s));
  const foundPreferred = pref.filter(has), missingPreferred = pref.filter((s) => !has(s));
  const cut = Math.max(400, Math.floor(resume.length * 0.35));
  const buried = [...foundRequired, ...foundPreferred].filter((s) => positionOf(resume, s) > cut);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
  const rc = pct(foundRequired.length, req.length), pc = pct(foundPreferred.length, pref.length);
  const parts = [rc !== null ? [rc, 0.75] : null, pc !== null ? [pc, 0.25] : null].filter(Boolean) as number[][];
  const wsum = parts.reduce((a, p) => a + p[1], 0);
  const score = wsum ? Math.round(parts.reduce((a, p) => a + p[0] * p[1], 0) / wsum) : null;
  const suggestions: string[] = [];
  if (buried.length) suggestions.push(`Move these higher, near the top: ${buried.join(', ')}.`);
  for (const m of missingRequired) suggestions.push(`"${m}" is required but not on your resume. Add it only if you have genuinely used it.`);
  if (resume.trim().length < 300) suggestions.push('The resume text is very short; paste the full text for a meaningful check.');
  return { requiredCoverage: rc, preferredCoverage: pc, score, foundRequired, missingRequired, foundPreferred, missingPreferred, buried, suggestions };
}

/**
 * Reorders the comma-separated "Skills:" line so job-relevant skills come first.
 * Adds and removes nothing. Returns the original text unchanged if there is no Skills line.
 */
export function tailorSkillsLine(resume: string, required: string[], preferred: string[]): { text: string; changed: boolean; before?: string; after?: string } {
  const m = resume.match(/^(\s*skills\s*[:\-]\s*)(.+)$/im);
  if (!m) return { text: resume, changed: false };
  const items = m[2].split(',').map((x) => x.trim()).filter(Boolean);
  const rank = (s: string) => { const n = norm(s); const r = required.map(norm).indexOf(n); if (r >= 0) return r; const p = preferred.map(norm).indexOf(n); return p >= 0 ? 1000 + p : 5000; };
  const sorted = items.map((s, i) => ({ s, i, r: rank(s) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.s);
  const after = sorted.join(', ');
  if (after === items.join(', ')) return { text: resume, changed: false };
  return { text: resume.replace(m[0], `${m[1]}${after}`), changed: true, before: m[2].trim(), after };
}
