/** Explainable job-to-profile scoring. Pure: no I/O, no AI. */

export interface CandidateProfile {
  skills: string[];
  yearsExperience: number;
  workModes: string[]; // remote | hybrid | onsite
  locations: string[];
  employmentTypes: string[];
  minSalary?: number;
  excludedCompanies: string[];
  excludedKeywords: string[];
  minMatchScore: number;
}

export interface JobFacts {
  company: string;
  title: string;
  description?: string;
  location?: string;
  workMode?: string;
  employmentType?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceMin?: number;
  experienceMax?: number;
  salaryMax?: number;
}

export interface BreakdownItem {
  key: string;
  label: string;
  weight: number;
  score: number | null; // null = unknown, excluded from the total
  note: string;
}

export interface MatchReport {
  score: number;
  breakdown: BreakdownItem[];
  matchedRequired: string[];
  missingRequired: string[];
  matchedPreferred: string[];
  missingPreferred: string[];
  concerns: string[];
  mandatoryFailures: string[];
  missingInfo: string[];
  confidence: 'high' | 'medium' | 'low';
  recommendation: 'apply' | 'consider' | 'skip';
  disclaimer: string;
}

const ALIASES: Record<string, string> = {
  nodejs: 'node.js', node: 'node.js', reactjs: 'react', js: 'javascript',
  ts: 'typescript', postgres: 'postgresql', k8s: 'kubernetes', mongo: 'mongodb', golang: 'go',
};
const norm = (s: string) => {
  const v = s.trim().toLowerCase().replace(/\s+/g, ' ');
  return ALIASES[v] ?? v;
};
const uniq = (l: string[]) => [...new Set(l.map(norm).filter(Boolean))];
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const WEIGHTS = { required: 40, preferred: 15, experience: 20, locationMode: 15, salary: 10 } as const;

export function scoreMatch(p: CandidateProfile, j: JobFacts): MatchReport {
  const have = new Set(uniq(p.skills));
  const req = uniq(j.requiredSkills);
  const pref = uniq(j.preferredSkills);
  const matchedRequired = req.filter((s) => have.has(s));
  const missingRequired = req.filter((s) => !have.has(s));
  const matchedPreferred = pref.filter((s) => have.has(s));
  const missingPreferred = pref.filter((s) => !have.has(s));
  const concerns: string[] = [];
  const mandatoryFailures: string[] = [];
  const missingInfo: string[] = [];

  // Mandatory rules
  const company = j.company.trim().toLowerCase();
  if (p.excludedCompanies.some((c) => c.trim().toLowerCase() === company)) {
    mandatoryFailures.push(`Company "${j.company}" is on your excluded list.`);
  }
  const haystack = `${j.title} ${j.description ?? ''}`.toLowerCase();
  for (const kw of p.excludedKeywords) {
    if (kw.trim() && haystack.includes(kw.trim().toLowerCase())) {
      mandatoryFailures.push(`Contains excluded keyword "${kw}".`);
    }
  }

  const items: BreakdownItem[] = [];

  items.push(
    req.length
      ? { key: 'required', label: 'Required skills', weight: WEIGHTS.required,
          score: clamp((matchedRequired.length / req.length) * 100),
          note: `${matchedRequired.length} of ${req.length} required skills found in your profile.` }
      : unknown('required', 'Required skills', WEIGHTS.required, 'No required skills listed.'),
  );
  items.push(
    pref.length
      ? { key: 'preferred', label: 'Preferred skills', weight: WEIGHTS.preferred,
          score: clamp((matchedPreferred.length / pref.length) * 100),
          note: `${matchedPreferred.length} of ${pref.length} preferred skills found.` }
      : unknown('preferred', 'Preferred skills', WEIGHTS.preferred, 'No preferred skills listed.'),
  );

  // Experience
  if (j.experienceMin === undefined) {
    items.push(unknown('experience', 'Experience', WEIGHTS.experience, 'Experience requirement not listed.'));
  } else {
    const y = p.yearsExperience;
    let s = y >= j.experienceMin ? 100 : 100 - (j.experienceMin - y) * 25;
    if (j.experienceMax !== undefined && y > j.experienceMax + 3) {
      s = 85;
      concerns.push('You may be over-experienced for this role.');
    }
    if (y < j.experienceMin) concerns.push(`Asks for ${j.experienceMin}+ years; your profile shows ${y}.`);
    items.push({ key: 'experience', label: 'Experience', weight: WEIGHTS.experience, score: clamp(s),
      note: `Role asks ${j.experienceMin}${j.experienceMax !== undefined ? `-${j.experienceMax}` : '+'} years; you have ${y}.` });
  }

  // Location and work mode
  const mode = j.workMode?.toLowerCase();
  const loc = j.location?.trim().toLowerCase();
  if (!mode && !loc) {
    items.push(unknown('locationMode', 'Location and mode', WEIGHTS.locationMode, 'Location and work mode not listed.'));
  } else {
    const parts: number[] = [];
    const notes: string[] = [];
    if (mode) {
      const ok = p.workModes.map((m) => m.toLowerCase()).includes(mode);
      parts.push(ok ? 100 : 40);
      notes.push(ok ? `${mode} fits your preference.` : `Role is ${mode}; you prefer ${p.workModes.join('/') || 'unspecified'}.`);
      if (!ok) concerns.push(`Work mode is ${mode}, which is not in your preferences.`);
    }
    if (mode !== 'remote' && loc) {
      const ok = p.locations.some((l) => loc.includes(l.trim().toLowerCase()) && l.trim() !== '');
      parts.push(ok ? 100 : 30);
      notes.push(ok ? 'Location is one of your cities.' : 'Location is outside your preferred cities.');
      if (!ok) concerns.push(`Location "${j.location}" is outside your preferred locations.`);
    }
    items.push({ key: 'locationMode', label: 'Location and mode', weight: WEIGHTS.locationMode,
      score: clamp(parts.reduce((a, b) => a + b, 0) / parts.length), note: notes.join(' ') });
  }

  // Salary
  if (j.salaryMax === undefined || p.minSalary === undefined) {
    items.push(unknown('salary', 'Salary', WEIGHTS.salary,
      j.salaryMax === undefined ? 'Salary not listed.' : 'You have not set a minimum salary.'));
  } else if (j.salaryMax >= p.minSalary) {
    items.push({ key: 'salary', label: 'Salary', weight: WEIGHTS.salary, score: 100, note: 'Top of range meets your minimum.' });
  } else {
    const gap = ((p.minSalary - j.salaryMax) / p.minSalary) * 100;
    items.push({ key: 'salary', label: 'Salary', weight: WEIGHTS.salary, score: clamp(100 - gap * 2),
      note: `Top of range is ${Math.round(gap)}% below your minimum.` });
    concerns.push('Listed salary is below your minimum.');
  }

  if (j.employmentType && p.employmentTypes.length &&
      !p.employmentTypes.map((t) => t.toLowerCase()).includes(j.employmentType.toLowerCase())) {
    concerns.push(`Employment type "${j.employmentType}" is not in your preferences.`);
  }
  if (missingRequired.length) concerns.push(`Missing required: ${missingRequired.join(', ')}.`);

  // Weighted total over known components only
  const known = items.filter((i) => i.score !== null);
  const knownWeight = known.reduce((a, i) => a + i.weight, 0);
  let score = knownWeight === 0 ? 0 : clamp(known.reduce((a, i) => a + (i.score as number) * i.weight, 0) / knownWeight);
  items.filter((i) => i.score === null).forEach((i) => missingInfo.push(i.note));

  if (mandatoryFailures.length) score = Math.min(score, 40);

  const share = knownWeight / 100;
  const confidence = share >= 0.85 ? 'high' : share >= 0.6 ? 'medium' : 'low';
  const recommendation: MatchReport['recommendation'] = mandatoryFailures.length
    ? 'skip'
    : score >= p.minMatchScore + 10 ? 'apply'
    : score >= p.minMatchScore ? 'consider' : 'skip';

  return {
    score, breakdown: items, matchedRequired, missingRequired, matchedPreferred, missingPreferred,
    concerns, mandatoryFailures, missingInfo, confidence, recommendation,
    disclaimer: 'A fit estimate from your profile and the listing. It is not a hiring probability.',
  };
}

function unknown(key: string, label: string, weight: number, note: string): BreakdownItem {
  return { key, label, weight, score: null, note };
}
