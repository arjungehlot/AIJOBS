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

  return (
    <>
      <div className="ph"><div><h1>Career profiles</h1><p>Each profile has its own skills, preferences and limits. Matching and sending rules use the profile you pick.</p></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}
      <form className="card" onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2>New profile</h2>
        <div className="row">
          <label className="f col">Name<input name="name" required placeholder="Full Stack Developer" /></label>
          <label className="f col">Years of experience<input name="years" type="number" min={0} step="0.5" /></label>
          <label className="f col">Minimum salary<input name="salary" type="number" min={0} /></label>
        </div>
        <label className="f">Skills (comma separated)<input name="skills" placeholder="Node.js, React, TypeScript, PostgreSQL" /></label>
        <div className="row">
          <label className="f col">Preferred cities<input name="locations" placeholder="Bengaluru, Pune" /></label>
          <label className="f col">Excluded companies<input name="exCompanies" /></label>
          <label className="f col">Excluded keywords<input name="exKeywords" placeholder="unpaid" /></label>
        </div>
        <fieldset style={{ border: 0, padding: 0, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <legend className="faint" style={{ padding: 0 }}>Work mode</legend>
          {['remote', 'hybrid', 'onsite'].map((m) => <label key={m} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="modes" value={m} style={{ width: 'auto' }} />{m}</label>)}
        </fieldset>
        <div className="row">
          <label className="f col">Minimum match score<input name="min" type="number" min={0} max={100} defaultValue={70} /></label>
          <label className="f col">Max applications per day<input name="daily" type="number" min={0} max={200} defaultValue={10} /></label>
        </div>
        <button className="btn primary" style={{ alignSelf: 'flex-start' }}>Save profile</button>
      </form>
      <section className="card">
        <h2>Your profiles</h2>
        {!items ? <div className="muted">Loading</div> : items.length === 0 ? <div className="empty">No profiles yet.</div> : (
          items.map((p) => (
            <div key={p._id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
              <b>{p.name}</b> <span className="faint">{p.yearsExperience} yrs · min score {p.minMatchScore} · {p.maxDailyApplications}/day</span>
              <div className="faint">{p.skills.join(', ') || 'No skills listed'}</div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
