'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Pill } from '@/components/ui';
import { api, errText } from '@/lib/api';

type Parsed = { valid: { email: string; name?: string; company?: string }[]; invalid: { line: string; reason: string }[]; duplicates: number; truncated: number; alreadyContacted: string[] };
type Camp = { id: string; name: string; subject: string; status: string; gapSec: number; nextAt: string | null; note: string | null; counts: Record<string, number>; total: number };
const TONES: Record<string, 'ok' | 'warn' | 'bad' | 'gray' | ''> = { running: 'ok', done: 'ok', paused: 'warn', draft: 'gray', cancelled: 'gray', sent: 'ok', failed: 'bad', queued: 'gray', sending: 'warn', skipped: 'gray' };
const SAMPLE = 'hr@acme.com\nPriya Shah <priya@zetacloud.io>\ntalent@brightpay.in, Ravi Kumar, Brightpay';

export default function Outreach() {
  const [text, setText] = useState(''); const [parsed, setParsed] = useState<Parsed | null>(null);
  const [resumes, setResumes] = useState<any[]>([]); const [resumeId, setResumeId] = useState('');
  const [name, setName] = useState(''); const [role, setRole] = useState(''); const [subject, setSubject] = useState(''); const [body, setBody] = useState('');
  const [gap, setGap] = useState(45); const [extra, setExtra] = useState(true);
  const [lim, setLim] = useState<any>(null); const [camps, setCamps] = useState<Camp[]>([]); const [open, setOpen] = useState<string | null>(null); const [detail, setDetail] = useState<any>(null);
  const [prev, setPrev] = useState<{ subject: string; html: string } | null>(null);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const loadCamps = () => api<Camp[]>('/outreach/campaigns').then(setCamps).catch(() => undefined);
  useEffect(() => {
    api<any[]>('/resumes').then((r) => { const withFile = r.filter((x) => (x.fileSize ?? 0) > 0); setResumes(withFile); if (withFile[0]) setResumeId(String(withFile[0]._id)); }).catch(() => undefined);
    api('/outreach/limits').then(setLim).catch(() => undefined); loadCamps();
  }, []);
  // Live-check the pasted list with the same rules the server uses when sending.
  useEffect(() => {
    if (!text.trim()) { setParsed(null); return; }
    const t = setTimeout(() => { api<Parsed>('/outreach/parse', { body: { text } }).then(setParsed).catch(() => undefined); }, 350);
    return () => clearTimeout(t);
  }, [text]);
  // Refresh progress while something is running.
  const running = camps.some((c) => c.status === 'running');
  useEffect(() => {
    if (!running && !open) return;
    const t = setInterval(() => { loadCamps(); if (open) api(`/outreach/campaigns/${open}`).then(setDetail).catch(() => undefined); }, 6000);
    return () => clearInterval(t);
  }, [running, open]);

  const n = parsed?.valid.length ?? 0;
  const minutes = Math.max(1, Math.round((n * gap * 1.3) / 60));
  const ready = n > 0 && !!resumeId && name.trim() && subject.trim().length >= 3 && body.trim().length >= 20;

  async function draft() {
    setBusy('draft'); setErr('');
    try { const d = await api<{ subject: string; body: string }>('/outreach/draft', { body: { role: role || undefined } }); setSubject(d.subject); setBody(d.body); setPrev(null); }
    catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }
  async function preview() {
    setBusy('prev'); setErr('');
    try { setPrev(await api('/outreach/preview', { body: { subject, body, resumeId: resumeId || undefined } })); } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }
  async function create(start: boolean) {
    if (start && !window.confirm(`Send ${n} emails one by one from your Gmail, about ${minutes} minutes apart in total, each with your resume attached?`)) return;
    setBusy(start ? 'start' : 'save'); setErr(''); setOk('');
    try {
      const r = await api('/outreach/campaigns', { body: { name, subject, body, resumeId, includeExtraFiles: extra, gapSec: gap, recipientsText: text, start } });
      setOk(start ? `Started. ${r.recipients} emails will go out one by one. You can leave this page open or come back later.` : `Saved as a draft with ${r.recipients} recipients.`);
      if (start) { setText(''); setParsed(null); setPrev(null); }
      loadCamps(); api('/outreach/limits').then(setLim);
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }
  async function act(id: string, what: 'start' | 'pause' | 'cancel' | 'retry') {
    if (what === 'cancel' && !window.confirm('Cancel this campaign? Emails already sent stay sent; the rest will not be sent.')) return;
    setErr(''); try { await api(`/outreach/campaigns/${id}/${what}`, { body: {} }); await loadCamps(); if (open === id) setDetail(await api(`/outreach/campaigns/${id}`)); } catch (e) { setErr(errText(e)); }
  }
  async function toggle(id: string) { if (open === id) { setOpen(null); setDetail(null); return; } setOpen(id); setDetail(null); setDetail(await api(`/outreach/campaigns/${id}`).catch(() => null)); }
  function onFile(f?: File) { if (!f) return; const r = new FileReader(); r.onload = () => setText((t) => (t ? t + '\n' : '') + String(r.result ?? '')); r.readAsText(f); }

  const used = lim ? Math.min(100, Math.round((lim.sentLast24h / lim.dailyLimit) * 100)) : 0;
  const cur = useMemo(() => resumes.find((r) => String(r._id) === resumeId), [resumes, resumeId]);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="ph"><div><h1>HR Outreach</h1><p>Paste 20, 30 or more HR emails. The AI agent writes to each one in turn, with a clean email and your resume attached.</p></div></div>

      {lim && (
        <div className="card ou-strip">
          <span className={`ou-dot ${lim.gmailConnected ? 'on' : ''}`} /> <b>{lim.gmailConnected ? 'Gmail connected' : 'Gmail not connected'}</b>
          {lim.mailMode !== 'gmail' && <Pill tone="warn">Test mode: nothing is really sent (MAIL_PROVIDER is not gmail)</Pill>}
          {!lim.gmailConnected && <a className="btn sm primary" href="/settings/email">Connect Gmail</a>}
          <span className="sp" />
          <span className="faint">Last 24 h: <b>{lim.sentLast24h}</b> of {lim.dailyLimit} allowed</span><span className="ou-bar"><i style={{ width: `${used}%` }} /></span>
        </div>
      )}
      {err && <div className="msg err" role="alert">{err}</div>}{ok && <div className="msg ok" role="status">{ok}</div>}

      <div className="ou-grid">
        <section className="card stack" style={{ gap: 10 }}>
          <div className="card-h"><h2><span className="ou-n">1</span>Add HR emails</h2><small>{n ? `${n} ready` : 'one per line'}</small></div>
          <textarea className="ou-ta" rows={11} value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE} aria-label="HR email addresses" />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input ref={file} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" className="btn sm" onClick={() => file.current?.click()}><Icon name="file" size={13} />Upload CSV / TXT</button>
            <button type="button" className="btn sm" onClick={() => setText(SAMPLE)}>Insert example</button>
            {text && <button type="button" className="btn sm" onClick={() => setText('')}>Clear</button>}
          </div>
          <p className="faint">Formats: <code>hr@acme.com</code>, <code>Priya Shah &lt;priya@acme.com&gt;</code>, or CSV <code>email, name, company</code>. Duplicates and no-reply addresses are removed automatically.</p>
          {parsed && (
            <div className="ou-parse">
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <Pill tone="ok">{parsed.valid.length} valid</Pill>
                {parsed.duplicates > 0 && <Pill tone="gray">{parsed.duplicates} duplicate{parsed.duplicates > 1 ? 's' : ''} removed</Pill>}
                {parsed.invalid.length > 0 && <Pill tone="bad">{parsed.invalid.length} skipped</Pill>}
                {parsed.truncated > 0 && <Pill tone="warn">{parsed.truncated} over the 100 limit</Pill>}
                {parsed.alreadyContacted.length > 0 && <Pill tone="warn">{parsed.alreadyContacted.length} already emailed in the last 60 days (will be skipped)</Pill>}
              </div>
              {parsed.valid.length > 0 && <div className="ou-chips">{parsed.valid.slice(0, 40).map((v) => <span key={v.email} title={v.company ?? ''}>{v.name ? `${v.name} · ` : ''}{v.email}</span>)}{parsed.valid.length > 40 && <span>+{parsed.valid.length - 40} more</span>}</div>}
              {parsed.invalid.length > 0 && <ul className="ou-bad">{parsed.invalid.slice(0, 6).map((i, k) => <li key={k}><code>{i.line}</code> {i.reason}</li>)}</ul>}
            </div>
          )}
        </section>

        <section className="card stack" style={{ gap: 10 }}>
          <div className="card-h"><h2><span className="ou-n">2</span>Write the email</h2><small>AI can draft it</small></div>
          <label className="f">Campaign name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Node.js jobs, November" maxLength={120} /></label>
          <label className="f">Resume to attach
            <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>{resumes.length === 0 && <option value="">Upload a resume PDF first</option>}{resumes.map((r) => <option key={r._id} value={r._id}>{r.title} · {r.fileName}</option>)}</select>
            {resumes.length === 0 && <span className="faint">No resume with a PDF yet. Add one in <a href="/resumes" style={{ color: 'var(--primary-600)' }}>Resume Studio</a>.</span>}
          </label>
          <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
            <label className="f" style={{ flex: 1 }}>Role you want<input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Full Stack Developer" maxLength={120} /></label>
            <button type="button" className="btn" onClick={draft} disabled={!!busy}><Icon name="spark" size={14} />{busy === 'draft' ? 'Writing…' : 'Write with AI'}</button>
          </div>
          <label className="f">Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} placeholder="Full Stack Developer — Your Name" /></label>
          <label className="f">Message<textarea className="ou-ta" rows={9} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} placeholder={'Hello {{name}},\n\nI am writing to ask whether {{company}} has openings for…'} /></label>
          <p className="faint">Use <code>{'{{name}}'}</code>, <code>{'{{first_name}}'}</code> and <code>{'{{company}}'}</code>. If a name or company is missing, it becomes “Hiring Team” or “your company”. Your saved signature is added automatically.</p>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="row" style={{ gap: 6, fontWeight: 500 }}><input type="checkbox" style={{ width: 'auto', height: 'auto' }} checked={extra} onChange={(e) => setExtra(e.target.checked)} />Also attach my extra files</label>
            <label className="row" style={{ gap: 6, fontWeight: 500 }}>Gap between emails
              <select style={{ width: 110 }} value={gap} onChange={(e) => setGap(Number(e.target.value))}>{[30, 45, 60, 90, 120, 180].map((s) => <option key={s} value={s}>{s >= 60 ? `${s / 60} min` : `${s} sec`}</option>)}</select></label>
          </div>
        </section>
      </div>

      <section className="card stack" style={{ gap: 10 }}>
        <div className="card-h"><h2><span className="ou-n">3</span>Preview and send</h2><small>{cur ? `Attaches ${cur.fileName}` : ''}</small></div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={preview} disabled={!body.trim() || !!busy}><Icon name="search" size={14} />{busy === 'prev' ? 'Building…' : 'Preview the email'}</button>
          <button type="button" className="btn" onClick={() => create(false)} disabled={!ready || !!busy}>Save as draft</button>
          <button type="button" className="btn primary" onClick={() => create(true)} disabled={!ready || !!busy}><Icon name="send" size={14} />{busy === 'start' ? 'Starting…' : `Start sending${n ? ` to ${n}` : ''}`}</button>
          {n > 0 && <span className="faint">About {minutes} min in total, one at a time. Safe to leave this page open or closed while the API runs.</span>}
        </div>
        {prev && (
          <div className="ou-prev"><div className="ou-sub"><b>Subject:</b> {prev.subject}</div><iframe title="Email preview" sandbox="" srcDoc={prev.html} /></div>
        )}
      </section>

      <section className="card stack" style={{ gap: 10 }}>
        <div className="card-h"><h2>Campaigns</h2><small>{camps.length ? `${camps.length} total` : ''}</small></div>
        {camps.length === 0 && <div className="muted">No campaigns yet. Paste your HR emails above and press Start sending.</div>}
        {camps.map((c) => {
          const done = c.counts.sent + c.counts.failed + c.counts.skipped; const pct = c.total ? Math.round((done / c.total) * 100) : 0;
          return (
            <div key={c.id} className="ou-camp">
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <b>{c.name}</b><Pill tone={TONES[c.status] ?? ''}>{c.status}</Pill><span className="faint">{c.subject}</span><span className="sp" />
                {c.status === 'running' && <button className="btn sm" onClick={() => act(c.id, 'pause')}><Icon name="pause" size={12} />Pause</button>}
                {(c.status === 'paused' || c.status === 'draft') && <button className="btn sm primary" onClick={() => act(c.id, 'start')}><Icon name="send" size={12} />{c.status === 'draft' ? 'Start' : 'Resume'}</button>}
                {c.counts.failed > 0 && <button className="btn sm" onClick={() => act(c.id, 'retry')}>Retry failed</button>}
                {['running', 'paused', 'draft'].includes(c.status) && <button className="btn sm" onClick={() => act(c.id, 'cancel')}>Cancel</button>}
                <button className="btn sm" onClick={() => toggle(c.id)}>{open === c.id ? 'Hide' : 'Details'}</button>
              </div>
              <div className="ou-prog"><i style={{ width: `${pct}%` }} /></div>
              <div className="faint">{c.counts.sent} sent · {c.counts.queued + c.counts.sending} waiting · {c.counts.failed} failed · {c.counts.skipped} skipped · {c.total} total{c.status === 'running' && c.nextAt ? ` · next at ${new Date(c.nextAt).toLocaleTimeString()}` : ''}</div>
              {c.note && <div className="msg warn" style={{ marginTop: 4 }}>{c.note}</div>}
              {open === c.id && detail && (
                <div className="ou-rows">{detail.recipients.map((r: any) => (
                  <div key={r.email}><span>{r.name ? `${r.name} · ` : ''}{r.email}{r.company ? <em> · {r.company}</em> : null}</span><Pill tone={TONES[r.status] ?? ''}>{r.status}</Pill>{r.error && <small>{r.error}</small>}</div>))}</div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
