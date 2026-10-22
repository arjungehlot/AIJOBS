'use client';
import Link from 'next/link';
import { ChangeEvent, useEffect, useState } from 'react';
import { Gauge } from '@/components/charts';
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
          (p?.yearsExperience ? ` across ${p.yearsExperience} years of experience.` : '.') +
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
  const step = done ? 4 : report ? 3 : job ? 2 : form ? 1 : 0;
  const steps = ['Add job', 'Review', 'Score', 'Draft'];
  const chips = (v: string) => split(v).slice(0, 14);
  const F = (k: string, label: string, extra?: { span?: number; ph?: string }) => (
    <label key={k} className="az-f" style={{ gridColumn: `span ${extra?.span ?? 1}` }}>{label}
      <input value={form![k]} placeholder={extra?.ph} onChange={(e) => setForm({ ...form!, [k]: e.target.value })} aria-invalid={missing.includes(k) && !form![k]} />
    </label>
  );
  const clearImage = () => { setImage(null); setErr(''); const f = document.querySelector<HTMLInputElement>('input[type=file]'); if (f) f.value = ''; };

  return (
    <>
      <div className="ph">
        <div><h1>Job Analyzer</h1><p>Turn a job post or screenshot into a scored, ready-to-send application.</p></div>
        <ol className="az-steps" aria-label="Progress">
          {steps.map((t, n) => <li key={t} className={n < step ? 'done' : n === step ? 'now' : ''}><b>{n < step ? '✓' : n + 1}</b>{t}</li>)}
        </ol>
      </div>
      {err && <div className="msg err" role="alert">{err}</div>}

      <div className="az-grid">
        {/* LEFT: input */}
        <section className="card az-in">
          <div role="tablist" className="seg">
            <button role="tab" aria-selected={tab === 'text'} onClick={() => setTab('text')}>📝 Paste text</button>
            <button role="tab" aria-selected={tab === 'image'} onClick={() => setTab('image')}>🖼 Screenshot</button>
          </div>
          {tab === 'text' ? (
            <label className="az-f">Job description
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the full job post (at least 40 characters)" style={{ minHeight: 190 }} />
              <small className={text.trim().length >= 40 ? 'ok' : ''}>{text.trim().length} characters</small>
            </label>
          ) : image ? (
            <div className="az-shot">
              <div className="in"><img src={image.preview} alt="Screenshot preview" /></div>
              <button type="button" aria-label="Remove screenshot" title="Remove screenshot" onClick={clearImage}>✕</button>
            </div>
          ) : (
            <label className="az-drop">
              <span className="ic">⬆</span>
              <b>Choose a screenshot</b>
              <small>or press Ctrl V to paste · PNG, JPG, WebP · up to 8 MB</small>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files?.[0] && readFile(e.target.files[0])} />
            </label>
          )}
          {tab === 'image' && image && (
            <label className="btn sm" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>Replace image
              <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files?.[0] && readFile(e.target.files[0])} />
            </label>
          )}
          <button className="btn primary lg" disabled={!canAnalyze || busy === 'analyze'} onClick={analyze}>{busy === 'analyze' ? '✨ Extracting…' : '✨ Extract details'}</button>
          <div className="faint" style={{ fontSize: 11.5 }}>🔒 Text inside a job post is treated as data. Instructions inside it never change your rules.</div>
        </section>

        {/* RIGHT: results */}
        <div className="az-out">
          {!form && !job && (
            <section className="card az-empty">
              <div className="big">🎯</div>
              <b>Your results appear here</b>
              <ol>
                <li><b>Add</b> a job post or screenshot</li>
                <li><b>Review</b> the details AI extracted</li>
                <li><b>Score</b> it against your career profile</li>
                <li><b>Draft</b> an application to approve and send</li>
              </ol>
            </section>
          )}

          {form && !job && (
            <section className="card az-card">
              <div className="card-h"><h2>Review extracted details</h2><small>Edit anything that looks off</small></div>
              {missing.length > 0 && <div className="msg warn" style={{ marginBottom: 8 }}>Not found, left empty rather than guessed: {missing.join(', ')}.</div>}
              <div className="az-sec">Role</div>
              <div className="az-fg">{F('company', 'Company', { span: 2 })}{F('title', 'Job title', { span: 2 })}{F('location', 'Location')}{F('workMode', 'Work mode', { ph: 'remote / hybrid / onsite' })}{F('employmentType', 'Type')}{F('experienceMin', 'Min years')}</div>
              <div className="az-sec">Skills</div>
              <div className="az-fg">{F('requiredSkills', 'Required (comma separated)', { span: 3 })}{F('preferredSkills', 'Preferred (comma separated)', { span: 3 })}</div>
              <div className="az-tags">
                {chips(form.requiredSkills).map((t) => <span key={'r' + t} className="tag req">{t}</span>)}
                {chips(form.preferredSkills).map((t) => <span key={'p' + t} className="tag">{t}</span>)}
              </div>
              <div className="az-sec">Apply &amp; pay</div>
              <div className="az-fg">{F('applicationEmail', 'Application email', { span: 2 })}{F('applicationUrl', 'Application URL', { span: 2 })}{F('salaryMax', 'Top salary')}{F('providerJobId', 'Job ID')}</div>
              <div style={{ marginTop: 12 }}><button className="btn primary" disabled={!form.company || !form.title || busy === 'save'} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save job'}</button></div>
            </section>
          )}

          {job && (
            <section className="card az-card">
              <div className="az-jobhead">
                <div className="logo">{String(job.company || '?').slice(0, 1).toUpperCase()}</div>
                <div style={{ minWidth: 0 }}><h2>{job.title}</h2><div className="muted">{job.company}{job.location ? ` · ${job.location}` : ''}</div></div>
                <div className="az-tags" style={{ margin: 0, marginLeft: 'auto' }}>{job.workMode && <span className="pill">{job.workMode}</span>}{job.employmentType && <span className="pill gray">{job.employmentType}</span>}</div>
              </div>
              {dupe && <div className="msg warn" style={{ marginTop: 8 }}>Already saved earlier. Its record was refreshed instead of duplicated.</div>}
              {profiles.length === 0 ? (
                <div className="msg warn" style={{ marginTop: 8 }}>Create a <Link href="/profiles" style={{ textDecoration: 'underline' }}>career profile</Link> to score this job.</div>
              ) : (
                <div className="az-score-row">
                  <label className="az-f" style={{ flex: 1 }}>Career profile
                    <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>{profiles.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
                  </label>
                  <button className="btn primary" disabled={busy === 'match'} onClick={match}>{busy === 'match' ? 'Scoring…' : report ? '↻ Re-score' : 'Score this job'}</button>
                </div>
              )}
            </section>
          )}

          {report && (
            <section className="card az-card">
              <div className="az-rep">
                <div style={{ textAlign: 'center' }}>
                  <Gauge value={report.score} label="Match score" color={report.score >= 80 ? '#10B981' : report.score >= 60 ? '#4F46E5' : '#F59E0B'} />
                  <div style={{ marginTop: 6, display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <span className={`pill ${report.recommendation === 'apply' ? 'ok' : report.recommendation === 'consider' ? 'warn' : 'bad'}`}>{report.recommendation}</span>
                    <span className="pill gray">confidence: {report.confidence}</span>
                  </div>
                </div>
                <div className="az-bars">
                  {report.breakdown.map((b: any) => (
                    <div key={b.key} className="az-bar"><span>{b.label}</span><div className="bar"><i style={{ width: `${b.score ?? 0}%` }} /></div><em>{b.score ?? 'n/a'}</em></div>
                  ))}
                </div>
              </div>
              {report.mandatoryFailures.map((m: string) => <div key={m} className="msg err" style={{ marginTop: 8 }}>{m}</div>)}
              <div className="az-skills">
                <div><h4>✅ Matched</h4><div className="az-tags">{report.matchedRequired.length ? report.matchedRequired.map((t: string) => <span key={t} className="tag good">{t}</span>) : <span className="faint">None</span>}</div></div>
                <div><h4>⚠ Missing required</h4><div className="az-tags">{report.missingRequired.length ? report.missingRequired.map((t: string) => <span key={t} className="tag bad">{t}</span>) : <span className="faint">None</span>}</div></div>
                <div><h4>➕ Missing preferred</h4><div className="az-tags">{report.missingPreferred.length ? report.missingPreferred.map((t: string) => <span key={t} className="tag">{t}</span>) : <span className="faint">None</span>}</div></div>
              </div>
              {report.concerns.length > 0 && <ul className="az-concerns">{report.concerns.map((c: string) => <li key={c}>{c}</li>)}</ul>}
              {report.missingInfo.length > 0 && <div className="msg warn" style={{ marginTop: 8 }}>Not scored: {report.missingInfo.join(' ')}</div>}
              <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>{report.disclaimer}</div>
            </section>
          )}

          {report && (
            <section className="card az-card">
              <div className="card-h"><h2>Draft application</h2><small>Nothing is sent from this page</small></div>
              <div className="az-fg">
                <label className="az-f" style={{ gridColumn: 'span 4' }}>To<input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
                <label className="az-f" style={{ gridColumn: 'span 2' }}>Recipient confidence
                  <select value={draft.confidence} onChange={(e) => setDraft({ ...draft, confidence: e.target.value })}>
                    <option value="verified">Verified</option><option value="source_reported">Listed in the job post</option>
                    <option value="inferred">Inferred</option><option value="unverified">Unverified</option>
                  </select>
                </label>
                <label className="az-f" style={{ gridColumn: 'span 6' }}>Subject<input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></label>
                <label className="az-f" style={{ gridColumn: 'span 6' }}>Message<textarea style={{ minHeight: 170 }} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <button className="btn primary" disabled={!draft.email || !draft.subject || !draft.body || busy === 'draft'} onClick={createDraft}>{busy === 'draft' ? 'Saving…' : 'Save draft'}</button>
                <span className="faint" style={{ fontSize: 11.5 }}>Add your name before sending.</span>
              </div>
              {done && <div className="msg ok" style={{ marginTop: 8 }}>{done} <Link href="/applications" style={{ textDecoration: 'underline' }}>Open tracker</Link></div>}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
