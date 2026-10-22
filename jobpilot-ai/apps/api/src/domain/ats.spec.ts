import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverage, extractSkills, positionOf, tailorSkillsLine } from './ats.ts';

const resume = `Aarav K
Skills: Docker, React, Node.js, TypeScript, PostgreSQL
Experience: Built a payments API with NodeJS and Postgres.`;

test('finds skills through aliases and punctuation', () => {
  assert.ok(positionOf(resume, 'node.js') >= 0);
  assert.ok(positionOf(resume, 'postgresql') >= 0);
  assert.equal(positionOf('I use Javascript daily', 'java'), -1); // whole-word only
  assert.deepEqual(extractSkills('go and rest').sort(), ['go', 'rest']);
});

test('coverage reports found, missing and a weighted score', () => {
  const c = coverage(resume, ['node.js', 'react', 'kubernetes'], ['graphql', 'docker']);
  assert.deepEqual(c.missingRequired, ['kubernetes']);
  assert.equal(c.requiredCoverage, 67);
  assert.equal(c.preferredCoverage, 50);
  assert.equal(c.score, 63); // 0.75*67 + 0.25*50
  assert.ok(c.suggestions.some((s) => s.includes('only if you have genuinely used it')));
});

test('no requirements gives a null score, not a made-up one', () => {
  assert.equal(coverage(resume, [], []).score, null);
});

test('tailoring reorders but never adds or removes skills', () => {
  const t = tailorSkillsLine(resume, ['node.js', 'typescript'], ['react']);
  assert.equal(t.changed, true);
  assert.equal(t.after, 'Node.js, TypeScript, React, Docker, PostgreSQL');
  assert.equal(t.before!.split(',').length, t.after!.split(',').length);
  assert.deepEqual(t.before!.split(',').map((s) => s.trim()).sort(), t.after!.split(',').map((s) => s.trim()).sort());
});

test('without a Skills line the text is returned unchanged', () => {
  const t = tailorSkillsLine('Just prose about work.', ['react'], []);
  assert.equal(t.changed, false);
  assert.equal(t.text, 'Just prose about work.');
});

test('flags required skills that are buried deep in the resume', () => {
  const long = 'x '.repeat(600) + 'Kubernetes experience';
  assert.deepEqual(coverage(long, ['kubernetes'], []).buried, ['kubernetes']);
});
