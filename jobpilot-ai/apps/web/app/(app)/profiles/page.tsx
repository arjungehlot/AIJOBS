'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

const csv = (s: FormDataEntryValue | null) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

export default function Profiles() {
  const [items, setItems] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const load = () => api<any[]>('/career-profiles').then(setItems).catch((e) => setErr(errText(e)));
  useEffect(() => { load(); }, []);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr('');
    const f = new FormData(e.currentTarget);
    try {
      await api('/career-profiles', { body: {
        name: f.get('name'), skills: csv(f.get('skills')), yearsExperience: Number(f.get('years') || 0),
        workModes: f.getAll('modes'), locations: csv(f.get('locations')),
        minSalary: f.get('salary') ? Number(f.get('salary')) : undefined,
        excludedCompanies: csv(f.get('exCompanies')), excludedKeywords: csv(f.get('exKeywords')),
        minMatchScore: Number(f.get('min') || 70), maxDailyApplications: Number(f.get('daily') || 10),
      } });
      (e.target as HTMLFormElement).reset(); load();
    } catch (x) { setErr(errText(x)); }
  }

  const ICON: Record<string, string> = { remote: '🏠', hybrid: '🔀', onsite: '🏢' };
  return (
    <>
      <div className="ph"><div><h1>Career profiles</h1><p>Each profile has its own skills, preferences and limits. Matching and sending rules use the profile you pick.</p></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}
      <div className="pg-two">
        <form className="card pg-form" onSubmit={create}>
          <div className="pg-h"><span className="ic" style={{ background: 'linear-gradient(135deg,#818CF8,#4F46E5)' }}>＋</span><h2>New profile</h2></div>
          <label className="az-f">Name<input name="name" required placeholder="Full Stack Developer" /></label>
          <div className="pg-2"><label className="az-f">Years of experience<input name="years" type="number" min={0} step="0.5" placeholder="2" /></label>
            <label className="az-f">Minimum salary<input name="salary" type="number" min={0} placeholder="600000" /></label></div>
          <label className="az-f">Skills (comma separated)<input name="skills" placeholder="Node.js, React, TypeScript, PostgreSQL" /></label>
          <label className="az-f">Preferred cities<input name="locations" placeholder="Bengaluru, Pune" /></label>
          <div className="az-f">Work mode
            <div className="pg-chips">{['remote', 'hybrid', 'onsite'].map((m) => <label key={m} className="pg-chk"><input type="checkbox" name="modes" value={m} /><span>{ICON[m]} {m}</span></label>)}</div></div>
          <div className="pg-2"><label className="az-f">Excluded companies<input name="exCompanies" /></label>
            <label className="az-f">Excluded keywords<input name="exKeywords" placeholder="unpaid" /></label></div>
          <div className="pg-2"><label className="az-f">Min match score<input name="min" type="number" min={0} max={100} defaultValue={70} /></label>
            <label className="az-f">Max applications / day<input name="daily" type="number" min={0} max={200} defaultValue={10} /></label></div>
          <button className="btn primary">Save profile</button>
        </form>
        <section className="pg-list">
          <div className="card-h" style={{ margin: 0 }}><h2>Your profiles</h2>{items && <small>{items.length} saved</small>}</div>
          {!items ? <div className="card muted">Loading</div> : items.length === 0 ? <div className="card pg-empty"><div className="big">🧑‍💻</div><b>No profiles yet</b><span>Create your first profile on the left.</span></div> : (
            items.map((p) => (
              <article key={p._id} className="card pg-prof">
                <div className="pg-av lg">{String(p.name || '?')[0].toUpperCase()}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3>{p.name}</h3>
                  <div className="meta"><span className="pill">{p.yearsExperience ?? 0} yrs</span><span className="pill gray">min score {p.minMatchScore}</span><span className="pill gray">{p.maxDailyApplications}/day</span>
                    {(p.workModes ?? []).map((m: string) => <span key={m} className="pill ok">{ICON[m]} {m}</span>)}</div>
                  <div className="az-tags">{p.skills?.length ? p.skills.map((t: string) => <span key={t} className="tag req">{t}</span>) : <span className="faint">No skills listed</span>}</div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </>
  );
}
