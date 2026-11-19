'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Gauge } from '@/components/charts';
import { Icon } from '@/components/ui';
import { api, errText } from '@/lib/api';
import { ResumeView } from '@/components/resume-view';

const SAMPLE = `Aarav Mehta — Full Stack Developer\n\nSkills: HTML, CSS, JavaScript, React, Node.js, MongoDB, Git\n\nExperience\nBuilt REST APIs in Node.js and Express serving 40k users. Wrote React dashboards and added Jest tests. Shipped CI/CD with Docker on AWS.`;

export default function Resumes() {
  const [list, setList] = useState<any[] | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [sel, setSel] = useState<string>(''); const [jobId, setJobId] = useState('');
  const [res, setRes] = useState<any>(null); const [tailor, setTailor] = useState<any>(null);
  const [form, setForm] = useState({ title: '', targetRole: '', text: '' });
  const [aiBusy, setAiBusy] = useState(''); const [aiUndo, setAiUndo] = useState<string | null>(null); const [aiMsg, setAiMsg] = useState('');
  async function aiEdit(action: string) {
    setAiBusy(action); setAiMsg(''); setErr('');
    try {
      const r = await api<{ text: string }>('/resumes/enhance', { body: { text: form.text, targetRole: form.targetRole || undefined, action } });
      setAiUndo(form.text); setForm((f) => ({ ...f, text: r.text })); setAiMsg('Updated by AI. Check every line is true before saving.');
    } catch (x) { setErr(errText(x)); } finally { setAiBusy(''); }
  }
  const [up, setUp] = useState({ title: '', targetRole: '' }); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [ok, setOk] = useState('');
  const [err, setErr] = useState('');
  const [addTab, setAddTab] = useState<'pdf' | 'text'>('pdf'); const [defId, setDefId] = useState('');
  const load = () => api<any[]>('/resumes').then((r) => { setList(r); if (!sel && r[0]) setSel(r[0]._id); }).catch((e) => setErr(errText(e)));
  useEffect(() => { load(); api('/ai/defaults').then((d: any) => setDefId(d?.defaultResumeId ?? '')).catch(() => undefined); api('/jobs').then((r) => setJobs(r.items ?? r)).catch(() => undefined); }, []);
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
  async function makeDefault(id: string) { try { const d: any = await api('/ai/defaults', { method: 'PUT', body: { defaultResumeId: id } }); setDefId(d?.defaultResumeId ?? id); setOk('Default resume updated. Emails and one-click apply will attach it.'); } catch (x) { setErr(errText(x)); } }
  const cur = list?.find((r) => r._id === sel);

  return (
    <div className="rs">
      <div className="ph"><div><h1>Resume studio</h1><p>Upload resumes, see how well they cover a job, and pick the one attached to your emails. Tailoring only reorders your skills, so it never invents experience.</p></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}{ok && <div className="msg ok">{ok}</div>}
      <div className="rs-grid">
        <aside className="rs-side">
          <section className="card rs-versions">
            <div className="card-h"><h2>Your resumes</h2><small>{list?.length ?? 0}</small></div>
            {!list ? <div className="muted">Loading…</div> : list.length === 0 ? <div className="empty">No resume yet. Upload or paste one below.</div> : (
              <div className="rs-list">{list.map((r) => (
                <button key={r._id} type="button" onClick={() => setSel(r._id)} className={`rs-item ${sel === r._id ? 'on' : ''}`}>
                  <span className="rs-ic"><Icon name="file" size={15} /></span>
                  <span className="rs-tx"><b>{r.title}</b><small>{r.targetRole ?? 'General'} · v{r.version} · {r.skills.length} skills</small></span>
                  <span className="rs-bd">{defId === r._id && <em className="pill ok">★ default</em>}{r.kind === 'tailored' && <em className="pill">tailored</em>}{r.fileName && <em className="pill gray">PDF</em>}</span>
                </button>))}</div>)}
          </section>

          <section className="card rs-add">
            <div role="tablist" className="seg" style={{ marginBottom: 8 }}>
              <button role="tab" type="button" aria-selected={addTab === 'pdf'} onClick={() => setAddTab('pdf')}>⬆ Upload PDF</button>
              <button role="tab" type="button" aria-selected={addTab === 'text'} onClick={() => setAddTab('text')}>📝 Paste text</button>
            </div>
            {addTab === 'pdf' ? (
              <form className="stack" onSubmit={upload}>
                <label className={`rs-drop ${file ? 'has' : ''}`}><Icon name="file" size={18} /><b>{file ? file.name : 'Choose a PDF'}</b><small>{file ? `${Math.round(file.size / 1024)} KB` : 'Text-based PDF, up to 4 MB, attached to emails'}</small>
                  <input type="file" hidden accept="application/pdf,text/plain,.pdf,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
                <div className="rs-two">
                  <label className="f">Title<input value={up.title} placeholder={file?.name?.replace(/\.[^.]+$/, '') ?? 'e.g. Full Stack – base'} onChange={(e) => setUp({ ...up, title: e.target.value })} /></label>
                  <label className="f">Target role<input value={up.targetRole} placeholder="Optional" onChange={(e) => setUp({ ...up, targetRole: e.target.value })} /></label>
                </div>
                <button className="btn primary" disabled={!file || busy}>{busy ? 'Reading your resume…' : 'Upload & read'}</button>
              </form>
            ) : (
              <form className="stack" onSubmit={create}>
                <div className="rs-two">
                  <label className="f">Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
                  <label className="f">Target role<input value={form.targetRole} placeholder="Optional" onChange={(e) => setForm({ ...form, targetRole: e.target.value })} /></label>
                </div>
                <div className="ou-ai">
                  <div className="ou-ai-row">
                    <span className="ou-ai-ic"><Icon name="spark" size={15} /></span>
                    <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}><b style={{ fontSize: 13 }}>AI Resume Assistant</b><div className="faint" style={{ fontSize: 11.5 }}>Cleans up layout and wording. It never adds facts.</div></div>
                    <button type="button" className="ou-ai-go" onClick={() => aiEdit('structure')} disabled={!!aiBusy || form.text.trim().length < 20}><Icon name="spark" size={14} />{aiBusy === 'structure' ? 'Working…' : 'Format with AI'}</button>
                  </div>
                  <div className="ou-ai-chips" role="group" aria-label="Enhance the resume">
                    <span>Enhance</span>
                    {([['improve', 'Improve wording'], ['grammar', 'Fix grammar'], ['ats', 'ATS-friendly']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => aiEdit(k)} disabled={!!aiBusy || form.text.trim().length < 20}>{aiBusy === k ? '…' : l}</button>)}
                    {aiUndo !== null && <button type="button" className="ou-undo" onClick={() => { setForm((f) => ({ ...f, text: aiUndo })); setAiUndo(null); setAiMsg(''); }}>↶ Undo</button>}
                  </div>
                  {aiMsg && <div className="ou-ai-note">{aiMsg}</div>}
                </div>
                <label className="f">Resume text<textarea required rows={7} style={{ height: 'auto' }} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Paste plain text. Include a line starting with “Skills:”." /></label>
                <div className="rs-two"><button className="btn primary">Save resume</button><button type="button" className="btn" onClick={() => setForm({ title: 'Full Stack – base', targetRole: 'Full Stack Developer', text: SAMPLE })}>Fill example</button></div>
              </form>)}
          </section>
        </aside>

        <main className="rs-main">
          {cur && (
            <section className="card rs-head">
              <span className="rs-ic lg"><Icon name="file" size={18} /></span>
              <div className="rs-ht"><h2>{cur.title}</h2><small>{cur.targetRole ?? 'General'} · v{cur.version} · {cur.skills.length} skills found{cur.fileName ? ` · ${cur.fileName}` : ''}</small></div>
              <div className="rs-act">
                {defId === cur._id ? <span className="pill ok">★ Used for emails</span> : <button className="btn sm" onClick={() => makeDefault(cur._id)}>★ Use for emails</button>}
                <button className="btn sm" onClick={() => api(`/resumes/${cur._id}`, { method: 'DELETE' }).then(() => { setSel(''); load(); })}>Delete</button>
              </div>
            </section>)}

          <section className="card rs-check">
            <div className="card-h"><h2>Check against a job</h2>{res && res.score !== null && <small>ATS coverage {res.score}%</small>}</div>
            <label className="f"><span className="sr-only">Job</span><select value={jobId} onChange={(e) => setJobId(e.target.value)}><option value="">Choose a saved job…</option>{jobs.map((j) => <option key={j._id} value={j._id}>{j.title} · {j.company}</option>)}</select></label>
            {!cur && <div className="empty">Select or add a resume first.</div>}
            {cur && !jobId && <div className="faint">Pick a job to see which of its skills your resume covers.</div>}
            {res && (
              <div className="stack">
                <div className="rs-cov">
                  {res.score !== null ? <Gauge value={res.score} label="ATS coverage" size={84} /> : <div className="faint">This job lists no skills to compare.</div>}
                  <div className="rs-num"><span>Required found</span><b>{res.requiredCoverage ?? '–'}{res.requiredCoverage !== null && '%'}</b></div>
                  <div className="rs-num"><span>Preferred found</span><b>{res.preferredCoverage ?? '–'}{res.preferredCoverage !== null && '%'}</b></div>
                  <button className="btn primary sm" style={{ marginLeft: 'auto' }} onClick={doTailor}>Create tailored copy</button>
                </div>
                <div className="rs-pills">
                  {res.foundRequired.map((s: string) => <span key={s} className="pill ok">✓ {s}</span>)}
                  {res.missingRequired.map((s: string) => <span key={s} className="pill bad">✕ {s}</span>)}
                  {res.foundPreferred.map((s: string) => <span key={s} className="pill gray">✓ {s}</span>)}
                  {res.missingPreferred.map((s: string) => <span key={s} className="pill warn">+ {s}</span>)}
                </div>
                {res.buried?.length > 0 && <div className="msg warn">Buried low in the resume: {res.buried.join(', ')}. Recruiters scan the top first.</div>}
                {res.suggestions.length > 0 && <ul className="faint" style={{ margin: 0, paddingLeft: 18 }}>{res.suggestions.map((s: string) => <li key={s}>{s}</li>)}</ul>}
                <div className="faint" style={{ fontSize: 11.5 }}>A skill counts as missing only if the exact word is absent. Add it only if you truly have it.</div>
              </div>)}
            {tailor && (tailor.changed ? (
              <div className="stack">
                <div className="msg ok">Saved as “{tailor.resume.title}”. Coverage: {tailor.coverageBefore.score ?? '–'} → {tailor.coverageAfter.score ?? '–'}.</div>
                <div className="rs-two"><div><div className="faint">Before</div><code className="rs-code bad">{tailor.diff.before}</code></div><div><div className="faint">After</div><code className="rs-code ok">{tailor.diff.after}</code></div></div>
              </div>) : <div className="msg warn">{tailor.message}</div>)}
          </section>

          {cur && <ResumeText id={cur._id} />}
        </main>
      </div>
    </div>
  );
}

function ResumeText({ id }: { id: string }) {
  const [t, setT] = useState<any>(null);
  useEffect(() => { setT(null); api(`/resumes/${id}`).then(setT).catch(() => undefined); }, [id]);
  return (
    <section className="card">
      <div className="card-h"><h2>Resume preview</h2></div>
      <div className="rs-prev">{t?.text ? <ResumeView text={t.text} /> : <span className="faint">Loading…</span>}</div>
    </section>
  );
}
