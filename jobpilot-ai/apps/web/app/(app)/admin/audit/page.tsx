'use client';
import { useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

export default function AdminAudit() {
  const [data, setData] = useState<any>(null); const [err, setErr] = useState('');
  const [f, setF] = useState({ action: '', result: '', actor: '' }); const [page, setPage] = useState(1);
  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page), ...(f.action && { action: f.action }), ...(f.result && { result: f.result }), ...(f.actor && { actor: f.actor }) });
    const t = setTimeout(() => api(`/admin/audit?${qs}`).then(setData).catch((e) => setErr(errText(e))), 250);
    return () => clearTimeout(t);
  }, [f, page]);
  const set = (k: string, v: string) => { setF({ ...f, [k]: v }); setPage(1); };
  return (
    <>
      <div className="ph"><div><h1>Audit log</h1><p>Append-only record of sends, approvals, agent actions and admin changes across all users.</p></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}
      <section className="card row" style={{ alignItems: 'end' }}>
        <label className="f col">Action contains<input value={f.action} onChange={(e) => set('action', e.target.value)} placeholder="application.send" /></label>
        <label className="f col">Result<select value={f.result} onChange={(e) => set('result', e.target.value)}><option value="">Any</option><option value="success">Success</option><option value="failure">Failure</option><option value="blocked">Blocked</option></select></label>
        <label className="f col">Actor<select value={f.actor} onChange={(e) => set('actor', e.target.value)}><option value="">Any</option>{['user', 'agent', 'workflow', 'integration', 'system', 'admin'].map((a) => <option key={a}>{a}</option>)}</select></label>
      </section>
      <section className="card scroll">
        {!data ? <div className="muted">Loading</div> : data.items.length === 0 ? <div className="empty">No matching events.</div> : (
          <table><thead><tr><th>When</th><th>User</th><th>Action</th><th>Actor</th><th>Result</th><th>Detail</th></tr></thead><tbody>
            {data.items.map((e: any) => (
              <tr key={e._id}><td className="faint" style={{ whiteSpace: 'nowrap' }}>{new Date(e.createdAt).toLocaleString()}</td><td>{e.userEmail ?? <span className="faint">unknown</span>}</td><td><b>{e.action}</b></td><td>{e.actor}</td>
                <td><span className={`pill ${e.result === 'success' ? 'ok' : e.result === 'blocked' ? 'warn' : 'bad'}`}>{e.result}</span></td><td className="faint">{e.detail ?? ''}</td></tr>))}
          </tbody></table>)}
      </section>
      {data && data.total > data.limit && (
        <div className="row" style={{ justifyContent: 'center', alignItems: 'center', gap: 10 }}>
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="faint">Page {page} of {Math.ceil(data.total / data.limit)} · {data.total} events</span>
          <button className="btn sm" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Next</button>
        </div>)}
    </>
  );
}
