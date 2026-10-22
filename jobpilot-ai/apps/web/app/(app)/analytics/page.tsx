'use client';
import { useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

function Rates({ title, rows, note }: { title: string; rows: { key: string; rate: any }[]; note?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.rate.pct ?? 0));
  return (
    <section className="card">
      <h2>{title}</h2>{note && <p className="faint" style={{ margin: '0 0 6px' }}>{note}</p>}
      {rows.length === 0 ? <div className="empty">No data yet.</div> : rows.map((r) => (
        <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 92px', gap: 8, alignItems: 'center', padding: '4px 0' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.key}>{r.key}</span>
          <div className="bar"><i style={{ width: `${((r.rate.pct ?? 0) / max) * 100}%`, opacity: r.rate.lowSample ? .35 : 1 }} /></div>
          <span className="faint" style={{ textAlign: 'right' }}>{r.rate.pct}% <span title={r.rate.lowSample ? 'Fewer than 20 applications: treat as anecdote' : ''}>({r.rate.n}/{r.rate.d}){r.rate.lowSample && ' ⚠'}</span></span>
        </div>))}
    </section>
  );
}

export default function Analytics() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { api('/analytics').then(setD).catch((e) => setErr(errText(e))); }, []);
  if (err) return <div className="msg err">{err}</div>;
  if (!d) return <div className="card muted">Loading</div>;
  const t = d.totals;
  const K = (l: string, v: string, s?: string) => <div className="card kpi s3"><span className="faint">{l}</span><b style={{ fontSize: 24 }}>{v}</b>{s && <span className="faint">{s}</span>}</div>;
  return (
    <>
      <div className="ph"><div><h1>Analytics</h1><p>What your own history says. Bars are faded and marked ⚠ when a group has fewer than 20 applications, because small numbers mislead.</p></div></div>
      <div className="grid">
        {K('Applications sent', String(t.sent))}
        {K('Response rate', t.overall.pct === null ? '–' : `${t.overall.pct}%`, t.overall.d ? `${t.overall.n} of ${t.overall.d}` : 'Nothing sent yet')}
        {K('Interview rate', t.interview.pct === null ? '–' : `${t.interview.pct}%`, t.interview.d ? `${t.interview.n} of ${t.interview.d}` : undefined)}
        {K('Avg days to reply', t.avgDaysToReply === null ? '–' : String(t.avgDaysToReply), 'from send to first status change')}
      </div>
      {d.notes.map((n: string) => <div className="msg warn" key={n}>{n}</div>)}
      {t.sent === 0 ? <div className="card empty">Send your first application to unlock insights.</div> : (
        <div className="grid">
          <div className="s6"><Rates title="Response by match score" rows={d.byScore} /></div>
          <div className="s6"><Rates title="Response by work mode" rows={d.byMode} /></div>
          <div className="s6"><Rates title="Response by day sent" rows={d.byDow} /></div>
          <div className="s6"><Rates title="Response by company" rows={d.byCompany} /></div>
        </div>)}
      <p className="faint">{d.disclaimer}</p>
    </>
  );
}
