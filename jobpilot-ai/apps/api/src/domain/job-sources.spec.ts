import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fromHimalayas, fromTheMuse, fromAdzuna, externalSearchLinks, findApplyEmail, findPhone, fromArbeitnow, fromJobicy, fromRemoteOk, fromRemotive, htmlToText, isFresh, relevance, sourceUrl } from './job-sources.ts';

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

test('isFresh drops postings older than the limit and keeps undated ones', () => {
  const now = new Date('2026-10-23T00:00:00Z');
  assert.equal(isFresh(new Date('2026-10-20T00:00:00Z'), 5, now), true);
  assert.equal(isFresh(new Date('2026-10-18T00:00:00Z'), 5, now), true);
  assert.equal(isFresh(new Date('2026-10-17T23:00:00Z'), 5, now), false);
  assert.equal(isFresh(undefined, 5, now), true);
});

test('findPhone finds stated numbers and ignores plain numbers', () => {
  assert.equal(findPhone('Call HR on +91 98765 43210 today'), '+91 98765 43210');
  assert.equal(findPhone('WhatsApp 9876543210 for details'), '9876543210');
  assert.equal(findPhone('We have 1200 employees and were founded in 2015, salary 600000'), undefined);
});

test('Himalayas, The Muse and Adzuna normalise to the shared job shape', () => {
  const h = fromHimalayas({ jobs: [{ guid: 'g1', title: 'React Dev', companyName: 'Acme', description: '<p>Email hr@acme.io</p>', pubDate: 1792668556, minSalary: 50000, maxSalary: 90000, currency: 'USD', salaryPeriod: 'annual', locationRestrictions: ['India'], applicationLink: 'https://x.test/a' }] });
  assert.equal(h[0].company, 'Acme'); assert.equal(h[0].salaryMax, 90000); assert.equal(h[0].applicationEmail, 'hr@acme.io'); assert.equal(h[0].workMode, 'remote');
  const m = fromTheMuse({ results: [{ id: 7, name: 'Engineer', contents: '<p>Hi</p>', publication_date: '2026-10-20T10:00:00Z', locations: [{ name: 'Remote' }], company: { name: 'Muse Co' }, refs: { landing_page: 'https://m.test/j' }, categories: [{ name: 'Software Engineering' }], levels: [] }] });
  assert.equal(m[0].providerJobId, '7'); assert.equal(m[0].workMode, 'remote'); assert.equal(m[0].tags[0], 'Software Engineering');
  const a = fromAdzuna({ results: [{ id: '9', title: 'Node Developer', description: 'Pune role', created: '2026-10-21T00:00:00Z', company: { display_name: 'Zed' }, location: { display_name: 'Pune, Maharashtra' }, redirect_url: 'https://a.test/r', salary_min: 600000, salary_max: 900000 }] });
  assert.equal(a[0].currency, 'INR'); assert.equal(a[0].company, 'Zed');
  assert.deepEqual(fromHimalayas({}), []);
  const obj = fromHimalayas({ jobs: [{ guid: 'g2', title: 'Node Dev', companyName: 'Beta', description: 'x', locationRestrictions: [{ alpha2: 'IN', name: 'India', slug: 'india' }, { alpha2: 'US', name: 'United States', slug: 'united-states' }] }, { guid: 'g3', title: 'Any', companyName: 'Gamma', description: 'x', locationRestrictions: [] }] });
  assert.equal(obj[0].location, 'India, United States'); assert.equal(obj[1].location, 'Worldwide');
});
test('external search links are pre-filled and Adzuna url carries its keys', () => {
  const l = externalSearchLinks('Full Stack Developer', 5);
  assert.ok(l.find((x) => x.id === 'linkedin')!.url.includes('keywords=Full%20Stack%20Developer') && l[0].url.includes('f_TPR=r432000'));
  assert.ok(l.find((x) => x.id === 'naukri')!.url.includes('/full-stack-developer-jobs'));
  assert.ok(sourceUrl('adzuna', 'node', { adzunaId: 'i', adzunaKey: 'k' }).includes('app_id=i&app_key=k'));
});
