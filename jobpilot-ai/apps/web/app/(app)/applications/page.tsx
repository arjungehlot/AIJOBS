'use client';
import { useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

const TONE: Record<string, string> = { applied: 'ok', approved: 'ok', send_failed: 'bad', bounced: 'bad', send_unknown: 'warn', awaiting_approval: 'warn' };

export default function Applications() {
  const [data, setData] = useState<{ items: any[]; total: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [confirm, setConfirm] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

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
  async function showTimeline(id: string) {
    setOpen(id);
    setTimeline(await api<any[]>(`/applications/${id}/activity`).catch(() => []));
  }

  return (
    <>
      <h1>Application tracker</h1>
      {err && <div className="msg err" role="alert">{err}</div>}
      {note && <div className="msg warn">{note}</div>}
      <section className="card scroll">
        {!data ? <div className="muted">Loading</div> : data.items.length === 0 ? (
          <div className="empty">No applications yet. Analyze a job and save a draft to start.</div>
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
