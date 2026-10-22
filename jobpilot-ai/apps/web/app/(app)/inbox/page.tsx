'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

const CAT: Record<string, { label: string; tone: string }> = {
  interview_invitation: { label: 'Interview invite', tone: 'ok' }, recruiter_screening: { label: 'Recruiter call', tone: 'ok' },
  assessment: { label: 'Assessment', tone: 'warn' }, info_request: { label: 'Info request', tone: 'warn' }, rejection: { label: 'Rejection', tone: 'bad' },
  application_confirmation: { label: 'Received', tone: 'gray' }, salary_discussion: { label: 'Salary talk', tone: 'warn' }, offer: { label: 'Offer', tone: 'ok' },
  follow_up_required: { label: 'Needs reply', tone: 'warn' }, unrelated: { label: 'Unrelated', tone: 'gray' }, uncertain: { label: 'Unclear', tone: 'gray' },
};
const EXAMPLE = {
  fromEmail: 'priya@acme.example', subject: 'Interview invitation – Backend Engineer',
  body: 'Hi,\n\nThank you for applying. We would like to invite you to an interview on 28 Oct at 11:00 AM IST.\nJoin here: https://meet.google.com/abc-defg-hij\nPlease share your updated resume and portfolio before then.\n\nRegards,\nPriya Nair',
};

export default function Inbox() {
  const [msgs, setMsgs] = useState<any[] | null>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [form, setForm] = useState({ fromEmail: '', subject: '', body: '' });
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const load = () => api('/inbox').then(setMsgs).catch((e) => setErr(errText(e)));
  useEffect(() => { load(); api('/applications?limit=100').then((r) => setApps(r.items.filter((a: any) => a.sentAt || a.status !== 'draft'))).catch(() => undefined); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setOk('');
    try { await api('/inbox', { body: { ...form, fromEmail: form.fromEmail || undefined } }); setForm({ fromEmail: '', subject: '', body: '' }); setOk('Reply analyzed. Nothing was changed automatically.'); load(); }
    catch (x) { setErr(errText(x)); }
  }
  async function syncGmail() {
    setErr(''); setOk('');
    try { const r = await api('/integrations/gmail/sync', { body: {} }); setOk(`Checked ${r.threadsChecked} conversations, imported ${r.imported} new.`); load(); } catch (x) { setErr(errText(x)); }
  }
  async function act(id: string, path: string, body?: unknown) {
    setErr(''); setOk('');
    try { const r = await api(`/inbox/${id}/${path}`, { body: body ?? {}, method: 'POST' }); if (path === 'apply') setOk(`Application moved to "${String(r.status).replace('_', ' ')}". Pending reminders for it were cancelled.`); load(); }
    catch (x) { setErr(errText(x)); }
  }

  return (
    <>
      <div className="ph"><div><h1>Reply Inbox</h1><p>Recruiter replies, classified with fixed rules. A status only changes when you press Apply.</p></div>
        <button className="btn primary" onClick={syncGmail}>↻ Sync Gmail</button></div>
      {err && <div className="msg err" role="alert">{err}</div>}{ok && <div className="msg ok">{ok}</div>}
      <div className="pg-two">
        <form className="card pg-form" onSubmit={submit} style={{ position: 'sticky', top: 8 }}>
          <div className="card-h" style={{ margin: 0 }}><div className="pg-h"><span className="ic" style={{ background: 'linear-gradient(135deg,#38BDF8,#6366F1)' }}>✉</span><h2>Analyze a reply</h2></div><button type="button" className="btn sm" onClick={() => setForm(EXAMPLE)}>Fill example</button></div>
          <label className="az-f">From (optional)<input value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} placeholder="recruiter@company.com" /></label>
          <label className="az-f">Subject<input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
          <label className="az-f">Email text<textarea required rows={9} style={{ height: 'auto', minHeight: 170 }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
          <button className="btn primary" style={{ alignSelf: 'flex-start' }}>Analyze reply</button>
          <p className="faint" style={{ fontSize: 11.5, margin: 0 }}>🔒 Connect Gmail under Email Setup to import replies automatically. Instructions inside an email are treated as text and are never followed.</p>
        </form>
        <div className="pg-list">
          {!msgs ? <div className="card muted">Loading</div> : msgs.length === 0 ? <div className="card pg-empty"><div className="big">📬</div><b>No replies yet</b><span>Paste one on the left, press “Fill example”, or sync Gmail.</span></div> : msgs.map((m) => {
            const a = m.analysis, c = CAT[a.category] ?? CAT.uncertain, ex = a.extracted ?? {};
            const linked = m.applicationId && m.applicationId._id;
            return (
              <article className={`card pg-msg ${c.tone}`} key={m._id}>
                <div className="card-h">
                  <div><b>{m.subject}</b><div className="faint">{m.fromEmail ?? 'unknown sender'} · {new Date(m.receivedAt).toLocaleString()}</div></div>
                  <div style={{ textAlign: 'right' }}><span className={`pill ${c.tone}`}>{c.label}</span><div className="faint">{Math.round(a.confidence * 100)}% sure</div></div>
                </div>
                <div className="msg" style={{ background: 'var(--primary-50)', color: 'var(--ink)' }}><b>Suggested next step:</b> {a.nextAction}</div>
                <div className="row" style={{ gap: 14 }}>
                  {ex.whenText && <span><span className="faint">When</span><br /><b>{ex.whenText}</b></span>}
                  {ex.meetingLink && <span><span className="faint">Link</span><br /><a href={ex.meetingLink} target="_blank" rel="noreferrer">Open meeting</a></span>}
                  {ex.deadlineText && <span><span className="faint">Deadline</span><br /><b>{ex.deadlineText}</b></span>}
                  {ex.recruiterName && <span><span className="faint">Recruiter</span><br /><b>{ex.recruiterName}</b></span>}
                  {ex.requestedDocs?.length > 0 && <span><span className="faint">They want</span><br /><b>{ex.requestedDocs.join(', ')}</b></span>}
                </div>
                <details><summary className="faint" style={{ cursor: 'pointer' }}>Why this label</summary><ul className="faint">{a.signals.length ? a.signals.map((s: string) => <li key={s}>{s}</li>) : <li>No known phrases matched.</li>}</ul></details>
                <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                  {linked ? <span className="pill gray">{m.applicationId.jobId?.title} · {m.applicationId.jobId?.company} ({m.applicationId.status.replace('_', ' ')})</span> : (
                    <select aria-label="Link to application" style={{ maxWidth: 260 }} defaultValue="" onChange={(e) => e.target.value && act(m._id, 'link', { applicationId: e.target.value })}>
                      <option value="">Link to an application…</option>
                      {apps.map((x) => <option key={x._id} value={x._id}>{x.jobId?.title} · {x.jobId?.company}</option>)}
                    </select>)}
                  <span className="sp" style={{ flex: 1 }} />
                  {m.state === 'handled' ? <span className="pill ok">Applied: {m.appliedStatus?.replace('_', ' ')}</span>
                    : m.suggestedStatus && <button className="btn primary sm" disabled={!linked} title={linked ? '' : 'Link an application first'} onClick={() => act(m._id, 'apply')}>Move to “{m.suggestedStatus.replace('_', ' ')}”</button>}
                  <button className="btn sm" onClick={() => api(`/inbox/${m._id}`, { method: 'DELETE' }).then(load).catch((x) => setErr(errText(x)))}>Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
