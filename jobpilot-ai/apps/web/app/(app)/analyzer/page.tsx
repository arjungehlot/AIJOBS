'use client';
import Link from 'next/link';
import { ChangeEvent, useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

type Form = Record<string, string>;
const FIELDS: [string, string, boolean?][] = [
  ['company', 'Company'], ['title', 'Job title'], ['location', 'Location'], ['workMode', 'Work mode (remote, hybrid, onsite)'],
  ['employmentType', 'Employment type'], ['experienceMin', 'Minimum years'], ['salaryMax', 'Top of salary range'],
  ['applicationEmail', 'Application email'], ['applicationUrl', 'Application URL'], ['providerJobId', 'Job ID'],
  ['requiredSkills', 'Required skills (comma separated)', true], ['preferredSkills', 'Preferred skills (comma separated)', true],
];
const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

export default function Analyzer() {
  const [tab, setTab] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('');
  const [image, setImage] = useState<{ mime: string; base64: string; preview: string } | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [desc, setDesc] = useState('');
  const [job, setJob] = useState<any>(null);
  const [dupe, setDupe] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profileId, setProfileId] = useState('');
  const [report, setReport] = useState<any>(null);
  const [draft, setDraft] = useState({ email: '', confidence: 'unverified', subject: '', body: '' });
  const [done, setDone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    api<any[]>('/career-profiles').then((p) => { setProfiles(p); if (p[0]) setProfileId(p[0]._id); }).catch((e) => setErr(errText(e)));
  }, []);

  function readFile(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setErr('Use a PNG, JPG or WebP image.'); return; }
    if (file.size > 8 * 1024 * 1024) { setErr('Image is larger than 8 MB.'); return; }
    const r = new FileReader();
    r.onload = () => { const url = String(r.result); setImage({ mime: file.type, base64: url.split(',')[1], preview: url }); setErr(''); };
    r.readAsDataURL(file);
  }
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/'));
      if (f) { setTab('image'); readFile(f); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  async function analyze() {
    setErr(''); setBusy('analyze'); setForm(null); setJob(null); setReport(null); setDone('');
    try {
      const r = tab === 'text'
        ? await api('/jobs/analyze', { body: { text } })
        : await api('/jobs/analyze-screenshot', { body: { mime: image!.mime, base64: image!.base64 } });
      const j = r.job;
      setForm(Object.fromEntries(FIELDS.map(([k]) => [k, Array.isArray(j[k]) ? j[k].join(', ') : j[k] == null ? '' : String(j[k])])));
      setMissing(r.missingFields);
      setDesc(j.description ?? '');
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }

  async function save() {
    if (!form) return;
    setErr(''); setBusy('save');
    try {
      const wm = form.workMode.trim().toLowerCase();
      const body = {
        company: form.company, title: form.title, location: form.location || undefined,
        workMode: ['remote', 'hybrid', 'onsite'].includes(wm) ? wm : undefined,
        employmentType: form.employmentType || undefined, description: desc || undefined,
        experienceMin: num(form.experienceMin), salaryMax: num(form.salaryMax),
        applicationEmail: form.applicationEmail || undefined, applicationUrl: form.applicationUrl || undefined,
        providerJobId: form.providerJobId || undefined,
        requiredSkills: split(form.requiredSkills), preferredSkills: split(form.preferredSkills),
        source: image ? 'screenshot' : 'pasted-text',
      };
      const r = await api('/jobs', { body });
      setJob(r.job); setDupe(!r.created);
      setDraft((d) => ({ ...d, email: r.job.applicationEmail ?? '', confidence: r.job.applicationEmail ? 'source_reported' : 'unverified' }));
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }

  async function match() {
    setErr(''); setBusy('match');
    try {
      const r = await api(`/jobs/${job._id}/match`, { body: { careerProfileId: profileId } });
      setReport(r);
      const p = profiles.find((x) => x._id === profileId);
      setDraft((d) => ({
        ...d,
        subject: `Application: ${job.title} – ${job.company}`,
        body: `Hello Hiring Team,\n\nI am applying for the ${job.title} role at ${job.company}.` +
          (r.matchedRequired.length ? ` My background includes ${r.matchedRequired.slice(0, 5).join(', ')}` : '') +
          (p ? ` across ${p.yearsExperience} years of experience.` : '.') +
          (r.missingRequired.length ? `\n\nI have not yet used ${r.missingRequired.join(', ')} in production and would be glad to discuss how I would close that gap.` : '') +
          `\n\nMy resume is attached.\n\nKind regards`,
      }));
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }

  async function createDraft() {
    setErr(''); setBusy('draft');
    try {
      await api('/applications/drafts', { body: {
        jobId: job._id, careerProfileId: profileId, recipientEmail: draft.email, recipientConfidence: draft.confidence,
        subject: draft.subject, body: draft.body, matchScore: report?.score,
      } });
      setDone('Draft saved. Open the tracker to approve and send it.');
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }

  const canAnalyze = tab === 'text' ? text.trim().length >= 40 : !!image;
  return (
    <>
      <h1>Job Analyzer</h1>
      <p className="muted" style={{ margin: 0 }}>Add a job from pasted text or a screenshot. You review everything before it is saved.</p>
      {err && <div className="msg err" role="alert">{err}</div>}

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div role="tablist" className="row">
          <button role="tab" aria-selected={tab === 'text'} className={`btn ${tab === 'text' ? 'primary' : ''}`} onClick={() => setTab('text')}>Paste text</button>
          <button role="tab" aria-selected={tab === 'image'} className={`btn ${tab === 'image' ? 'primary' : ''}`} onClick={() => setTab('image')}>Screenshot</button>
        </div>
        {tab === 'text' ? (
          <label className="f">Job description<textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the full job post (at least 40 characters)" /></label>
        ) : (
          <div>
            <label className="f">Screenshot (PNG, JPG or WebP, up to 8 MB). You can also paste an image with Ctrl V.
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files?.[0] && readFile(e.target.files[0])} />
            </label>
            {image && <img src={image.preview} alt="Screenshot preview" style={{ maxWidth: 360, marginTop: 12, borderRadius: 8, border: '1px solid var(--line)' }} />}
          </div>
        )}
        <div className="faint">Text inside a job post is treated as data. Instructions inside it never change your rules.</div>
        <button className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={!canAnalyze || busy === 'analyze'} onClick={analyze}>{busy === 'analyze' ? 'Extracting' : 'Extract details'}</button>
      </section>

      {form && !job && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>Review extracted details</h2>
          {missing.length > 0 && <div className="msg warn">Not found, left empty rather than guessed: {missing.join(', ')}.</div>}
          <div className="row">
            {FIELDS.map(([k, label, wide]) => (
              <label key={k} className="f" style={{ flex: wide ? '1 1 100%' : '1 1 220px' }}>{label}
                <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-invalid={missing.includes(k) && !form[k]} />
              </label>
            ))}
          </div>
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={!form.company || !form.title || busy === 'save'} onClick={save}>Save job</button>
        </section>
      )}

      {job && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>{job.title} · {job.company}</h2>
          {dupe && <div className="msg warn">This job was already saved. Its record was refreshed instead of duplicated.</div>}
          {profiles.length === 0 ? (
            <div className="msg warn">Create a <Link href="/profiles" style={{ textDecoration: 'underline' }}>career profile</Link> to score this job.</div>
          ) : (
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <label className="f col">Career profile
                <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>{profiles.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
              </label>
              <button className="btn primary" disabled={busy === 'match'} onClick={match}>Score this job</button>
            </div>
          )}
        </section>
      )}

      {report && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row" style={{ alignItems: 'center' }}>
            <b style={{ fontSize: 32 }}>{report.score}</b><span className="muted">of 100</span>
            <span className={`pill ${report.recommendation === 'apply' ? 'ok' : report.recommendation === 'consider' ? 'warn' : 'bad'}`}>Recommendation: {report.recommendation}</span>
            <span className="pill">Confidence: {report.confidence}</span>
          </div>
          <div className="faint">{report.disclaimer}</div>
          {report.mandatoryFailures.map((m: string) => <div key={m} className="msg err">{m}</div>)}
          {report.breakdown.map((b: any) => (
            <div key={b.key} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ flex: '0 0 150px' }} className="muted">{b.label}</span>
              <div className="bar" style={{ flex: 1 }}><i style={{ width: `${b.score ?? 0}%` }} /></div>
              <span style={{ flex: '0 0 40px', textAlign: 'right' }}>{b.score ?? 'n/a'}</span>
            </div>
          ))}
          <div className="row">
            <div className="col"><b>Matched required</b><div>{report.matchedRequired.join(', ') || 'None'}</div></div>
            <div className="col"><b>Missing required</b><div>{report.missingRequired.join(', ') || 'None'}</div></div>
            <div className="col"><b>Missing preferred</b><div>{report.missingPreferred.join(', ') || 'None'}</div></div>
          </div>
          {report.concerns.length > 0 && <ul style={{ margin: 0 }}>{report.concerns.map((c: string) => <li key={c}>{c}</li>)}</ul>}
          {report.missingInfo.length > 0 && <div className="msg warn">Not scored: {report.missingInfo.join(' ')}</div>}
        </section>
      )}

      {report && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>Draft application</h2>
          <div className="row">
            <label className="f col" style={{ flex: '2 1 260px' }}>To<input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
            <label className="f col">Recipient confidence
              <select value={draft.confidence} onChange={(e) => setDraft({ ...draft, confidence: e.target.value })}>
                <option value="verified">Verified</option><option value="source_reported">Listed in the job post</option>
                <option value="inferred">Inferred</option><option value="unverified">Unverified</option>
              </select>
            </label>
          </div>
          <label className="f">Subject<input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></label>
          <label className="f">Message<textarea style={{ minHeight: 220 }} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
          <div className="faint">Add your name before sending. Nothing is sent from this page.</div>
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={!draft.email || !draft.subject || !draft.body || busy === 'draft'} onClick={createDraft}>Save draft</button>
          {done && <div className="msg ok">{done} <Link href="/applications" style={{ textDecoration: 'underline' }}>Open tracker</Link></div>}
        </section>
      )}
    </>
  );
}
