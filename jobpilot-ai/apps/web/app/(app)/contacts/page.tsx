'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Icon } from '@/components/ui';
import { api, errText } from '@/lib/api';

const V: Record<string, { tone: string; tip: string }> = {
  verified: { tone: 'ok', tip: 'You confirmed this address works' }, source_reported: { tone: 'ok', tip: 'Listed in the job post or company site' },
  inferred: { tone: 'warn', tip: 'Guessed from a pattern. Needs your confirmation before sending' }, unverified: { tone: 'bad', tip: 'Unknown. Needs your confirmation before sending' },
};

export default function Contacts() {
  const [tab, setTab] = useState<'contacts' | 'companies'>('contacts');
  const [list, setList] = useState<any[] | null>(null);
  const [cos, setCos] = useState<any[] | null>(null);
  const [q, setQ] = useState(''); const [err, setErr] = useState('');
  const load = () => {
    api(`/contacts${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(setList).catch((e) => setErr(errText(e)));
    api('/companies').then(setCos).catch(() => undefined);
  };
  useEffect(() => { load(); }, [q]);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr('');
    const f = new FormData(e.currentTarget); const g = (k: string) => (String(f.get(k) ?? '').trim() || undefined);
    try { await api('/contacts', { body: { name: g('name'), email: g('email'), title: g('title'), company: g('company'), verification: g('verification'), notes: g('notes') } }); (e.target as HTMLFormElement).reset(); load(); }
    catch (x) { setErr(errText(x)); }
  }
  const run = (p: Promise<unknown>) => p.then(load).catch((x) => setErr(errText(x)));

  return (
    <>
      <div className="ph"><div><h1>HR contacts</h1><p>Every address is stored with how you know it. Unverified addresses need your confirmation before sending.</p></div>
        <div className="seg" role="tablist"><button role="tab" aria-selected={tab === 'contacts'} onClick={() => setTab('contacts')}>Contacts</button><button role="tab" aria-selected={tab === 'companies'} onClick={() => setTab('companies')}>Companies</button></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}
      {tab === 'contacts' ? (
        <div className="pg-two">
          <form className="card pg-form" onSubmit={add}>
            <div className="pg-h"><span className="ic" style={{ background: 'linear-gradient(135deg,#34D399,#059669)' }}>＋</span><h2>Add contact</h2></div>
            <div className="pg-2"><label className="az-f">Name<input name="name" required /></label>
            <label className="az-f">Company<input name="company" required /></label></div>
            <label className="az-f">Email<input name="email" type="email" placeholder="hr@company.com" /></label>
            <label className="az-f">Title<input name="title" placeholder="Talent Acquisition Lead" /></label>
            <label className="az-f">How do you know this address?
              <select name="verification" defaultValue="unverified"><option value="verified">I confirmed it works</option><option value="source_reported">It is in the job post / company site</option><option value="inferred">I guessed it from a pattern</option><option value="unverified">Not sure</option></select></label>
            <label className="az-f">Notes<input name="notes" /></label>
            <button className="btn primary">Save contact</button>
          </form>
          <section className="card scroll" style={{ minWidth: 0 }}>
            <div className="card-h"><h2>Contacts</h2><label style={{ position: 'relative' }}><span className="sr" style={{ position: 'absolute', left: -9999 }}>Search</span><input placeholder="Search name, email, company" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 230 }} /></label></div>
            {!list ? <div className="muted">Loading</div> : list.length === 0 ? <div className="pg-empty"><div className="big">👥</div><b>No contacts yet</b><span>Add an HR contact on the left.</span></div> : (
              <table><thead><tr><th>Person</th><th>Company</th><th>Address</th><th>Trust</th><th /></tr></thead><tbody>
                {list.map((c) => (
                  <tr key={c._id} style={c.suppressed ? { opacity: .55 } : undefined}>
                    <td><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><div className="pg-av">{String(c.name || '?')[0].toUpperCase()}</div><div><b>{c.name}</b><div className="faint">{c.title}</div></div></div></td><td>{c.company}</td><td>{c.email ?? <span className="faint">none</span>}</td>
                    <td title={V[c.verification].tip}><span className={`pill ${V[c.verification].tone}`}>{c.verification.replace('_', ' ')}</span><div className="bar" style={{ marginTop: 4, width: 70 }}><i style={{ width: `${c.confidence}%` }} /></div></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn sm" onClick={() => run(api(`/contacts/${c._id}/suppress`, { body: { suppressed: !c.suppressed } }))}>{c.suppressed ? 'Unblock' : 'Do not contact'}</button>{' '}
                      <button className="btn sm" aria-label={`Delete ${c.name}`} onClick={() => run(api(`/contacts/${c._id}`, { method: 'DELETE' }))}>✕</button>
                    </td>
                  </tr>))}
              </tbody></table>)}
          </section>
        </div>
      ) : (
        <section className="card scroll">
          <h2>Companies</h2><p className="faint">Built from your jobs, contacts and applications. Response share is counted only for applications you actually sent.</p>
          {!cos ? <div className="muted">Loading</div> : cos.length === 0 ? <div className="empty">Companies appear once you save jobs.</div> : (
            <table><thead><tr><th>Company</th><th>Jobs</th><th>Contacts</th><th>Applied</th><th>Replied</th><th>Last sent</th></tr></thead><tbody>
              {cos.map((c) => <tr key={c.company}><td><b>{c.company}</b></td><td>{c.jobs}</td><td>{c.contacts || <span className="faint">0</span>}</td><td>{c.applications}</td><td>{c.replied}{c.applications > 0 && <span className="faint"> / {c.applications}</span>}</td><td className="faint">{c.lastSentAt ? new Date(c.lastSentAt).toLocaleDateString() : '–'}</td></tr>)}
            </tbody></table>)}
        </section>
      )}
    </>
  );
}
