'use client';
import { useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

// Mirrors the server state machine, minus statuses only the send pipeline may set. The server still enforces every rule.
const MOVES: Record<string, string[]> = {
  draft: ['closed'], awaiting_approval: ['closed'], approved: ['closed'], send_failed: ['closed'],
  applied: ['hr_replied', 'withdrawn', 'closed'], hr_replied: ['interview', 'assessment', 'rejected', 'offer', 'closed'],
  assessment: ['interview', 'rejected', 'closed'], interview: ['assessment', 'offer', 'rejected', 'closed'],
  offer: ['accepted', 'rejected', 'withdrawn', 'closed'], rejected: ['closed'], accepted: ['closed'], withdrawn: ['closed'],
};
const COLS = [
  { id: 'prep', t: 'To send', st: ['draft', 'awaiting_approval', 'approved', 'sending', 'send_failed', 'send_unknown'] },
  { id: 'applied', t: 'Applied', st: ['applied'] }, { id: 'hr_replied', t: 'Replied', st: ['hr_replied'] },
  { id: 'assessment', t: 'Assessment', st: ['assessment'] }, { id: 'interview', t: 'Interview', st: ['interview'] },
  { id: 'offer', t: 'Offer', st: ['offer', 'accepted'] }, { id: 'done', t: 'Closed', st: ['rejected', 'withdrawn', 'closed', 'bounced'] },
];
const COLX: Record<string, { c: string; ic: string }> = {
  prep: { c: '#6366F1', ic: '✉' }, applied: { c: '#0EA5E9', ic: '🚀' }, hr_replied: { c: '#8B5CF6', ic: '💬' }, assessment: { c: '#F59E0B', ic: '📝' },
  interview: { c: '#EC4899', ic: '🎤' }, offer: { c: '#10B981', ic: '🏆' }, done: { c: '#94A3B8', ic: '📁' },
};
const TONE: Record<string, string> = { applied: 'ok', approved: 'ok', send_failed: 'bad', bounced: 'bad', send_unknown: 'warn', awaiting_approval: 'warn' };

export default function Applications() {
  const [data, setData] = useState<{ items: any[]; total: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [confirm, setConfirm] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [view, setView] = useState<'board' | 'table'>('board');

  const load = () => api('/applications').then(setData).catch((e) => setErr(errText(e)));
  useEffect(() => { load(); }, []);

  async function act(id: string, what: 'approve' | 'send' | 'reconcile') {
    setErr(''); setNote('');
    try {
      const r = await api(`/applications/${id}/${what}`, { body: what === 'approve' ? { confirmRecipient: !!confirm[id] } : {}, method: 'POST' });
      if (r?.message) setNote(r.message);
      await load(); if (open === id) showTimeline(id);
    } catch (e) { setErr(errText(e)); }
  }
  async function move(id: string, status: string) {
    setErr(''); setNote('');
    try { await api(`/applications/${id}/status`, { method: 'PATCH', body: { status } }); await load(); } catch (e) { setErr(errText(e)); }
  }
  async function showTimeline(id: string) {
    setOpen(id);
    setTimeline(await api<any[]>(`/applications/${id}/activity`).catch(() => []));
  }

  return (
    <>
      <div className="ph"><div><h1>Applications</h1><p>Your pipeline from draft to offer. Approve, send and review every application.</p></div>
        <div className="seg" role="tablist"><button role="tab" aria-selected={view === 'board'} onClick={() => setView('board')}>Board</button><button role="tab" aria-selected={view === 'table'} onClick={() => setView('table')}>Table</button></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}
      {note && <div className="msg warn">{note}</div>}
      {data && data.items.length > 0 && (
        <div className="pg-stats">
          {COLS.slice(0, 6).map((col) => <div key={col.id} className="pg-stat" style={{ ['--c' as any]: COLX[col.id].c }}><span className="ic">{COLX[col.id].ic}</span><div><b>{data.items.filter((a) => col.st.includes(a.status)).length}</b><small>{col.t}</small></div></div>)}
        </div>
      )}
      {view === 'board' && data && data.items.length > 0 && (
        <div className="pg-board">
          {COLS.map((col) => {
            const cards = data.items.filter((a) => col.st.includes(a.status)); const x = COLX[col.id];
            return (
              <section key={col.id} aria-label={col.t} className="pg-col" style={{ ['--c' as any]: x.c }}>
                <div className="pg-col-h"><span>{x.ic} {col.t}</span><em>{cards.length}</em></div>
                {cards.length === 0 && <div className="pg-col-empty">Nothing here yet</div>}
                {cards.map((a) => (
                  <article key={a._id} className="pg-app">
                    <div className="top"><div className="pg-av" style={{ background: x.c }}>{String(a.jobId?.company || '?')[0].toUpperCase()}</div>
                      <div style={{ minWidth: 0 }}><b>{a.jobId?.title}</b><div className="faint">{a.jobId?.company}</div></div></div>
                    <div className="mid"><span className={`pill ${TONE[a.status] ?? ''}`}>{a.status.replace('_', ' ')}</span>
                      {a.matchScore != null && <div className="sc" title={`Match score ${a.matchScore}`}><div className="bar"><i style={{ width: `${a.matchScore}%` }} /></div><span>{a.matchScore}</span></div>}</div>
                    {MOVES[a.status] ? (
                      <select aria-label={`Move ${a.jobId?.title}`} value="" onChange={(e) => e.target.value && move(a._id, e.target.value)} style={{ height: 28, fontSize: 12 }}>
                        <option value="">Move to…</option>{MOVES[a.status].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                      </select>
                    ) : null}
                    {['draft', 'awaiting_approval', 'approved', 'send_unknown'].includes(a.status) && <button className="btn sm primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} onClick={() => setView('table')}>Review &amp; send →</button>}
                  </article>))}
              </section>);
          })}
        </div>
      )}
      <section className="card scroll" hidden={view === 'board' && !!data?.items.length}>
        {!data ? <div className="muted">Loading</div> : data.items.length === 0 ? (
          <div className="pg-empty"><div className="big">📭</div><b>No applications yet</b><span>Analyze a job and save a draft to start your pipeline.</span></div>
        ) : (
          <table>
            <thead><tr><th>Job</th><th>Recipient</th><th>Status</th><th>Score</th><th>Actions</th></tr></thead>
            <tbody>
              {data.items.map((a) => {
                const untrusted = !['verified', 'source_reported'].includes(a.recipient.confidence);
                return (
                  <tr key={a._id}>
                    <td><b>{a.jobId?.title}</b><div className="faint">{a.jobId?.company}</div></td>
                    <td>{a.recipient.email}<div className="faint">{a.recipient.confidence.replace('_', ' ')}</div></td>
                    <td><span className={`pill ${TONE[a.status] ?? ''}`}>{a.status.replace('_', ' ')}</span>{a.lastError && <div className="faint">{a.lastError}</div>}</td>
                    <td>{a.matchScore ?? '–'}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {['draft', 'awaiting_approval'].includes(a.status) && (<>
                          {untrusted && <label className="faint" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input type="checkbox" style={{ width: 'auto' }} checked={!!confirm[a._id]} onChange={(e) => setConfirm({ ...confirm, [a._id]: e.target.checked })} />I confirm this address</label>}
                          <button className="btn" disabled={untrusted && !confirm[a._id]} onClick={() => act(a._id, 'approve')}>Approve</button>
                        </>)}
                        {a.status === 'approved' && <button className="btn primary" onClick={() => act(a._id, 'send')}>Send</button>}
                        {a.status === 'send_unknown' && <button className="btn" onClick={() => act(a._id, 'reconcile')}>Check with provider</button>}
                        <button className="btn" onClick={() => showTimeline(a._id)}>History</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      {open && (
        <section className="card">
          <h2>Activity</h2>
          {timeline.length === 0 ? <div className="muted">No events.</div> : timeline.map((e) => (
            <div key={e._id} style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
              <b>{e.action}</b> <span className={`pill ${e.result === 'success' ? 'ok' : e.result === 'blocked' ? 'warn' : 'bad'}`}>{e.result}</span>{' '}
              <span className="faint">{e.actor} · {new Date(e.createdAt).toLocaleString()}</span>
              {e.detail && <div className="faint">{e.detail}</div>}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
