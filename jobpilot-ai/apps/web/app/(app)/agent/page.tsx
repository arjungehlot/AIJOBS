'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui';
import { api, errText } from '@/lib/api';

const MODES = [
  { id: 'manual', t: 'Manual', ic: 'target', d: 'Scores jobs and recommends. Prepares and sends nothing.' },
  { id: 'copilot', t: 'Copilot', ic: 'spark', d: 'Prepares drafts for qualifying jobs. You approve every one.' },
  { id: 'autonomous', t: 'Autonomous', ic: 'bot', d: 'Sends by itself when a job passes every auto-send rule. Everything else stays a draft.' },
];
const ACT: Record<string, { l: string; tone: string }> = { sent: { l: 'Sent', tone: 'ok' }, send_failed: { l: 'Send failed', tone: 'bad' }, drafted: { l: 'Draft created', tone: 'ok' }, draft: { l: 'Would draft', tone: 'ok' }, auto_send: { l: 'Would auto-send', tone: 'ok' }, recommend: { l: 'Recommended', tone: '' }, hold: { l: 'On hold', tone: 'warn' }, skip: { l: 'Skipped', tone: 'gray' } };

export default function Agent() {
  const [c, setC] = useState<any>(null); const [runs, setRuns] = useState<any[]>([]); const [last, setLast] = useState<any>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]); const [resumes, setResumes] = useState<any[]>([]); const [ai, setAi] = useState<any>(null); const [mail, setMail] = useState<any>(null);
  const load = () => { api('/agent').then(setC).catch((e) => setErr(errText(e))); api('/agent/runs').then(setRuns).catch(() => undefined); };
  useEffect(() => {
    load();
    api<any[]>('/career-profiles').then(setProfiles).catch(() => undefined); api<any[]>('/resumes').then(setResumes).catch(() => undefined);
    api('/ai/settings').then(setAi).catch(() => undefined); api('/integrations/gmail/status').then(setMail).catch(() => undefined);
  }, []);
  const save = (patch: Record<string, unknown>) => api('/agent', { method: 'PUT', body: patch }).then(setC).catch((e) => setErr(errText(e)));
  const num = (k: string, min: number, max: number, unit?: string) => (
    <span className="ag-in"><input type="number" min={min} max={max} value={c[k]} onChange={(e) => setC({ ...c, [k]: Number(e.target.value) })} onBlur={(e) => save({ [k]: Number(e.target.value) })} />{unit && <em>{unit}</em>}</span>);
  const Sw = ({ v, on: set, label, hint }: { v: boolean; on: (b: boolean) => void; label: string; hint?: string }) => (
    <div className="ag-sw"><button type="button" role="switch" aria-checked={v} aria-label={label} className={v ? 'on' : ''} onClick={() => set(!v)}><i /></button><div><b>{label}</b>{hint && <small>{hint}</small>}</div></div>);
  async function run(dry: boolean, discover = false) {
    setBusy(true); setErr('');
    try { setLast(await api('/agent/run', { body: { dryRun: dry, discover } })); load(); } catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  }
  if (!c) return <div className="card muted">{err || 'Loading'}</div>;
  const on = !c.paused;
  const ready = [
    { ok: !!ai?.configured, t: ai?.configured ? `AI · ${ai.model}` : 'AI off', h: ai?.configured ? '' : 'Add GEMINI_API_KEY' },
    { ok: !!mail?.connected, t: mail?.connected ? 'Gmail connected' : 'Gmail not connected', h: mail?.connected ? mail.email : 'Connect in Email Setup' },
    { ok: mail?.mailMode === 'gmail', t: mail?.mailMode === 'gmail' ? 'Real sending on' : 'Test mode', h: mail?.mailMode === 'gmail' ? '' : 'Nothing really sends' },
    { ok: resumes.some((r) => r.fileName), t: resumes.some((r) => r.fileName) ? 'Resume PDF ready' : 'No resume PDF', h: resumes.some((r) => r.fileName) ? 'Attached to emails' : 'Upload in Resume Studio' },
  ];

  return (
    <>
      <div className="ph"><div><h1>AI agent</h1><p>Finds openings, scores them, writes the emails and attaches your resume, inside the limits you set. It only sends by itself in Autonomous mode with auto-send and real Gmail sending on.</p></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}

      <section className={`card ag-top ${on ? 'live' : ''}`}>
        <div className="ag-state">
          <span className="ag-dot" aria-hidden="true" />
          <div><b>{on ? 'Agent is active' : 'Agent is paused'}</b><small>{on ? (c.autoRun && c.mode !== 'manual' ? `Hands-off · runs about every ${c.autoRunEveryMin} min inside your run window` : 'Runs only when you press a Run button') : 'Nothing is prepared until you resume'}</small></div>
          <span className="pill gray" style={{ textTransform: 'capitalize' }}>{c.mode}</span>
        </div>
        <div className="ag-ready">
          {ready.map((r) => <span key={r.t} className={`ag-r ${r.ok ? 'ok' : 'no'}`} title={r.h}><i />{r.t}{r.h && r.ok && r.t.startsWith('Gmail') && <small>{r.h}</small>}</span>)}
          <a href="/settings/ai" className="ag-link">AI settings →</a>
        </div>
        <div className="ag-btns">
          <button className={`btn ${on ? '' : 'primary'}`} onClick={() => api(`/agent/${on ? 'pause' : 'resume'}`, { body: {} }).then(setC)}>{on ? 'Pause' : 'Resume'}</button>
          <button className="btn danger" onClick={() => api('/agent/stop', { body: {} }).then(setC)}><Icon name="stop" size={12} />Emergency stop</button>
        </div>
      </section>

      <div className="ag-grid">
        <div className="ag-col">
          <section className="card ag-card">
            <div className="ag-h"><h2>Mode</h2><small>How much the agent may do on its own</small></div>
            <div className="ag-modes">
              {MODES.map((m) => (
                <button key={m.id} onClick={() => save({ mode: m.id })} aria-pressed={c.mode === m.id} className={c.mode === m.id ? 'on' : ''}>
                  <span className="mi"><Icon name={m.ic} size={15} /></span><b>{m.t}</b><small>{m.d}</small>
                </button>))}
            </div>
          </section>

          <section className="card ag-card">
            <div className="ag-h"><h2>Safety limits</h2><small>Hard rules the agent can never exceed</small></div>
            <div className="ag-nums">
              <label>Minimum match score{num('minScore', 0, 100, 'pts')}</label>
              <label>Auto-send threshold{num('autoSendMinScore', 0, 100, 'pts')}</label>
              <label>Max per day{num('maxPerDay', 0, 50, '/ day')}</label>
              <label>Max per company{num('maxPerCompany30d', 0, 10, '/ 30 d')}</label>
              <label>Run window starts{num('windowStartHour', 0, 23, 'h')}</label>
              <label>Run window ends{num('windowEndHour', 0, 24, 'h')}</label>
            </div>
            <Sw v={!!c.autoSendEnabled} on={(b) => save({ autoSendEnabled: b })} label="Let the agent send emails by itself" hint="Autonomous mode only, and only for jobs scoring at or above the auto-send threshold." />
            {c.autoSendEnabled && mail?.mailMode !== 'gmail' && <div className="msg warn" style={{ margin: 0 }}>MAIL_PROVIDER is not “gmail”, so nothing will really be sent. Drafts are still created.</div>}
            <ul className="ag-rules">
              <li>Jobs with a failed must-have (visa, location, experience) are always skipped.</li>
              <li>Unverified recipients are never eligible for auto-send.</li>
              <li>Already applied, or the company limit reached: skipped or held.</li>
            </ul>
          </section>
        </div>

        <div className="ag-col">
          <section className="card ag-card">
            <div className="ag-h"><h2>What it uses</h2></div>
            <div className="ag-2">
              <label className="f">Career profile<select value={c.careerProfileId ?? ''} onChange={(e) => save({ careerProfileId: e.target.value || null })}><option value="">First profile</option>{profiles.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></label>
              <label className="f">Email tone<select value={c.tone ?? 'professional'} onChange={(e) => save({ tone: e.target.value })}>{['professional', 'concise', 'friendly', 'technical'].map((t) => <option key={t}>{t}</option>)}</select></label>
            </div>
            <label className="f">Resume<select value={c.resumeId ?? ''} onChange={(e) => save({ resumeId: e.target.value || null })}><option value="">Newest resume</option>{resumes.map((r) => <option key={r._id} value={r._id}>{r.title}{r.fileName ? ' · PDF' : ''}</option>)}</select></label>
            <Sw v={!!c.autoRun} on={(b) => save({ autoRun: b })} label="Hands-off mode" hint="Find jobs and run by itself while the API server is running." />
            {c.autoRun && <label className="f">Run every<select value={c.autoRunEveryMin ?? 120} onChange={(e) => save({ autoRunEveryMin: Number(e.target.value) })}>{[[30, '30 minutes'], [60, '1 hour'], [120, '2 hours'], [360, '6 hours'], [720, '12 hours'], [1440, 'day']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
          </section>

          <section className="card ag-card">
            <div className="ag-h"><h2>Run</h2><small>Dry run changes nothing</small></div>
            <div className="ag-btns" style={{ marginLeft: 0 }}>
              <button className="btn" disabled={busy} onClick={() => run(true)}>Dry run</button>
              <button className="btn primary" disabled={busy || c.paused || c.mode === 'manual'} title={c.paused ? 'Resume the agent first' : c.mode === 'manual' ? 'Manual mode never prepares drafts' : ''} onClick={() => run(false, true)}>{busy ? 'Running…' : 'Find jobs & run now'}</button>
            </div>
            <small className="faint">A live run can create drafts and, in Autonomous mode with auto-send on, send qualifying ones.</small>
          </section>

          <section className="card ag-card">
            <div className="ag-h"><h2>Recent runs</h2></div>
            {runs.length === 0 ? <div className="faint">No runs yet.</div> : <div className="ag-runs">{runs.slice(0, 6).map((r) => (
              <div key={r._id} className="ag-run">
                <span className={`pill ${r.kind === 'dry_run' ? 'gray' : 'ok'}`}>{r.kind === 'dry_run' ? 'Dry' : 'Live'}</span>
                <span className="sm">{Object.entries(r.summary).map(([k, v]) => `${v} ${ACT[k]?.l.toLowerCase() ?? k}`).join(' · ') || 'No jobs evaluated'}</span>
                <span className="faint">{new Date(r.createdAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>))}</div>}
          </section>
        </div>
      </div>

      {last && (
        <section className="card ag-card scroll">
          <div className="ag-h"><h2>{last.kind === 'dry_run' ? 'Dry-run result' : 'Run result'}</h2><small>{last.decisions.length} jobs evaluated{last.discovery && (last.discovery.error ? ` · discovery failed: ${last.discovery.error}` : ` · discovery: ${last.discovery.newJobs} new of ${last.discovery.relevant} relevant`)}</small></div>
          {last.decisions.length === 0 ? <div className="faint">No active jobs to evaluate. Use the Job Finder or the Job Analyzer to add some.</div> : (
            <table className="ag-tbl"><thead><tr><th>Job</th><th>Score</th><th>Decision</th><th>Why</th></tr></thead><tbody>
              {last.decisions.map((d: any) => <tr key={d.jobId}><td><b>{d.title}</b><div className="faint">{d.company}</div></td><td><b>{d.score}</b></td>
                <td><span className={`pill ${ACT[d.outcome]?.tone ?? ''}`}>{ACT[d.outcome]?.l ?? d.outcome}</span></td><td className="faint">{d.reasons.join(' ')}</td></tr>)}
            </tbody></table>)}
        </section>)}
    </>
  );
}
