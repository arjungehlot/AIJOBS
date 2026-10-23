import test from 'node:test';
import assert from 'node:assert/strict';
import { templateDraft } from './template-draft.ts';

const base = { candidateName: 'Arjun Gehlot', jobTitle: 'DevOps Engineer', company: 'Acme', tone: 'professional' as const, matchedSkills: ['AWS', 'Linux'], missingRequiredSkills: ['Kubernetes'], yearsExperience: 2 };
test('template names the company and role, mentions the resume only when attached', () => {
  const a = templateDraft({ ...base, resumeAttached: true });
  assert.match(a.body, /DevOps Engineer position at Acme/); assert.match(a.body, /resume attached/); assert.match(a.subject, /DevOps Engineer/);
  assert.doesNotMatch(templateDraft({ ...base, resumeAttached: false }).body, /attached/);
});
test('template never claims a missing skill', () => {
  const t = templateDraft(base).body;
  assert.match(t, /building depth in Kubernetes/); assert.doesNotMatch(t, /working with [^.]*Kubernetes/);
});
