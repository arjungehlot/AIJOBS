'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

const KIND: Record<string, string> = { follow_up: 'Follow up', deadline: 'Deadline', interview: 'Interview', custom: 'Task' };
const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export default function FollowUps() {
  const [items, setItems] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<'pending' | 'done'>('pending');
  const [err, setErr] = useState('');
  const load = () => api(`/followups?status=${filter}`).then(setItems).catch((e) => setErr(errText(e)));
  useEffect(() => { load(); }, [filter]);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(''); const f = new FormData(e.currentTarget);
    try { await api('/followups', { body: { title: f.get('title'), dueAt: new Date(String(f.get('due')) + 'T09:00:00').toISOString(), kind: f.get('kind') } }); (e.target as HTMLFormElement).reset(); load(); }
    catch (x) { setErr(errText(x)); }
  }
  const run = (id: string, what: string) => api(`/followups/${id}/${what}`, { method: 'POST', body: {} }).then(load).catch((x) => setErr(errText(x)));

  const today = day(new Date());
  const groups = { Overdue: [] as any[], Today: [] as any[], 'Next 7 days': [] as any[], Later: [] as any[] };
  (items ?? []).forEach((t) => { const d = day(new Date(t.dueAt)); (d < today ? groups.Overdue : d === today ? groups.Today : d <= today + 7 * 86400000 ? groups['Next 7 days'] : groups.Later).push(t); });
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(today + i * 86400000); return { d, n: (items ?? []).filter((t) => day(new Date(t.dueAt)) === day(d)).length }; });

  return (
    <>
      <div className="ph"><div><h1>Follow-ups</h1><p>A reminder is created 5 business days after each confirmed send, and cancelled automatically when the recruiter replies. Reminders never send anything.</p></div>
        <div className="seg"><button aria-selected={filter === 'pending'} onClick={() => setFilter('pending')}>Open</button><button aria-selected={filter === 'done'} onClick={() => setFilter('done')}>Done</button></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}
      <div className="grid">
        <div className="s8 stack">
          <section className="card"><div className="row" style={{ gap: 6 }}>
            {week.map((w) => <div key={+w.d} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 9, background: w.n ? 'var(--primary-50)' : 'var(--line-2)' }}>
              <div className="faint">{w.d.toLocaleDateString(undefined, { weekday: 'short' })}</div><b>{w.d.getDate()}</b><div style={{ fontSize: 11, color: w.n ? 'var(--primary)' : 'var(--faint)' }}>{w.n ? `${w.n} due` : '–'}</div></div>)}
          </div></section>
          {!items ? <div className="card muted">Loading</div> : items.length === 0 ? <div className="card empty">{filter === 'pending' ? 'Nothing due. Reminders appear here after you send an application.' : 'Nothing completed yet.'}</div> :
            Object.entries(groups).filter(([, v]) => v.length).map(([name, v]) => (
              <section className="card" key={name}>
                <h2 style={{ color: name === 'Overdue' ? 'var(--bad)' : undefined }}>{name} <span className="faint">({v.length})</span></h2>
                {v.map((t) => (
                  <div key={t._id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--line)' }}>
                    <span className="pill gray">{KIND[t.kind]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}><b>{t.title}</b><div className="faint">{new Date(t.dueAt).toLocaleDateString()} {t.createdBy === 'system' && '· automatic'}</div></div>
                    {filter === 'pending' && <><button className="btn sm primary" onClick={() => run(t._id, 'done')}>Done</button><button className="btn sm" onClick={() => run(t._id, 'cancel')}>Dismiss</button></>}
                  </div>))}
              </section>))}
        </div>
        <form className="card s4 stack" onSubmit={add} style={{ alignSelf: 'start' }}>
          <h2>Add a reminder</h2>
          <label className="f">What<input name="title" required placeholder="Email Priya about the offer" /></label>
          <label className="f">Due<input name="due" type="date" required /></label>
          <label className="f">Type<select name="kind" defaultValue="custom"><option value="custom">Task</option><option value="follow_up">Follow up</option><option value="deadline">Deadline</option><option value="interview">Interview</option></select></label>
          <button className="btn primary">Add</button>
        </form>
      </div>
    </>
  );
}
