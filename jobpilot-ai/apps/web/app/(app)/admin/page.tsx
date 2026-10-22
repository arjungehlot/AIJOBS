'use client';
import { useEffect, useState } from 'react';
import { BarChart, Donut, Legend, PALETTE } from '@/components/charts';
import { Icon } from '@/components/ui';
import { api, errText } from '@/lib/api';

export default function AdminOverview() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { api('/admin/overview').then(setD).catch((e) => setErr(errText(e))); }, []);
  if (err) return <div className="msg err" role="alert">{err}</div>;
  if (!d) return <div className="card muted">Loading</div>;
  const k = d.kpis;
  const KPIS = [
    { l: 'Total users', v: k.users, ic: 'users', c: 'c-indigo', s: `${k.newUsers7d} new in 7 days` },
    { l: 'Active (7 days)', v: k.active7d, ic: 'trend', c: 'c-emerald', s: 'logged in' },
    { l: 'Applications sent', v: k.applicationsSent, ic: 'send', c: 'c-violet', s: 'all users' },
    { l: 'Replies imported', v: k.replies, ic: 'mail', c: 'c-indigo', s: `${k.gmailConnected} Gmail connected` },
    { l: 'Suspended', v: k.suspended, ic: 'lock', c: 'c-rose', s: 'accounts' },
    { l: 'Jobs saved', v: k.jobs, ic: 'briefcase', c: 'c-indigo', s: `${k.contacts} contacts · ${k.resumes} resumes` },
    { l: 'Events (24h)', v: k.events24h, ic: 'chart', c: 'c-emerald', s: 'audit log' },
    { l: 'Failures (24h)', v: k.failures24h, ic: 'shield', c: k.failures24h ? 'c-rose' : 'c-emerald', s: 'failed or blocked' },
  ];
  const parts = (o: Record<string, number>) => Object.entries(o).map(([label, value], i) => ({ label: label.replace('_', ' '), value, color: PALETTE[i % PALETTE.length] }));
  const plan = parts(d.byPlan), status = parts(d.byStatus);
  const labels = d.series.days.map((x: string) => x.slice(5));
  return (
    <>
      <div className="ph"><div><h1>Admin overview</h1><p>Platform-wide numbers read straight from the database. Only the super admin can see this.</p></div></div>
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {KPIS.map((x) => (
          <div key={x.l} className={`card kpi2 ${x.c.replace('c-', 'k-')}`}>
            <span className="chip"><Icon name={x.ic} size={16} /></span>
            <div className="t"><b>{x.v}</b><span>{x.l}</span><small>{x.s}</small></div>
          </div>))}
      </div>
      <div className="grid">
        <section className="card s8">
          <div className="card-h"><h2>Last 14 days</h2><Legend items={[{ label: 'Sign-ups', color: PALETTE[0] }, { label: 'Applications sent', color: PALETTE[2] }]} /></div>
          <BarChart labels={labels} series={[{ name: 'Sign-ups', color: PALETTE[0], values: d.series.signups }, { name: 'Sent', color: PALETTE[2], values: d.series.sent }]} />
        </section>
        <section className="card s4">
          <h2>Plans</h2>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}><Donut parts={plan} center={String(k.users)} sub="users" /></div>
          <Legend items={plan.map((p) => ({ label: p.label, color: p.color, value: p.value }))} />
        </section>
        <section className="card s6">
          <h2>Applications by status</h2>
          {status.length === 0 ? <div className="empty">No applications yet.</div> : <div className="row" style={{ alignItems: 'center', gap: 18 }}><Donut parts={status} center={String(status.reduce((a, b) => a + b.value, 0))} sub="total" /><Legend items={status.map((p) => ({ label: p.label, color: p.color, value: p.value }))} /></div>}
        </section>
        <section className="card s6">
          <h2>Roles</h2>
          {Object.entries(d.byRole).map(([r, n]: any) => <div key={r} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line)' }}><span style={{ textTransform: 'capitalize' }}>{r.replace('_', ' ')}</span><b>{n}</b></div>)}
        </section>
      </div>
    </>
  );
}
