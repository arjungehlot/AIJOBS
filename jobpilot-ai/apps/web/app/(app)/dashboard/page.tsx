'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BarChart, Donut, Funnel, Legend, PALETTE, Sparkline } from '@/components/charts';
import { Icon, Pill } from '@/components/ui';
import { api, errText } from '@/lib/api';
import { sampleOverview, sampleTrends } from '@/lib/sample';

type Overview = ReturnType<typeof sampleOverview>;
type Trends = ReturnType<typeof sampleTrends>;

const STATUS_COLORS: Record<string, [string, string]> = {
  applied: ['Awaiting reply', PALETTE[1]], hr_replied: ['Replied', PALETTE[2]], interview: ['Interview', PALETTE[0]], assessment: ['Assessment', PALETTE[4]],
  offer: ['Offer', PALETTE[3]], accepted: ['Accepted', PALETTE[2]], rejected: ['Rejected', PALETTE[5]], draft: ['Draft', PALETTE[6]],
  awaiting_approval: ['Awaiting approval', PALETTE[3]], approved: ['Approved', PALETTE[0]], send_failed: ['Send failed', PALETTE[5]], closed: ['Closed', PALETTE[6]],
};
const short = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function Dashboard() {
  const [real, setReal] = useState<{ o: Overview; t: Trends } | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [sample, setSample] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([api<Overview>('/overview'), api<Trends>('/overview/trends'), api('/applications?limit=5')])
      .then(([o, t, a]) => { setReal({ o, t }); setRecent(a.items); })
      .catch((e) => setErr(errText(e)));
  }, []);

  if (err) return <div className="msg err" role="alert">{err}</div>;
  if (!real) return <div className="muted">Loading</div>;

  const o = sample ? sampleOverview() : real.o;
  const t = sample ? sampleTrends() : real.t;
  const k = o.kpis;
  const empty = !sample && k.jobsDiscovered === 0;
  const labels = t.days.map(short);
  const statusParts = Object.entries(o.byStatus).map(([s, v]) => ({ label: (STATUS_COLORS[s] ?? [s, PALETTE[6]])[0], value: v as number, color: (STATUS_COLORS[s] ?? [s, PALETTE[6]])[1] }));
  const totalApps = statusParts.reduce((a, p) => a + p.value, 0);
  const KPIS = [
    { l: 'Jobs discovered', v: k.jobsDiscovered, icon: 'briefcase', c: 'c-indigo', color: PALETTE[0], trend: t.discovered },
    { l: 'Suitable jobs', v: k.suitableJobs, icon: 'target', c: 'c-sky', sub: `${k.jobsAnalyzed} analyzed` },
    { l: 'Applications sent', v: k.applicationsSent, icon: 'send', c: 'c-violet', color: PALETTE[4], trend: t.sent },
    { l: 'HR replies', v: k.hrReplies, icon: 'mail', c: 'c-emerald', sub: `${k.awaitingResponse} awaiting` },
    { l: 'Interviews', v: k.interviews, icon: 'users', c: 'c-amber', sub: `${k.offers} offer${k.offers === 1 ? '' : 's'}` },
    { l: 'Response rate', v: k.responseRate === null ? '–' : `${k.responseRate}%`, icon: 'trend', c: 'c-rose', sub: k.responseRate === null ? 'No sends yet' : 'replies ÷ sent' },
  ];
  const steps = [
    ['Create a career profile', k.jobsDiscovered > 0 || sample, '/profiles'],
    ['Analyze your first job', k.jobsDiscovered > 0, '/analyzer'],
    ['Score a job against a profile', k.jobsAnalyzed > 0, '/analyzer'],
    ['Save an application draft', totalApps > 0, '/analyzer'],
    ['Approve and send it', k.applicationsSent > 0, '/applications'],
  ] as const;

  return (
    <>
      <div className="ph">
        <div><h1>Overview</h1><p>Everything below is computed from your stored records.</p></div>
        <div className="row">
          <button className="btn sm" onClick={() => setSample(!sample)} aria-pressed={sample}><Icon name="spark" size={13} />{sample ? 'Show my data' : 'Preview with sample data'}</button>
        </div>
      </div>
      {sample && <div className="sample" role="status"><Icon name="spark" size={14} />Sample data for preview only. None of these numbers are yours.</div>}
      {empty && (
        <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', background: 'linear-gradient(90deg,#EEF2FF,#F0F9FF)' }}>
          <div style={{ flex: '1 1 300px' }}><h2 style={{ fontSize: 15 }}>Welcome. Let’s find your first match.</h2><p className="muted">Create a profile, then analyze a job from a screenshot or pasted text. Charts fill in as you go.</p></div>
          <Link href="/profiles" className="btn primary">Set up a profile<Icon name="arrow" size={14} /></Link>
        </div>
      )}

      <section className="grid">
        {KPIS.map((x) => (
          <div key={x.l} className="card kpi s2">
            {x.trend && <Sparkline data={x.trend} color={x.color} />}
            <span className={`chip ${x.c}`}><Icon name={x.icon} size={15} /></span>
            <span className="v">{x.v}</span><span className="l">{x.l}</span><span className="sub">{x.sub ?? '14-day trend'}</span>
          </div>
        ))}
      </section>

      <section className="grid">
        <div className="card s8">
          <div className="card-h"><h2>Activity, last 14 days</h2><Legend items={[{ label: 'Jobs found', color: PALETTE[1] }, { label: 'Applications sent', color: PALETTE[0] }]} /></div>
          <BarChart labels={labels} series={[{ name: 'Jobs found', color: PALETTE[1], values: t.discovered }, { name: 'Applications sent', color: PALETTE[0], values: t.sent }]} />
        </div>
        <div className="card s4">
          <div className="card-h"><h2>Applications by status</h2></div>
          {totalApps === 0 ? <div className="empty">No applications yet.</div> : (
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <Donut parts={statusParts} center={String(totalApps)} sub="applications" />
              <div style={{ flex: 1, minWidth: 120 }}><Legend items={statusParts.map((p) => ({ label: p.label, color: p.color, value: p.value }))} /></div>
            </div>
          )}
        </div>
      </section>

      <section className="grid">
        <div className="card s5">
          <div className="card-h"><h2>Pipeline funnel</h2><small>% = step conversion</small></div>
          <Funnel stages={o.funnel} />
        </div>
        <div className="card s4">
          <div className="card-h"><h2>Match score distribution</h2><small>latest score per job</small></div>
          {t.scoreBuckets.every((b) => b.count === 0) ? <div className="empty">Score a job to see the spread.</div> :
            <BarChart height={170} width={360} labels={t.scoreBuckets.map((b) => b.label)} series={[{ name: 'Jobs', color: PALETTE[4], values: t.scoreBuckets.map((b) => b.count) }]} />}
        </div>
        <div className="card s3">
          <div className="card-h"><h2>Getting started</h2><small>{steps.filter((s) => s[1]).length}/{steps.length}</small></div>
          <ul className="steps">
            {steps.map(([label, done, href]) => (
              <li key={label}><span className={`dot ${done ? 'done' : ''}`}>{done && <Icon name="check" size={10} />}</span>
                <Link href={href} style={{ color: done ? 'var(--faint)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none' }}>{label}</Link></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h2>Recent applications</h2><Link href="/applications" className="btn sm">View all</Link></div>
        {sample ? <div className="empty">Sample mode hides your real records.</div> : recent.length === 0 ? <div className="empty">Nothing here yet.</div> : (
          <div className="scroll"><table>
            <thead><tr><th>Job</th><th>Recipient</th><th>Status</th><th>Score</th></tr></thead>
            <tbody>{recent.map((a) => (
              <tr key={a._id}><td><b>{a.jobId?.title}</b> <span className="faint">· {a.jobId?.company}</span></td><td>{a.recipient.email}</td>
                <td><Pill tone={a.status === 'applied' ? 'ok' : a.status.includes('fail') ? 'bad' : 'gray'}>{a.status.replace('_', ' ')}</Pill></td><td>{a.matchScore ?? '–'}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
