import test from 'node:test';
import assert from 'node:assert/strict';
import { findApplyEmail, fromArbeitnow, fromJobicy, fromRemoteOk, fromRemotive, htmlToText, relevance, sourceUrl } from './job-sources.ts';

test('htmlToText keeps structure and decodes entities', () => {
  const t = htmlToText('<p>We&#39;re hiring &amp; growing</p><ul><li>Node.js</li><li>React</li></ul><script>x()</script>');
  assert.match(t, /We're hiring & growing/);
  assert.match(t, /• Node\.js\n• React/);
  assert.ok(!t.includes('x()'));
});
test('findApplyEmail returns a real contact and ignores noise', () => {
  assert.equal(findApplyEmail('Send CV to Jobs@Acme.io today'), 'jobs@acme.io');
  assert.equal(findApplyEmail('logo@2x.png and no-reply@acme.io'), undefined);
  assert.equal(findApplyEmail('no email here'), undefined);
});
test('Remotive / Arbeitnow / RemoteOK / Jobicy payloads normalize', () => {
  const r = fromRemotive({ jobs: [{ id: 1, title: 'Node Dev', company_name: 'Acme', url: 'https://remotive.com/x', description: '<p>Email hr@acme.io</p>', candidate_required_location: 'Worldwide', publication_date: '2026-10-01T00:00:00' }, { id: 2 }] });
  assert.equal(r.length, 1); assert.equal(r[0].workMode, 'remote'); assert.equal(r[0].applicationEmail, 'hr@acme.io');
  const a = fromArbeitnow({ data: [{ slug: 'dev-acme-1', title: 'Dev', company_name: 'Acme', remote: false, location: 'Berlin', url: 'https://arbeitnow.com/x', created_at: 1760000000, description: 'x' }] });
  assert.equal(a[0].providerJobId, 'dev-acme-1'); assert.equal(a[0].postedAt?.getFullYear(), 2025);
  const o = fromRemoteOk([{ legal: 'notice' }, { id: '9', position: 'Backend', company: 'Zed', salary_min: 90000, salary_max: 120000, apply_url: 'https://remoteok.com/9', tags: ['node'] }]);
  assert.equal(o.length, 1); assert.equal(o[0].salaryMax, 120000);
  const j = fromJobicy({ jobs: [{ id: 5, jobTitle: 'QA', companyName: 'Q', url: 'https://jobicy.com/5', jobGeo: 'USA', jobType: ['Full-Time'] }] });
  assert.equal(j[0].employmentType, 'Full-Time');
});
test('garbage payloads never throw', () => {
  for (const f of [fromRemotive, fromArbeitnow, fromRemoteOk, fromJobicy]) { assert.deepEqual(f(null), []); assert.deepEqual(f({ jobs: 'x', data: 5 }), []); }
});
test('relevance favours matching titles and skills', () => {
  const good = { title: 'Senior Node.js Backend Engineer', description: 'We use Node.js, TypeScript and MongoDB', tags: [] };
  const bad = { title: 'Sales Manager', description: 'Close deals', tags: [] };
  const r = { titles: ['Backend Engineer'], skills: ['node.js', 'typescript', 'mongodb'] };
  assert.ok(relevance(good, r) > 3); assert.equal(relevance(bad, r), 0);
});
test('sourceUrl encodes the query', () => { assert.match(sourceUrl('remotive', 'node js'), /search=node%20js/); });
