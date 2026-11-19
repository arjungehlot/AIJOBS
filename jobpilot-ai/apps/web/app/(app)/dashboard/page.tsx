'use client';
import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';
import { BarChart, Donut, Funnel, Legend, PALETTE, Sparkline } from '@/components/charts';
import { Icon } from '@/components/ui';
import { api, errText } from '@/lib/api';

type Row = { label: string; value: number };
type Day = { day: string; value: number };
interface Dash {
  generatedAt: string;
  jobs: { total: number; today: number; last7: number; active: number; shortlisted: number; analyzed: number; suitable: number; avgScore: number | null; bestScore: number | null; bySource: Row[]; byWorkMode: Row[]; topLocations: Row[]; topCompanies: Row[]; topSkills: Row[]; scoreBuckets: Row[]; perDay: Day[] };
  applications: { sent: number; today: number; last7: number; last30: number; awaiting: number; replied: number; interviews: number; assessments: number; offers: number; rejected: number; drafts: number; failed: number; responseRate: number | null; avgDaysToReply: number | null; byStatus: Record<string, number>; perDay: Day[]; recent: { id: string; title: string; company: string; status: string; score: number | null; at: string }[] };
  outreach: { campaigns: Record<string, number>; campaignsTotal: number; emailsSent: number; emailsFailed: number; queued: number; sentToday: number; dailyLimit: number; waSent: number; waFailed: number; perDay: Day[]; last: { name: string; status: string; at: string } | null };
  inbox: { total: number; unhandled: number; byCategory: Row[]; recent: { id: string; from: string; subject: string; at: string; state: string; category: string | null }[] };
  followups: { pending: number; overdue: number; byKind: Row[]; next: { id: string; title: string; kind: string; dueAt: string }[] };
  contacts: { total: number; verified: number; suppressed: number };
  library: { resumes: number; resumeFiles: number; profiles: { id: string; name: string; titles: string[]; skills: number; minScore: number; maxDaily: number }[] };
  system: { ai: { provider: string; model: string; keys: { label: string; tail: string; state: 'ready' | 'cooling' | 'invalid'; retryInSec: number | null }[] }; gmail: { email: string; status: string; lastSyncAt: string | null; error: string | null } | null; whatsapp: { configured: boolean; mode: string; channel: string | null }; mailMode: string };
  funnel: { stage: string; count: number }[];
}

const STATUS: Record<string, [string, string]> = {
  applied: ['Awaiting reply', PALETTE[1]], hr_replied: ['Replied', PALETTE[2]], interview: ['Interview', PALETTE[0]], assessment: ['Assessment', PALETTE[4]],
  offer: ['Offer', PALETTE[3]], accepted: ['Accepted', PALETTE[2]], rejected: ['Rejected', PALETTE[5]], draft: ['Draft', PALETTE[6]],
  awaiting_approval: ['Awaiting approval', PALETTE[3]], approved: ['Approved', PALETTE[0]], send_failed: ['Send failed', PALETTE[5]], closed: ['Closed', PALETTE[6]],
  sending: ['Sending', PALETTE[1]], send_unknown: ['Needs check', PALETTE[5]],
};
const CAT: Record<string, string> = { interview_invitation: 'Interview invite', info_request: 'Info request', assessment: 'Assessment', rejection: 'Rejection', offer: 'Offer', acknowledgement: 'Acknowledged', unrelated: 'Unrelated', uncertain: 'Unclear', out_of_office: 'Auto-reply' };
const nice = (s: string) => CAT[s] ?? s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const short = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 60 ? `${m || 1}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
const due = (iso: string) => { const d = Math.round((new Date(iso).getTime() - Date.now()) / 86400000); return d < 0 ? `${-d}d overdue` : d === 0 ? 'today' : `in ${d}d`; };

function Card({ title, hint, action, className = '', children }: { title: string; hint?: ReactNode; action?: ReactNode; className?: string; children: ReactNode }) {
  return <section className={`card dx-card ${className}`}><div className="card-h"><h2>{title}</h2>{hint && <small>{hint}</small>}{action}</div>{children}</section>;
}
function Bars({ rows, color = PALETTE[0], empty = 'No data yet' }: { rows: Row[]; color?: string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <div className="dx-empty">{empty}</div>;
  return <ul className="dx-bars">{rows.map((r) => <li key={r.label}><span title={r.label}>{r.label}</span><i><b style={{ width: `${Math.max(4, (r.value / max) * 100)}%`, background: color }} /></i><em>{r.value}</em></li>)}</ul>;
}
function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'ok' | 'bad' | 'warn' }) {
  return <div className={`dx-stat ${tone ?? ''}`}><b>{value}</b><span>{label}</span></div>;
}
function Health({ ok, label, detail }: { ok: boolean | null; label: string; detail?: ReactNode }) {
  return <li className="dx-health"><i className={ok === null ? 'na' : ok ? 'on' : 'off'} /><div><b>{label}</b>{detail && <small>{detail}</small>}</div></li>;
}

export default function Dashboard() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState('');
  const load = () => api<Dash>('/dashboard').then(setD).catch((e) => setErr(errText(e)));
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, []);

  if (err && !d) return <div className="msg err" role="alert">{err}</div>;
  if (!d) return <div className="dx-load"><div className="dx-sk" /><div className="dx-sk" /><div className="dx-sk" /></div>;

  const { jobs: j, applications: a, outreach: o, inbox: ib, followups: f, system: sy } = d;
  const labels = j.perDay.map((x) => short(x.day));
  const statusParts = Object.entries(a.byStatus).map(([s, v]) => ({ label: (STATUS[s] ?? [s, PALETTE[6]])[0], value: v, color: (STATUS[s] ?? [s, PALETTE[6]])[1] }));
  const totalApps = statusParts.reduce((x, p) => x + p.value, 0);
  const modeParts = j.byWorkMode.map((r, i) => ({ label: r.label.replace(/^./, (c) => c.toUpperCase()), value: r.value, color: PALETTE[i % PALETTE.length] }));
  const limitPct = Math.min(100, Math.round((o.sentToday / Math.max(1, o.dailyLimit)) * 100));
  const hour = new Date().getHours(); const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const needs: { text: string; href: string; tone: string }[] = [];
  if (f.overdue) needs.push({ text: `${f.overdue} follow-up${f.overdue > 1 ? 's' : ''} overdue`, href: '/followups', tone: 'bad' });
  if (ib.unhandled) needs.push({ text: `${ib.unhandled} unhandled repl${ib.unhandled > 1 ? 'ies' : 'y'}`, href: '/inbox', tone: 'warn' });
  if (a.failed) needs.push({ text: `${a.failed} application${a.failed > 1 ? 's' : ''} failed to send`, href: '/applications', tone: 'bad' });
  if (a.drafts) needs.push({ text: `${a.drafts} draft${a.drafts > 1 ? 's' : ''} waiting for approval`, href: '/applications', tone: 'warn' });
  if (!sy.gmail && sy.mailMode !== 'mock') needs.push({ text: 'Connect Gmail to send and read mail', href: '/settings', tone: 'warn' });
  if (!j.total) needs.push({ text: 'Find your first jobs', href: '/discover', tone: 'info' });

  const KPIS = [
    { l: 'Jobs discovered', v: j.total, sub: `+${j.today} today · ${j.last7} this week`, icon: 'briefcase', c: 'k-indigo', trend: j.perDay.map((x) => x.value), color: PALETTE[0], href: '/discover' },
    { l: 'Suitable jobs', v: j.suitable, sub: `${j.analyzed} analyzed${j.avgScore !== null ? ` · avg ${j.avgScore}` : ''}`, icon: 'target', c: 'k-sky', href: '/analyzer' },
    { l: 'Applications sent', v: a.sent, sub: `${a.today} today · ${a.last30} in 30d`, icon: 'send', c: 'k-violet', trend: a.perDay.map((x) => x.value), color: PALETTE[4], href: '/applications' },
    { l: 'HR outreach emails', v: o.emailsSent, sub: `${o.sentToday}/${o.dailyLimit} today`, icon: 'mail', c: 'k-emerald', trend: o.perDay.map((x) => x.value), color: PALETTE[2], href: '/outreach' },
    { l: 'HR replies', v: a.replied, sub: `${a.awaiting} awaiting${a.avgDaysToReply !== null ? ` · ~${a.avgDaysToReply}d` : ''}`, icon: 'bell', c: 'k-amber', href: '/inbox' },
    { l: 'Interviews', v: a.interviews, sub: `${a.offers} offer${a.offers === 1 ? '' : 's'} · ${a.assessments} tests`, icon: 'users', c: 'k-rose', href: '/applications' },
    { l: 'Response rate', v: a.responseRate === null ? '–' : `${a.responseRate}%`, sub: a.responseRate === null ? 'No sends yet' : 'replies ÷ sent', icon: 'trend', c: 'k-indigo', href: '/analytics' },
    { l: 'Follow-ups due', v: f.pending, sub: f.overdue ? `${f.overdue} overdue` : 'all on time', icon: 'clock', c: 'k-sky', href: '/followups' },
  ];

  return (
    <div className="dx">
      <div className="dx-hero">
        <div><h1>{hello} 👋</h1><p>Everything happening in your job search, in one place · updated {ago(d.generatedAt)}</p></div>
        <div className="dx-quick">
          <Link href="/discover" className="btn primary"><Icon name="search" size={14} />Find jobs</Link>
          <Link href="/analyzer" className="btn"><Icon name="scan" size={14} />Analyze</Link>
          <Link href="/outreach" className="btn"><Icon name="send" size={14} />HR outreach</Link>
          <Link href="/mail" className="btn"><Icon name="mail" size={14} />Mailbox</Link>
        </div>
      </div>

      {needs.length > 0 && (
        <div className="dx-needs" role="status"><b>Needs attention</b>{needs.map((n) => <Link key={n.text} href={n.href} className={`dx-tag ${n.tone}`}>{n.text}<Icon name="arrow" size={11} /></Link>)}</div>
      )}

      <section className="dx-kpis">
        {KPIS.map((x) => (
          <Link key={x.l} href={x.href} className={`card kpi2 dx-kpi ${x.c}`}>
            <span className="chip"><Icon name={x.icon} size={16} /></span>
            <div className="t"><b>{x.v}</b><span>{x.l}</span><small>{x.sub}</small></div>
            {x.trend && <Sparkline data={x.trend} color={x.color} w={46} h={18} />}
          </Link>
        ))}
      </section>

      <section className="dx-grid">
        <Card title="Activity, last 14 days" className="w8" hint={<Legend items={[{ label: 'Jobs found', color: PALETTE[1] }, { label: 'Applications', color: PALETTE[0] }, { label: 'HR emails', color: PALETTE[2] }]} />}>
          <BarChart height={170} labels={labels} kind="line" series={[{ name: 'Jobs found', color: PALETTE[1], values: j.perDay.map((x) => x.value) }, { name: 'Applications', color: PALETTE[0], values: a.perDay.map((x) => x.value) }, { name: 'HR emails', color: PALETTE[2], values: o.perDay.map((x) => x.value) }]} />
        </Card>
        <Card title="Pipeline funnel" className="w4" hint="% = step conversion"><Funnel stages={d.funnel} /></Card>

        <Card title="Applications by status" className="w4" hint={`${totalApps} total`}>
          {totalApps === 0 ? <div className="dx-empty">No applications yet<Link href="/analyzer" className="btn sm">Analyze a job</Link></div> : (
            <div className="dx-donut"><Donut parts={statusParts} center={String(totalApps)} sub="applications" /><Legend items={statusParts.map((p) => ({ label: p.label, color: p.color, value: p.value }))} /></div>)}
        </Card>
        <Card title="Match scores" className="w4" hint={j.bestScore !== null ? `best ${j.bestScore} · avg ${j.avgScore}` : 'latest per job'}>
          {j.scoreBuckets.every((b) => b.value === 0) ? <div className="dx-empty">Score a job to see the spread</div> :
            <BarChart height={160} width={360} labels={j.scoreBuckets.map((b) => b.label)} series={[{ name: 'Matches', color: PALETTE[4], values: j.scoreBuckets.map((b) => b.value) }]} />}
        </Card>
        <Card title="Work mode" className="w4" hint={`${j.active} active jobs`}>
          {modeParts.length === 0 ? <div className="dx-empty">No jobs yet</div> : <div className="dx-donut"><Donut parts={modeParts} center={String(j.total)} sub="jobs" /><Legend items={modeParts} /></div>}
        </Card>

        <Card title="HR outreach" className="w4" action={<Link href="/outreach" className="btn sm">Open</Link>}>
          <div className="dx-stats"><Stat label="Emails sent" value={o.emailsSent} tone="ok" /><Stat label="Failed" value={o.emailsFailed} tone={o.emailsFailed ? 'bad' : undefined} /><Stat label="Queued" value={o.queued} /><Stat label="Campaigns" value={o.campaignsTotal} /></div>
          <div className="dx-meter"><span>Today {o.sentToday} / {o.dailyLimit}</span><i><b style={{ width: `${limitPct}%` }} className={limitPct >= 90 ? 'hot' : ''} /></i></div>
          <div className="dx-wa"><span className="wa-dot" />WhatsApp <b>{o.waSent}</b> sent{o.waFailed ? <> · <b className="bad">{o.waFailed}</b> failed</> : null}</div>
          {o.last && <small className="faint">Last campaign: {o.last.name} · {o.last.status} · {ago(o.last.at)}</small>}
        </Card>
        <Card title="Reply inbox" className="w4" hint={`${ib.total} analysed`} action={<Link href="/inbox" className="btn sm">Open</Link>}>
          {ib.total === 0 ? <div className="dx-empty">No replies analysed yet</div> : (<>
            <Bars rows={ib.byCategory.map((r) => ({ ...r, label: nice(r.label) }))} color={PALETTE[2]} />
            <ul className="dx-list">{ib.recent.slice(0, 3).map((m) => <li key={m.id}><b title={m.subject}>{m.subject}</b><small>{m.from} · {ago(m.at)}{m.state === 'new' ? ' · new' : ''}</small></li>)}</ul></>)}
        </Card>
        <Card title="Follow-ups" className="w4" hint={`${f.pending} pending`} action={<Link href="/followups" className="btn sm">Open</Link>}>
          {f.next.length === 0 ? <div className="dx-empty">Nothing scheduled</div> : <ul className="dx-list">{f.next.map((x) => <li key={x.id}><b title={x.title}>{x.title}</b><small className={new Date(x.dueAt).getTime() < Date.now() ? 'bad' : ''}>{nice(x.kind)} · {due(x.dueAt)}</small></li>)}</ul>}
        </Card>

        <Card title="Top skills in your jobs" className="w4" hint="most requested"><Bars rows={j.topSkills.slice(0, 8)} color={PALETTE[4]} empty="Analyze jobs to see demand" /></Card>
        <Card title="Top companies" className="w4"><Bars rows={j.topCompanies} color={PALETTE[0]} /></Card>
        <Card title="Sources & locations" className="w4">
          <Bars rows={j.bySource.slice(0, 4)} color={PALETTE[1]} />
          <div className="dx-sep" />
          <Bars rows={j.topLocations.slice(0, 4)} color={PALETTE[3]} empty="No locations yet" />
        </Card>

        <Card title="System health" className="w4" hint={new Date(d.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}>
          <ul className="dx-healths">
            <Health ok={sy.ai.provider !== 'mock'} label={`AI · ${sy.ai.provider === 'mock' ? 'not configured' : 'Gemini'}`} detail={sy.ai.provider === 'mock' ? 'Set GEMINI_API_KEY' : sy.ai.model} />
            {sy.ai.keys.length > 0 && <li className="dx-keys">{sy.ai.keys.map((k) => <span key={k.label} className={`k ${k.state}`} title={k.state === 'cooling' ? `Resting ${k.retryInSec}s` : k.state}>{k.label} ·{k.tail}</span>)}</li>}
            <Health ok={sy.gmail ? sy.gmail.status === 'active' : sy.mailMode === 'mock' ? null : false} label={sy.gmail ? `Gmail · ${sy.gmail.email}` : 'Gmail not connected'} detail={sy.gmail ? (sy.gmail.error ? sy.gmail.error : sy.gmail.lastSyncAt ? `synced ${ago(sy.gmail.lastSyncAt)}` : 'connected') : sy.mailMode === 'mock' ? 'Demo mail mode' : 'Connect in Settings'} />
            <Health ok={sy.whatsapp.configured} label={sy.whatsapp.configured ? `WhatsApp · ${sy.whatsapp.mode}` : 'WhatsApp not set up'} detail={sy.whatsapp.channel ?? (sy.whatsapp.configured ? undefined : 'Add WHATSAPP_* to .env')} />
          </ul>
        </Card>
        <Card title="Library" className="w4">
          <div className="dx-stats"><Stat label="Resumes" value={d.library.resumes} /><Stat label="With file" value={d.library.resumeFiles} /><Stat label="Profiles" value={d.library.profiles.length} /><Stat label="Contacts" value={d.contacts.total} /></div>
          <ul className="dx-list">{d.library.profiles.slice(0, 3).map((p) => <li key={p.id}><b>{p.name}</b><small>{p.titles.join(', ') || 'No titles'} · {p.skills} skills · min score {p.minScore}</small></li>)}</ul>
          {d.library.profiles.length === 0 && <div className="dx-empty">No career profile yet<Link href="/profiles" className="btn sm">Create one</Link></div>}
          <small className="faint">Contacts: {d.contacts.verified} verified · {d.contacts.suppressed} suppressed</small>
        </Card>
        <Card title="Recent applications" className="w4" action={<Link href="/applications" className="btn sm">View all</Link>}>
          {a.recent.length === 0 ? <div className="dx-empty">Nothing here yet</div> : (
            <ul className="dx-list rec">{a.recent.map((x) => <li key={x.id}><span className="pg-av sm">{(x.company || '?')[0].toUpperCase()}</span><div><b title={x.title}>{x.title || 'Untitled'}</b><small>{x.company} · {ago(x.at)}</small></div><em className="dx-st" style={{ color: (STATUS[x.status] ?? ['', PALETTE[6]])[1] }}>{(STATUS[x.status] ?? [x.status.replace(/_/g, ' ')])[0]}{x.score !== null ? ` · ${x.score}` : ''}</em></li>)}</ul>)}
        </Card>
      </section>
    </div>
  );
}
