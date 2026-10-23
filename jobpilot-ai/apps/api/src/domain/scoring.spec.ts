import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreMatch, type CandidateProfile, type JobFacts } from './scoring.ts';

const profile: CandidateProfile = {
  skills: ['Node.js', 'React', 'TypeScript', 'PostgreSQL', 'Docker'],
  yearsExperience: 4, workModes: ['remote', 'hybrid'], locations: ['Bengaluru'],
  employmentTypes: ['full-time'], minSalary: 3000000,
  excludedCompanies: ['BadCo'], excludedKeywords: ['unpaid'], minMatchScore: 70,
};
const job: JobFacts = {
  company: 'Orbit Pay', title: 'Senior Full Stack Developer', location: 'Bengaluru',
  workMode: 'hybrid', employmentType: 'full-time',
  requiredSkills: ['nodejs', 'React', 'TypeScript', 'PostgreSQL', 'Kubernetes'],
  preferredSkills: ['GraphQL', 'Docker'], experienceMin: 4, experienceMax: 7,
};

test('matches skills through aliases and flags the missing required skill', () => {
  const r = scoreMatch(profile, job);
  assert.deepEqual(r.matchedRequired, ['node.js', 'react', 'typescript', 'postgresql']);
  assert.deepEqual(r.missingRequired, ['kubernetes']);
  assert.ok(r.concerns.some((c) => c.includes('kubernetes')));
});

test('unknown salary is excluded from the total and lowers confidence', () => {
  const r = scoreMatch(profile, job);
  const salary = r.breakdown.find((b) => b.key === 'salary')!;
  assert.equal(salary.score, null);
  assert.equal(r.confidence, 'high'); // 90% of weight known
  assert.ok(r.missingInfo.length === 1);
});

test('score is bounded and recommendation follows the threshold', () => {
  const r = scoreMatch(profile, job);
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.equal(r.recommendation, r.score >= 80 ? 'apply' : r.score >= 70 ? 'consider' : 'skip');
});

test('excluded company forces skip and caps the score', () => {
  const r = scoreMatch(profile, { ...job, company: 'badco' });
  assert.equal(r.recommendation, 'skip');
  assert.ok(r.score <= 40);
  assert.equal(r.mandatoryFailures.length, 1);
});

test('excluded keyword in the description is a mandatory failure', () => {
  const r = scoreMatch(profile, { ...job, description: 'This is an unpaid trial.' });
  assert.equal(r.recommendation, 'skip');
});

test('salary below minimum is penalised and reported', () => {
  const r = scoreMatch(profile, { ...job, salaryMax: 1500000 });
  const salary = r.breakdown.find((b) => b.key === 'salary')!;
  assert.equal(salary.score, 0);
  assert.ok(r.concerns.includes('Listed salary is below your minimum.'));
});

test('a job with almost no information gets low confidence, never a fabricated score', () => {
  const r = scoreMatch(profile, { company: 'X', title: 'Y', requiredSkills: [], preferredSkills: [] });
  assert.equal(r.confidence, 'low');
  assert.equal(r.score, 0);
});

test('salary in a different currency is not compared, and a minimum of 0 counts as not set', () => {
  const r = scoreMatch({ ...profile, minSalary: 600000, currency: 'INR' }, { ...job, salaryMax: 90000, currency: 'USD' });
  const salary = r.breakdown.find((b) => b.key === 'salary')!;
  assert.equal(salary.score, null);
  assert.ok(!r.concerns.includes('Listed salary is below your minimum.'));
  const z = scoreMatch({ ...profile, minSalary: 0 }, { ...job, salaryMax: 100 });
  assert.equal(z.breakdown.find((b) => b.key === 'salary')!.score, null);
});
