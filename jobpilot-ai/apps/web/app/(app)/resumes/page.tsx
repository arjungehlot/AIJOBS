'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Gauge } from '@/components/charts';
import { api, errText } from '@/lib/api';

const SAMPLE = `Aarav Mehta — Full Stack Developer\n\nSkills: HTML, CSS, JavaScript, React, Node.js, MongoDB, Git\n\nExperience\nBuilt REST APIs in Node.js and Express serving 40k users. Wrote React dashboards and added Jest tests. Shipped CI/CD with Docker on AWS.`;

export default function Resumes() {
  const [list, setList] = useState<any[] | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [sel, setSel] = useState<string>(''); const [jobId, setJobId] = useState('');
  const [res, setRes] = useState<any>(null); const [tailor, setTailor] = useState<any>(null);
  const [form, setForm] = useState({ title: '', targetRole: '', text: '' });
  const [up, setUp] = useState({ title: '', targetRole: '' }); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [ok, setOk] = useState('');
  const [err, setErr] = useState('');
  const load = () => api<any[]>('/resumes').then((r) => { setList(r); if (!sel && r[0]) setSel(r[0]._id); }).catch((e) => setErr(errText(e)));
  useEffect(() => { load(); api('/jobs').then((r) => setJobs(r.items ?? r)).catch(() => undefined); }, []);
  useEffect(() => { setRes(null); setTailor(null); if (sel && jobId) api(`/resumes/${sel}/analyze`, { body: { jobId } }).then(setRes).catch((e) => setErr(errText(e))); }, [sel, jobId]);

  async function create(e: FormEvent) {
    e.preventDefault(); setErr('');
    try { const r = await api('/resumes', { body: { ...form, targetRole: form.targetRole || undefined } }); setForm({ title: '', targetRole: '', text: '' }); setSel(r._id); load(); } catch (x) { setErr(errText(x)); }
  }
  async function upload(e: FormEvent) {
    e.preventDefault(); if (!file) return; setErr(''); setOk(''); setBusy(true);
    try {
      const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = () => rej(new Error('read')); r.readAsDataURL(file); });
      const mime = file.type === 'text/plain' ? 'text/plain' : 'application/pdf';
      const r = await api('/resumes/upload', { body: { title: up.title || file.name.replace(/\.[^.]+$/, ''), targetRole: up.targetRole || undefined, filename: file.name, mime, base64: b64 } });
      setUp({ title: '', targetRole: '' }); setFile(null); setSel(r._id); setOk(`Uploaded. ${r.skills.length} skills found. This file will be attached to emails you send.`); load();
    } catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  }
  async function doTailor() {
    setErr('');
    try { const r = await api(`/resumes/${sel}/tailor`, { body: { jobId } }); setTailor(r); if (r.changed) load(); } catch (x) { setErr(errText(x)); }
  }
  const cur = list?.find((r) => r._id === sel);

  return (
    <>
      <div className="ph"><div><h1>Resume studio</h1><p>Check how well a resume covers a job’s skills. Tailoring only reorders your existing skills line, so it can never invent experience. The original stays untouched.</p></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}{ok && <div className="msg ok">{ok}</div>}
      <div className="grid">
        <div className="s4 stack">
          <section className="card">
            <h2>Your versions</h2>
            {!list ? <div className="muted">Loading</div> : list.length === 0 ? <div className="empty">No resume yet. Paste one below.</div> : list.map((r) => (
              <div key={r._id} onClick={() => setSel(r._id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSel(r._id)}
                style={{ padding: '9px 10px', borderRadius: 9, cursor: 'pointer', marginTop: 6, border: `1px solid ${sel === r._id ? 'var(--primary)' : 'var(--line)'}`, background: sel === r._id ? 'var(--primary-50)' : '#fff' }}>
                <b>{r.title}</b> {r.kind === 'tailored' && <span className="pill">tailored</span>}
                <div className="faint">{r.targetRole ?? 'General'} · v{r.version} · {r.skills.length} skills found{r.fileName ? ` · 📎 ${r.fileName}` : ''}</div>
              </div>))}
          </section>
          <form className="card stack" onSubmit={upload}>
            <div className="card-h"><h2>Upload resume (PDF)</h2><span className="pill ok">attached to emails</span></div>
            <label className="f">File<input type="file" accept="application/pdf,text/plain,.pdf,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
            <label className="f">Title<input value={up.title} placeholder={file?.name ?? 'e.g. Full Stack – base'} onChange={(e) => setUp({ ...up, title: e.target.value })} /></label>
            <label className="f">Target role<input value={up.targetRole} onChange={(e) => setUp({ ...up, targetRole: e.target.value })} /></label>
            <button className="btn primary" disabled={!file || busy}>{busy ? 'Reading your resume…' : 'Upload & read'}</button>
            <div className="faint">Up to 4 MB. The AI reads the text for scoring and email writing; the original PDF is what gets attached. Use a text-based PDF, not a scan.</div>
          </form>
          <form className="card stack" onSubmit={create}>
            <div className="card-h"><h2>Add resume text</h2><button type="button" className="btn sm" onClick={() => setForm({ title: 'Full Stack – base', targetRole: 'Full Stack Developer', text: SAMPLE })}>Example</button></div>
            <label className="f">Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="f">Target role<input value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })} /></label>
            <label className="f">Resume text<textarea required rows={8} style={{ height: 'auto' }} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Paste plain text. Include a line starting with “Skills:”." /></label>
            <button className="btn primary">Save resume</button>
          </form>
        </div>
        <div className="s8 stack">
          <section className="card stack">
            <div className="card-h"><h2>Check against a job</h2></div>
            <div className="row">
              <label className="f col">Job<select value={jobId} onChange={(e) => setJobId(e.target.value)}><option value="">Choose a saved job…</option>{jobs.map((j) => <option key={j._id} value={j._id}>{j.title} · {j.company}</option>)}</select></label>
            </div>
            {!cur && <div className="empty">Select or add a resume first.</div>}
            {cur && !jobId && <div className="empty">Choose a job to see skill coverage.</div>}
            {res && (
              <div className="stack">
                <div className="row" style={{ alignItems: 'center', gap: 20 }}>
                  {res.score !== null ? <Gauge value={res.score} label="ATS coverage" /> : <div className="faint">This job lists no skills to compare.</div>}
                  <div className="col"><div className="faint">Required skills found</div><b style={{ fontSize: 20 }}>{res.requiredCoverage ?? '–'}{res.requiredCoverage !== null && '%'}</b>
                    <div className="faint" style={{ marginTop: 6 }}>Preferred skills found</div><b style={{ fontSize: 20 }}>{res.preferredCoverage ?? '–'}{res.preferredCoverage !== null && '%'}</b></div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {res.foundRequired.map((s: string) => <span key={s} className="pill ok">✓ {s}</span>)}
                  {res.missingRequired.map((s: string) => <span key={s} className="pill bad">✕ {s}</span>)}
                  {res.foundPreferred.map((s: string) => <span key={s} className="pill gray">✓ {s}</span>)}
                  {res.missingPreferred.map((s: string) => <span key={s} className="pill warn">+ {s}</span>)}
                </div>
                {res.buried?.length > 0 && <div className="msg warn">Buried low in the resume: {res.buried.join(', ')}. Recruiters scan the top first.</div>}
                <ul className="faint" style={{ margin: 0, paddingLeft: 18 }}>{res.suggestions.map((s: string) => <li key={s}>{s}</li>)}</ul>
                <div className="msg" style={{ background: 'var(--line-2)' }}>Missing skills are only marked missing if the exact word is absent. Add them only if you truly have the skill.</div>
                <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={doTailor}>Create tailored copy (reorder skills)</button>
              </div>)}
            {tailor && (tailor.changed ? (
              <div className="stack">
                <div className="msg ok">Saved as “{tailor.resume.title}”. Coverage: {tailor.coverageBefore.score ?? '–'} → {tailor.coverageAfter.score ?? '–'}.</div>
                <div className="grid"><div className="s6"><div className="faint">Before</div><code style={{ display: 'block', background: 'var(--bad-bg)', padding: 8, borderRadius: 8 }}>{tailor.diff.before}</code></div>
                  <div className="s6"><div className="faint">After</div><code style={{ display: 'block', background: 'var(--ok-bg)', padding: 8, borderRadius: 8 }}>{tailor.diff.after}</code></div></div>
              </div>) : <div className="msg warn">{tailor.message}</div>)}
          </section>
          {cur && <ResumeText id={cur._id} onDelete={() => api(`/resumes/${cur._id}`, { method: 'DELETE' }).then(() => { setSel(''); load(); })} />}
        </div>
      </div>
    </>
  );
}

function ResumeText({ id, onDelete }: { id: string; onDelete: () => void }) {
  const [t, setT] = useState<any>(null);
  useEffect(() => { setT(null); api(`/resumes/${id}`).then(setT).catch(() => undefined); }, [id]);
  return (
    <section className="card">
      <div className="card-h"><h2>Text</h2><button className="btn sm" onClick={onDelete}>Delete version</button></div>
      <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: 12.5, maxHeight: 260, overflow: 'auto' }}>{t?.text ?? 'Loading…'}</pre>
    </section>
  );
}
