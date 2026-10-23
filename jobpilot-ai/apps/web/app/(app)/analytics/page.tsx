'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui';
import { api, errText } from '@/lib/api';

function Rates({ title, sub, rows }: { title: string; sub: string; rows: { key: string; rate: any }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.rate.pct ?? 0));
  return (
    <section className="card an-card">
      <div className="an-h"><h2>{title}</h2><small>{sub}</small></div>
      {rows.length === 0 ? <div className="faint">No data yet.</div> : (
        <div className="an-rows">
          {rows.map((r) => (
            <div key={r.key} className="an-row">
              <span className="k" title={r.key}>{r.key}</span>
              <div className="an-bar"><i className={r.rate.lowSample ? 'low' : ''} style={{ width: `${Math.max(2, ((r.rate.pct ?? 0) / max) * 100)}%` }} /></div>
              <span className="v"><b>{r.rate.pct ?? 0}%</b><em>{r.rate.n}/{r.rate.d}</em></span>
              {r.rate.lowSample && <span className="lo" title="Fewer than 20 applications: treat as anecdote">low n</span>}
            </div>))}
        </div>)}
    </section>
  );
}

export default function Analytics() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { api('/analytics').then(setD).catch((e) => setErr(errText(e))); }, []);
  if (err) return <div className="msg err">{err}</div>;
  if (!d) return <div className="card muted">Loading</div>;
  const t = d.totals;
  const K = (cls: string, ic: string, l: string, v: string, s?: string) => (
    <div className={`card kpi2 ${cls}`}><span className="chip"><Icon name={ic} size={16} /></span><span className="t"><b>{v}</b><span>{l}</span>{s && <small>{s}</small>}</span></div>);
  const pct = (r: any) => (r.pct === null || r.pct === undefined ? '–' : `${r.pct}%`);
  const stages = [
    { l: 'Sent', n: t.sent, c: '#4F46E5' },
    { l: 'Replied', n: t.overall?.n ?? 0, c: '#0284C7' },
    { l: 'Interview', n: t.interview?.n ?? 0, c: '#059669' },
  ];
  const top = Math.max(1, t.sent);
  return (
    <>
      <div className="ph"><div><h1>Analytics</h1><p>What your own history says. Groups with fewer than 20 applications are tagged “low n” because small numbers mislead.</p></div></div>
      <div className="an-kpis">
        {K('k-indigo', 'send', 'Applications sent', String(t.sent))}
        {K('k-sky', 'mail', 'Response rate', pct(t.overall), t.overall?.d ? `${t.overall.n} of ${t.overall.d}` : 'Nothing sent yet')}
        {K('k-emerald', 'award', 'Interview rate', pct(t.interview), t.interview?.d ? `${t.interview.n} of ${t.interview.d}` : undefined)}
        {K('k-amber', 'clock', 'Avg days to reply', t.avgDaysToReply === null ? '–' : String(t.avgDaysToReply), 'send to first status change')}
      </div>
      {d.notes.length > 0 && <div className="an-note">{d.notes.map((n: string) => <span key={n}>ⓘ {n}</span>)}</div>}
      {t.sent === 0 ? <div className="card empty">Send your first application to unlock insights.</div> : (
        <div className="an-grid">
          <section className="card an-card an-funnel">
            <div className="an-h"><h2>Funnel</h2><small>From sent to interview</small></div>
            {stages.map((s, i) => (
              <div key={s.l} className="fn">
                <span className="k">{s.l}</span>
                <div className="an-bar big"><i style={{ width: `${Math.max(2, (s.n / top) * 100)}%`, background: s.c }} /></div>
                <span className="v"><b>{s.n}</b>{i > 0 && stages[i - 1].n > 0 && <em>{Math.round((s.n / stages[i - 1].n) * 100)}%</em>}</span>
              </div>))}
          </section>
          <Rates title="By match score" sub="Response rate" rows={d.byScore} />
          <Rates title="By work mode" sub="Response rate" rows={d.byMode} />
          <Rates title="By day sent" sub="Response rate" rows={d.byDow} />
          <Rates title="By company" sub="Response rate" rows={d.byCompany} />
        </div>)}
      <p className="faint" style={{ marginTop: 10 }}>{d.disclaimer}</p>
    </>
  );
}
