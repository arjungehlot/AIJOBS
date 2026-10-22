'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

type Overview = { kpis: Record<string, number | null>; funnel: { stage: string; count: number }[] };
const LABELS: [string, string][] = [
  ['jobsDiscovered', 'Jobs discovered'], ['jobsAnalyzed', 'Jobs analyzed'], ['suitableJobs', 'Suitable jobs'], ['shortlisted', 'Shortlisted'],
  ['applicationsSent', 'Applications sent'], ['awaitingResponse', 'Awaiting response'], ['hrReplies', 'HR replies'],
  ['interviews', 'Interviews'], ['offers', 'Offers'], ['responseRate', 'Response rate'],
];

export default function Dashboard() {
  const [d, setD] = useState<Overview | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api<Overview>('/overview').then(setD).catch((e) => setErr(errText(e))); }, []);
  if (err) return <div className="msg err" role="alert">{err}</div>;
  if (!d) return <div className="muted">Loading</div>;
  const empty = d.kpis.jobsDiscovered === 0;
  const max = Math.max(1, ...d.funnel.map((f) => f.count));
  return (
    <>
      <h1>Overview</h1>
      {empty && (
        <div className="card empty">
          <b>No jobs yet.</b>
          <p>Create a career profile, then analyze your first job from a screenshot or pasted text.</p>
          <Link className="btn primary" href="/profiles" style={{ display: 'inline-flex', alignItems: 'center' }}>Set up a career profile</Link>
        </div>
      )}
      <section className="row">
        {LABELS.map(([k, label]) => (
          <div className="card kpi" key={k}>
            <span>{label}</span>
            <b>{d.kpis[k] === null ? '–' : k === 'responseRate' ? `${d.kpis[k]}%` : d.kpis[k]}</b>
            {k === 'responseRate' && <span className="faint">{d.kpis[k] === null ? 'No applications sent yet' : 'replies ÷ sent'}</span>}
          </div>
        ))}
      </section>
      <section className="card">
        <h2>Application funnel</h2>
        {d.funnel.map((f) => (
          <div key={f.stage} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
            <span style={{ flex: '0 0 110px' }} className="muted">{f.stage}</span>
            <div className="bar" style={{ flex: 1 }}><i style={{ width: `${(f.count / max) * 100}%` }} /></div>
            <b style={{ flex: '0 0 40px', textAlign: 'right' }}>{f.count}</b>
          </div>
        ))}
      </section>
    </>
  );
}
