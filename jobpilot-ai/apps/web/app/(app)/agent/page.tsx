'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui';
import { api, errText } from '@/lib/api';

const MODES = [
  { id: 'manual', t: 'Manual', d: 'Scores jobs and recommends. Prepares and sends nothing.' },
  { id: 'copilot', t: 'Copilot', d: 'Prepares drafts for qualifying jobs. You approve every one.' },
  { id: 'autonomous', t: 'Autonomous', d: 'Like copilot, but sends by itself when a job passes every auto-send rule below. Everything else stays a draft for you.' },
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
  const num = (k: string, min: number, max: number) => <input type="number" min={min} max={max} value={c[k]} onChange={(e) => setC({ ...c, [k]: Number(e.target.value) })} onBlur={(e) => save({ [k]: Number(e.target.value) })} />;
  async function run(dry: boolean, discover = false) {
    setBusy(true); setErr('');
    try { setLast(await api('/agent/run', { body: { dryRun: dry, discover } })); load(); } catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  }
  if (!c) return <div className="card muted">{err || 'Loading'}</div>;
  const on = !c.paused;

  return (
    <>
      <div className="ph"><div><h1>AI agent</h1><p>Finds openings, scores them against your profile, writes the emails with AI and attaches your resume. It stays inside the limits below, and it only sends by itself when you switch Autonomous mode, auto-send and real Gmail sending on.</p></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}
      <section className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', borderColor: on ? 'var(--ok)' : 'var(--line)' }}>
        <span className={`kpi-ic ${on ? 'c-emerald' : ''}`} style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: on ? undefined : 'var(--line-2)' }}><Icon name={on ? 'bot' : 'pause'} size={18} /></span>
        <div style={{ flex: '1 1 220px' }}><b style={{ fontSize: 15 }}>{on ? 'Agent is active' : 'Agent is paused'}</b><div className="faint">Mode: {c.mode}. {on ? (c.autoRun && c.mode !== 'manual' ? `Hands-off: runs by itself about every ${c.autoRunEveryMin} min inside your run window.` : 'Runs happen only when you press a Run button.') : 'Nothing will be prepared until you resume.'}</div></div>
        <button className={`btn ${on ? '' : 'primary'}`} onClick={() => api(`/agent/${on ? 'pause' : 'resume'}`, { body: {} }).then(setC)}>{on ? 'Pause' : 'Resume'}</button>
        <button className="btn" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={() => api('/agent/stop', { body: {} }).then(setC)}><Icon name="stop" size={13} />Emergency stop</button>
      </section>

      <section className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span className="faint">Readiness:</span>
        <span className={`pill ${ai?.configured ? 'ok' : 'warn'}`}>{ai?.configured ? `AI: ${ai.model}` : 'AI off (add GEMINI_API_KEY)'}</span>
        <span className={`pill ${mail?.connected ? 'ok' : 'warn'}`}>{mail?.connected ? `Gmail: ${mail.email}` : 'Gmail not connected'}</span>
        <span className={`pill ${mail?.mailMode === 'gmail' ? 'ok' : 'warn'}`}>{mail?.mailMode === 'gmail' ? 'Real sending on' : 'Test mode: nothing really sends'}</span>
        <span className={`pill ${resumes.some((r) => r.fileName) ? 'ok' : 'warn'}`}>{resumes.some((r) => r.fileName) ? 'Resume PDF attached to emails' : 'No resume PDF uploaded'}</span>
        <a href="/settings/ai" className="btn sm" style={{ marginLeft: 'auto' }}>AI settings</a>
      </section>

      <div className="grid">
        <div className="s7 stack">
          <section className="card stack">
            <h2>Mode</h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
              {MODES.map((m) => (
                <button key={m.id} onClick={() => save({ mode: m.id })} aria-pressed={c.mode === m.id}
                  style={{ textAlign: 'left', padding: 12, borderRadius: 10, cursor: 'pointer', font: 'inherit', border: `1.5px solid ${c.mode === m.id ? 'var(--primary)' : 'var(--line)'}`, background: c.mode === m.id ? 'var(--primary-50)' : '#fff' }}>
                  <b>{m.t}</b><div className="faint" style={{ marginTop: 3 }}>{m.d}</div></button>))}
            </div>
          </section>
          <section className="card stack">
            <h2>Safety limits</h2>
            <div className="row">
              <label className="f col">Minimum match score {num('minScore', 0, 100)}</label>
              <label className="f col">Auto-send threshold {num('autoSendMinScore', 0, 100)}</label>
              <label className="f col">Max per day {num('maxPerDay', 0, 50)}</label>
              <label className="f col">Max per company / 30 days {num('maxPerCompany30d', 0, 10)}</label>
            </div>
            <div className="row">
              <label className="f col">Run window starts (hour) {num('windowStartHour', 0, 23)}</label>
              <label className="f col">Run window ends (hour) {num('windowEndHour', 0, 24)}</label>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={c.autoSendEnabled} onChange={(e) => save({ autoSendEnabled: e.target.checked })} />Let the agent send emails by itself <span className="faint">(Autonomous mode only, and only for jobs scoring at or above the auto-send threshold)</span></label>
            {c.autoSendEnabled && mail?.mailMode !== 'gmail' && <div className="msg warn">MAIL_PROVIDER is not “gmail”, so nothing will really be sent. Drafts are still created.</div>}
            <ul className="faint" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Jobs with a failed must-have (visa, location, experience) are always skipped.</li>
              <li>Unverified recipients are never eligible for auto-send.</li>
              <li>You already applied to the job, or the company limit is reached: skipped or held.</li>
            </ul>
          </section>
        </div>
        <div className="s5 stack">
          <section className="card stack">
            <h2>What it uses</h2>
            <label className="f">Career profile<select value={c.careerProfileId ?? ''} onChange={(e) => save({ careerProfileId: e.target.value || null })}><option value="">First profile</option>{profiles.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></label>
            <label className="f">Resume<select value={c.resumeId ?? ''} onChange={(e) => save({ resumeId: e.target.value || null })}><option value="">Newest resume</option>{resumes.map((r) => <option key={r._id} value={r._id}>{r.title}{r.fileName ? ' · PDF' : ''}</option>)}</select></label>
            <label className="f">Email tone<select value={c.tone ?? 'professional'} onChange={(e) => save({ tone: e.target.value })}>{['professional', 'concise', 'friendly', 'technical'].map((t) => <option key={t}>{t}</option>)}</select></label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!c.autoRun} onChange={(e) => save({ autoRun: e.target.checked })} />Hands-off mode: find jobs and run by itself</label>
            {c.autoRun && <label className="f">Run every<select value={c.autoRunEveryMin ?? 120} onChange={(e) => save({ autoRunEveryMin: Number(e.target.value) })}>{[[30, '30 minutes'], [60, '1 hour'], [120, '2 hours'], [360, '6 hours'], [720, '12 hours'], [1440, 'day']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
            {c.autoRun && <div className="faint">Works while the API server is running. Set <code>AGENT_AUTORUN=false</code> in .env to disable it for everyone.</div>}
          </section>
          <section className="card stack">
            <h2>Run</h2>
            <p className="faint" style={{ margin: 0 }}>Dry run shows what the agent would do and changes nothing. A live run can create drafts and, in Autonomous mode with auto-send on, send qualifying ones.</p>
            <div className="row"><button className="btn" disabled={busy} onClick={() => run(true)}>Dry run</button>
              <button className="btn primary" disabled={busy || c.paused || c.mode === 'manual'} title={c.paused ? 'Resume the agent first' : c.mode === 'manual' ? 'Manual mode never prepares drafts' : ''} onClick={() => run(false, true)}>Find jobs &amp; run now</button></div>
          </section>
          <section className="card">
            <h2>Recent runs</h2>
            {runs.length === 0 ? <div className="empty">No runs yet.</div> : runs.slice(0, 6).map((r) => (
              <div key={r._id} style={{ padding: '7px 0', borderTop: '1px solid var(--line)' }}>
                <span className={`pill ${r.kind === 'dry_run' ? 'gray' : 'ok'}`}>{r.kind === 'dry_run' ? 'dry run' : 'live'}</span> <span className="faint">{new Date(r.createdAt).toLocaleString()}</span>
                <div className="faint">{Object.entries(r.summary).map(([k, v]) => `${v} ${ACT[k]?.l.toLowerCase() ?? k}`).join(' · ') || 'No jobs evaluated'}</div>
              </div>))}
          </section>
        </div>
      </div>

      {last && (
        <section className="card scroll">
          <div className="card-h"><h2>{last.kind === 'dry_run' ? 'Dry-run result' : 'Run result'}</h2><span className="faint">{last.decisions.length} jobs evaluated{last.discovery && (last.discovery.error ? ` · discovery failed: ${last.discovery.error}` : ` · discovery: ${last.discovery.newJobs} new of ${last.discovery.relevant} relevant`)}</span></div>
          {last.decisions.length === 0 ? <div className="empty">No active jobs to evaluate. Use the Job Finder or the Job Analyzer to add some.</div> : (
            <table><thead><tr><th>Job</th><th>Score</th><th>Decision</th><th>Why</th></tr></thead><tbody>
              {last.decisions.map((d: any) => <tr key={d.jobId}><td><b>{d.title}</b><div className="faint">{d.company}</div></td><td>{d.score}</td>
                <td><span className={`pill ${ACT[d.outcome]?.tone ?? ''}`}>{ACT[d.outcome]?.l ?? d.outcome}</span></td><td className="faint">{d.reasons.join(' ')}</td></tr>)}
            </tbody></table>)}
        </section>)}
    </>
  );
}
