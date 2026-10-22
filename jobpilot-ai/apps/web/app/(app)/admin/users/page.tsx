'use client';
import { useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

const PLANS = ['free', 'pro', 'premium_agent', 'teams']; const ROLES = ['user', 'admin', 'super_admin'];

export default function AdminUsers() {
  const [data, setData] = useState<any>(null); const [q, setQ] = useState(''); const [page, setPage] = useState(1); const [err, setErr] = useState(''); const [me, setMe] = useState('');
  const load = () => api(`/admin/users?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`).then(setData).catch((e) => setErr(errText(e)));
  useEffect(() => { api('/auth/me').then((m) => setMe(m.id)).catch(() => undefined); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, page]);

  async function patch(id: string, body: Record<string, string>) {
    setErr('');
    try { await api(`/admin/users/${id}`, { method: 'PATCH', body }); await load(); } catch (e) { setErr(errText(e)); }
  }
  return (
    <>
      <div className="ph"><div><h1>Users</h1><p>Change plans, roles and access. Every change is written to the audit log. You cannot change your own role or suspend yourself.</p></div>
        <input placeholder="Search name or email" aria-label="Search users" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ width: 260 }} /></div>
      {err && <div className="msg err" role="alert">{err}</div>}
      <section className="card scroll">
        {!data ? <div className="muted">Loading</div> : data.items.length === 0 ? <div className="empty">No users found.</div> : (
          <table>
            <thead><tr><th>User</th><th>Plan</th><th>Role</th><th>Usage</th><th>Last login</th><th>Status</th></tr></thead>
            <tbody>
              {data.items.map((u: any) => {
                const self = u._id === me;
                return (
                  <tr key={u._id} style={u.status === 'suspended' ? { opacity: .6 } : undefined}>
                    <td><b>{u.name}</b>{self && <span className="pill" style={{ marginLeft: 6 }}>you</span>}<div className="faint">{u.email}</div></td>
                    <td><select aria-label={`Plan for ${u.email}`} value={u.plan} onChange={(e) => patch(u._id, { plan: e.target.value })} style={{ height: 34, width: 140 }}>{PLANS.map((p) => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}</select></td>
                    <td><select aria-label={`Role for ${u.email}`} disabled={self} value={u.role} onChange={(e) => patch(u._id, { role: e.target.value })} style={{ height: 34, width: 130 }}>{ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}</select></td>
                    <td className="faint">{u.applications} apps · {u.sent} sent{u.gmailConnected && <> · <span className="pill ok">Gmail</span></>}</td>
                    <td className="faint">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'never'}</td>
                    <td>{self ? <span className="pill ok">active</span> : (
                      <button className={`btn sm ${u.status === 'active' ? '' : 'primary'}`} onClick={() => patch(u._id, { status: u.status === 'active' ? 'suspended' : 'active' })} style={u.status === 'active' ? { color: 'var(--bad)' } : undefined}>
                        {u.status === 'active' ? 'Suspend' : 'Reactivate'}</button>)}</td>
                  </tr>);
              })}
            </tbody>
          </table>)}
      </section>
      {data && data.total > data.limit && (
        <div className="row" style={{ justifyContent: 'center', alignItems: 'center', gap: 10 }}>
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="faint">Page {page} of {Math.ceil(data.total / data.limit)} · {data.total} users</span>
          <button className="btn sm" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Next</button>
        </div>)}
    </>
  );
}
