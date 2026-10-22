'use client';
import { useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

export default function Prep() {
  const [jobs, setJobs] = useState<any[]>([]); const [id, setId] = useState(''); const [kit, setKit] = useState<any>(null); const [err, setErr] = useState('');
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => { api('/jobs').then((r) => setJobs(r.items ?? r)).catch((e) => setErr(errText(e))); }, []);
  useEffect(() => { setKit(null); setDone({}); if (id) api(`/prep/${id}`).then(setKit).catch((e) => setErr(errText(e))); }, [id]);
  const tick = (k: string) => <input type="checkbox" checked={!!done[k]} onChange={(e) => setDone({ ...done, [k]: e.target.checked })} aria-label="Practiced" />;
  const total = kit ? kit.technical.reduce((a: number, t: any) => a + t.questions.length, 0) + kit.behavioral.length : 0;
  const n = Object.values(done).filter(Boolean).length;
  return (
    <>
      <div className="ph"><div><h1>Interview Prep</h1><p>Questions come from a fixed bank matched to the job’s skills and your known gaps. It is a practice list, not a prediction of what you will be asked.</p></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}
      <section className="card"><label className="f">Job<select value={id} onChange={(e) => setId(e.target.value)}><option value="">Choose a saved job…</option>{jobs.map((j) => <option key={j._id} value={j._id}>{j.title} · {j.company}</option>)}</select></label></section>
      {!kit && <section className="card pg-empty"><div className="big">🎤</div><b>Pick a saved job to get your practice kit</b><span>Technical questions, behavioral prompts, gaps to address and a STAR frame.</span></section>}
      {kit && (
        <div className="grid">
          <div className="s7 stack">
            <section className="card"><div className="card-h"><h2>Technical</h2><span className="faint">{n}/{total} practiced</span></div>
              <div className="bar" style={{ marginBottom: 8 }}><i style={{ width: `${total ? (n / total) * 100 : 0}%` }} /></div>
              {kit.technical.length === 0 ? <div className="empty">No known skills on this job to build questions from.</div> : kit.technical.map((t: any) => (
                <div key={t.skill} style={{ marginTop: 8 }}><span className="pill">{t.skill}</span>{t.questions.map((q: string) => <label key={q} style={{ display: 'flex', gap: 8, padding: '5px 0', alignItems: 'flex-start' }}>{tick(q)}<span>{q}</span></label>)}</div>))}
            </section>
            <section className="card"><h2>Behavioral</h2>{kit.behavioral.map((q: string) => <label key={q} style={{ display: 'flex', gap: 8, padding: '5px 0', alignItems: 'flex-start' }}>{tick(q)}<span>{q}</span></label>)}</section>
          </div>
          <div className="s5 stack">
            <section className="card"><h2>Gaps to address</h2>
              {!kit.basedOnMatch && <div className="msg warn">Run a match for this job in the Analyzer to see your personal gaps.</div>}
              {kit.basedOnMatch && kit.gaps.length === 0 && <div className="msg ok">No missing required skills in your latest match.</div>}
              {kit.gaps.map((g: any) => <div key={g.skill} style={{ marginTop: 8 }}><span className="pill bad">{g.skill}</span><div className="faint">{g.talkingPoint}</div></div>)}</section>
            <section className="card"><h2>STAR answer frame</h2>{Object.entries(kit.star).map(([k, v]) => <div key={k} style={{ marginTop: 6 }}><b style={{ textTransform: 'capitalize' }}>{k}</b><div className="faint">{v as string}</div></div>)}</section>
            <section className="card"><h2>Ask them</h2><ul style={{ margin: 0, paddingLeft: 18 }}>{kit.askThem.map((q: string) => <li key={q}>{q}</li>)}</ul></section>
          </div>
        </div>)}
    </>
  );
}
