'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Pill } from '@/components/ui';
import { api, errText } from '@/lib/api';

type Rec = { email: string; name?: string; company?: string };
type Parsed = { valid: Rec[]; invalid: { line: string; reason: string }[]; duplicates: number; truncated: number; alreadyContacted: string[] };
type Found = Parsed & { seen: number };
type Camp = { id: string; name: string; subject: string; status: string; gapSec: number; nextAt: string | null; note: string | null; counts: Record<string, number>; total: number };
const TONES: Record<string, 'ok' | 'warn' | 'bad' | 'gray' | ''> = { running: 'ok', done: 'ok', paused: 'warn', draft: 'gray', cancelled: 'gray', sent: 'ok', failed: 'bad', queued: 'gray', sending: 'warn', skipped: 'gray' };
const SAMPLE = 'hr@acme.com\nPriya Shah <priya@zetacloud.io>\ntalent@brightpay.in, Ravi Kumar, Brightpay';
const MAX_IMG = 8 * 1024 * 1024;

/** Shrinks big screenshots so the upload stays small and quick to read. */
async function prepImage(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read that image')); i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

export default function Outreach() {
  const [text, setText] = useState(''); const [parsed, setParsed] = useState<Parsed | null>(null);
  const [resumes, setResumes] = useState<any[]>([]); const [resumeId, setResumeId] = useState('');
  const [name, setName] = useState(''); const [role, setRole] = useState(''); const [subject, setSubject] = useState(''); const [body, setBody] = useState('');
  const [gap, setGap] = useState(45); const [extra, setExtra] = useState(true);
  const [lim, setLim] = useState<any>(null); const [camps, setCamps] = useState<Camp[]>([]);
  const [liveId, setLiveId] = useState<string | null>(null); const [live, setLive] = useState<any>(null);
  const [prev, setPrev] = useState<{ subject: string; html: string } | null>(null);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [undo, setUndo] = useState<string | null>(null); const [aiNote, setAiNote] = useState('');
  const [shot, setShot] = useState<string | null>(null); const [found, setFound] = useState<Found | null>(null); const [pick, setPick] = useState<Set<string>>(new Set()); const [drag, setDrag] = useState(false); const [secs, setSecs] = useState(0);
  const file = useRef<HTMLInputElement>(null); const imgIn = useRef<HTMLInputElement>(null); const bodyRef = useRef<HTMLTextAreaElement>(null); const liveRef = useRef<HTMLElement>(null);

  const loadCamps = useCallback(() => api<Camp[]>('/outreach/campaigns').then(setCamps).catch(() => undefined), []);
  const loadLive = useCallback((id: string) => api(`/outreach/campaigns/${id}`).then(setLive).catch(() => undefined), []);
  useEffect(() => {
    api<any[]>('/resumes').then((r) => { const withFile = r.filter((x) => (x.fileSize ?? 0) > 0); setResumes(withFile); if (withFile[0]) setResumeId(String(withFile[0]._id)); }).catch(() => undefined);
    api('/outreach/limits').then(setLim).catch(() => undefined); loadCamps();
  }, [loadCamps]);
  useEffect(() => {
    if (!text.trim()) { setParsed(null); return; }
    const t = setTimeout(() => { api<Parsed>('/outreach/parse', { body: { text } }).then(setParsed).catch(() => undefined); }, 350);
    return () => clearTimeout(t);
  }, [text]);

  // The live panel follows the running campaign (or the newest one) and refreshes every few seconds while sending.
  const runningCamp = camps.find((c) => c.status === 'running');
  useEffect(() => { if (!liveId) { const c = runningCamp ?? camps.find((x) => x.status === 'paused'); if (c) setLiveId(c.id); } }, [camps, liveId, runningCamp]);
  useEffect(() => { if (liveId) loadLive(liveId); else setLive(null); }, [liveId, loadLive]);
  const liveRunning = live?.status === 'running' || !!runningCamp;
  useEffect(() => {
    if (!liveRunning) return;
    const t = setInterval(() => { loadCamps(); if (liveId) loadLive(liveId); api('/outreach/limits').then(setLim).catch(() => undefined); }, 3000);
    return () => clearInterval(t);
  }, [liveRunning, liveId, loadCamps, loadLive]);

  // Paste a screenshot anywhere on the page.
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/'));
      if (f) { e.preventDefault(); readImage(f); }
    };
    window.addEventListener('paste', h); return () => window.removeEventListener('paste', h);
  });

  useEffect(() => { if (busy !== 'img') { setSecs(0); return; } const t = setInterval(() => setSecs((x) => x + 1), 1000); return () => clearInterval(t); }, [busy]);
  async function readImage(f: Blob) {
    if (f.size > MAX_IMG * 2) { setErr('That image is too large. Use one under 16 MB.'); return; }
    setBusy('img'); setErr(''); setOk(''); setFound(null);
    try {
      const data = await prepImage(f); setShot(data);
      const r = await Promise.race([
        api<Found>('/outreach/from-image', { body: { image: data } }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Reading took too long. Try a smaller crop of the screenshot, or try again.')), 45_000)),
      ]);
      setFound(r); setPick(new Set(r.valid.filter((v) => !r.alreadyContacted.includes(v.email)).map((v) => v.email)));
      if (!r.valid.length) setErr('No email addresses were found in that image. Try a sharper or larger screenshot.');
    } catch (e) { setErr(e instanceof Error && !('status' in e) ? e.message : errText(e)); } finally { setBusy(''); }
  }
  function addPicked() {
    if (!found) return; const lines = found.valid.filter((v) => pick.has(v.email)).map((v) => [v.email, v.name ?? '', v.company ?? ''].join(', ').replace(/(, )+$/, ''));
    setText((t) => (t.trim() ? t.trimEnd() + '\n' : '') + lines.join('\n')); setOk(`Added ${lines.length} email${lines.length === 1 ? '' : 's'} from the image.`); setFound(null); setShot(null);
  }

  const n = parsed?.valid.length ?? 0;
  const minutes = Math.max(1, Math.round((n * gap * 1.3) / 60));
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const checks = [
    { ok: n > 0, t: n ? `${n} email${n > 1 ? 's' : ''}` : 'Add emails' }, { ok: !!resumeId, t: resumeId ? 'Resume' : 'Pick resume' },
    { ok: name.trim().length > 0, t: 'Name' }, { ok: subject.trim().length >= 3 && body.trim().length >= 20, t: 'Message' }, { ok: !!lim?.gmailConnected, t: lim?.gmailConnected ? 'Gmail' : 'Connect Gmail' },
  ];
  const ready = n > 0 && !!resumeId && name.trim() && subject.trim().length >= 3 && body.trim().length >= 20;

  async function draft() {
    setBusy('draft'); setErr('');
    try { const d = await api<{ subject: string; body: string }>('/outreach/draft', { body: { role: role || undefined } }); setUndo(body.trim() ? body : null); setSubject(d.subject); setBody(d.body); setPrev(null); setAiNote('Fresh draft written by AI. Edit freely or enhance it.'); }
    catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }
  async function enhance(action: string) {
    if (body.trim().length < 20) { setErr('Write or generate a message first, then enhance it.'); return; }
    setBusy('ai:' + action); setErr(''); setAiNote('');
    try { const r = await api<{ body: string }>('/outreach/enhance', { body: { body, action } }); setUndo(body); setBody(r.body); setPrev(null); setAiNote('Updated by AI. Read it once before sending.'); }
    catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }
  function insertTag(tag: string) {
    const el = bodyRef.current; if (!el) { setBody((b) => b + tag); return; }
    const a = el.selectionStart ?? body.length, z = el.selectionEnd ?? a; setBody(body.slice(0, a) + tag + body.slice(z));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + tag.length, a + tag.length); });
  }
  async function preview() {
    setBusy('prev'); setErr('');
    try { setPrev(await api('/outreach/preview', { body: { subject, body, resumeId: resumeId || undefined } })); } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }
  async function create(start: boolean) {
    if (start && !window.confirm(`Send ${n} emails one by one from your Gmail, about ${minutes} minutes in total, each with your resume attached?`)) return;
    setBusy(start ? 'start' : 'save'); setErr(''); setOk('');
    try {
      const r = await api('/outreach/campaigns', { body: { name, subject, body, resumeId, includeExtraFiles: extra, gapSec: gap, recipientsText: text, start } });
      setOk(start ? `Started: ${r.recipients} emails go out one by one. Watch the live panel.` : `Saved as a draft with ${r.recipients} recipients.`);
      setLiveId(r.id); if (start) { setText(''); setParsed(null); setPrev(null); setTimeout(() => liveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }
      loadCamps(); loadLive(r.id); api('/outreach/limits').then(setLim);
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }
  async function act(id: string, what: 'start' | 'pause' | 'cancel' | 'retry') {
    if (what === 'cancel' && !window.confirm('Cancel this campaign? Emails already sent stay sent; the rest will not be sent.')) return;
    setErr(''); try { await api(`/outreach/campaigns/${id}/${what}`, { body: {} }); await loadCamps(); setLiveId(id); await loadLive(id); } catch (e) { setErr(errText(e)); }
  }
  function onFile(f?: File) { if (!f) return; const r = new FileReader(); r.onload = () => setText((t) => (t ? t + '\n' : '') + String(r.result ?? '')); r.readAsText(f); }

  const used = lim ? Math.min(100, Math.round((lim.sentLast24h / lim.dailyLimit) * 100)) : 0;
  const cur = useMemo(() => resumes.find((r) => String(r._id) === resumeId), [resumes, resumeId]);
  const AI_ACTIONS: [string, string][] = [['improve', 'Improve'], ['shorter', 'Shorter'], ['friendlier', 'Friendlier'], ['formal', 'Formal'], ['confident', 'Confident'], ['grammar', 'Fix grammar']];

  // live tracker figures
  const recs: any[] = live?.recipients ?? [];
  const cnt = (s: string) => recs.filter((r) => r.status === s).length;
  const sentN = cnt('sent'), failN = cnt('failed'), skipN = cnt('skipped'), total = recs.length;
  const pct = total ? Math.round(((sentN + failN + skipN) / total) * 100) : 0;
  const nowRec = recs.find((r) => r.status === 'sending') ?? (live?.status === 'running' ? recs.find((r) => r.status === 'queued') : null);
  const sending = live?.status === 'running';

  return (
    <div className="ou">
      <header className="ou-bar-top">
        <div className="ou-ttl"><span className="ou-logo"><Icon name="send" size={16} /></span><div><h1>HR Outreach</h1><small>AI writes it, the agent sends it one by one with your resume</small></div></div>
        <div className="ou-pills">
          <span className="ou-pill"><i className={`ou-dot ${lim?.gmailConnected ? 'on' : ''}`} />{lim ? (lim.gmailConnected ? 'Gmail connected' : <a href="/settings/email">Connect Gmail</a>) : '…'}</span>
          <span className="ou-pill"><b>{n}</b> ready{n > 0 && <em>· ≈{minutes} min</em>}</span>
          <span className="ou-pill"><b>{lim?.sentLast24h ?? 0}</b>/{lim?.dailyLimit ?? 50} today<span className="ou-mini"><i style={{ width: `${used}%` }} /></span></span>
          <span className={`ou-pill ${lim?.mailMode === 'gmail' ? '' : 'warn'}`}>{lim?.mailMode === 'gmail' ? 'Live sending' : 'Test mode'}</span>
        </div>
      </header>

      {err && <div className="msg err" role="alert">{err}</div>}{ok && <div className="msg ok" role="status">{ok}</div>}

      <div className="ou-cols">
        {/* ---------- column A: recipients ---------- */}
        <section className="card ou-c">
          <div className="ou-h"><span className="ou-n">1</span><h2>Who to email</h2><span className="sp" />{n > 0 && <Pill tone="ok">{n} ready</Pill>}</div>

          <div className={`ou-drop ${drag ? 'drag' : ''} ${busy === 'img' ? 'busy' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith('image/')) readImage(f); }}>
            <input ref={imgIn} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) readImage(f); e.target.value = ''; }} />
            {shot ? <img src={shot} alt="Your screenshot" /> : <span className="ou-drop-ic"><Icon name="file" size={18} /></span>}
            <div className="ou-drop-t">
              {busy === 'img' ? <><b>AI is reading your image…</b><small>Finding every email address · {secs}s</small></> : <><b>Paste a screenshot of HR emails</b><small>Press <kbd>Ctrl</kbd>+<kbd>V</kbd>, drop an image, or <button type="button" onClick={() => imgIn.current?.click()}>choose a file</button></small></>}
            </div>
            {busy === 'img' && <span className="ou-scan" />}
          </div>

          {found && found.valid.length > 0 && (
            <div className="ou-found">
              <div className="ou-found-h"><b>AI found {found.valid.length} email{found.valid.length > 1 ? 's' : ''}</b><span className="sp" />
                <button type="button" onClick={() => setPick(new Set(found.valid.map((v) => v.email)))}>All</button><button type="button" onClick={() => setPick(new Set())}>None</button></div>
              <div className="ou-found-l">{found.valid.map((v, i) => {
                const on = pick.has(v.email), was = found.alreadyContacted.includes(v.email);
                return <label key={v.email} className={on ? 'on' : ''} style={{ animationDelay: `${Math.min(i, 20) * 40}ms` }}><input type="checkbox" checked={on} onChange={() => setPick((s) => { const x = new Set(s); on ? x.delete(v.email) : x.add(v.email); return x; })} /><span>{v.name ? `${v.name} · ` : ''}{v.email}</span>{was && <em>emailed</em>}</label>;
              })}</div>
              <div className="ou-found-f"><span className="faint">Check each address before adding. AI can misread blurry text.</span><button type="button" className="btn sm primary" onClick={addPicked} disabled={pick.size === 0}>Add {pick.size} selected</button></div>
            </div>
          )}

          <textarea className="ou-ta" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE} aria-label="HR email addresses" />
          <div className="ou-row">
            <input ref={file} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" className="btn sm" onClick={() => file.current?.click()}><Icon name="file" size={12} />CSV / TXT</button>
            <button type="button" className="btn sm" onClick={() => setText(SAMPLE)}>Example</button>
            {text && <button type="button" className="btn sm" onClick={() => setText('')}>Clear</button>}
          </div>
          {parsed ? (
            <div className="ou-parse">
              <div className="ou-row">
                <Pill tone="ok">{parsed.valid.length} valid</Pill>
                {parsed.duplicates > 0 && <Pill tone="gray">{parsed.duplicates} duplicate</Pill>}
                {parsed.invalid.length > 0 && <Pill tone="bad">{parsed.invalid.length} skipped</Pill>}
                {parsed.truncated > 0 && <Pill tone="warn">{parsed.truncated} over limit</Pill>}
                {parsed.alreadyContacted.length > 0 && <Pill tone="warn">{parsed.alreadyContacted.length} emailed lately</Pill>}
              </div>
              <div className="ou-chips">{parsed.valid.slice(0, 60).map((v) => <span key={v.email} title={v.company ?? ''}>{v.email}</span>)}{parsed.valid.length > 60 && <span>+{parsed.valid.length - 60}</span>}</div>
              {parsed.invalid.length > 0 && <ul className="ou-bad">{parsed.invalid.slice(0, 3).map((i, k) => <li key={k}><code>{i.line}</code> {i.reason}</li>)}</ul>}
            </div>
          ) : <p className="faint ou-hint">One per line: <code>hr@acme.com</code>, <code>Name &lt;hr@acme.com&gt;</code> or CSV <code>email, name, company</code>. Up to 100.</p>}
        </section>

        {/* ---------- column B: compose ---------- */}
        <section className="card ou-c ou-compose">
          <div className="ou-h"><span className="ou-n">2</span><h2>Write the email</h2><span className="sp" />{cur && <span className="faint ou-att"><Icon name="file" size={11} />{cur.fileName}</span>}</div>
          <div className="ou-ai">
            <div className="ou-ai-row">
              <span className="ou-ai-ic"><Icon name="spark" size={15} /></span>
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role you want, e.g. Full Stack Developer" maxLength={120} aria-label="Role you want" />
              <button type="button" className="ou-ai-go" onClick={draft} disabled={!!busy}><Icon name="spark" size={14} />{busy === 'draft' ? 'Writing…' : body.trim() ? 'Rewrite with AI' : 'Write with AI'}</button>
            </div>
            <div className="ou-ai-chips" role="group" aria-label="Enhance the text">
              <span>Enhance</span>
              {AI_ACTIONS.map(([k, label]) => <button key={k} type="button" onClick={() => enhance(k)} disabled={!!busy || body.trim().length < 20}>{busy === 'ai:' + k ? '…' : label}</button>)}
              {undo !== null && <button type="button" className="ou-undo" onClick={() => { setBody(undo); setUndo(null); setAiNote(''); }}>↶ Undo</button>}
            </div>
            {aiNote && <div className="ou-ai-note">{aiNote}</div>}
          </div>
          <label className="f ou-f">Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} placeholder="Full Stack Developer — Your Name" /></label>
          <div className="f ou-f">
            <div className="ou-lab"><span>Message</span><span className="faint">{words} words</span></div>
            <textarea ref={bodyRef} className="ou-ta" rows={11} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} aria-label="Message" placeholder={'Hello {{name}},\n\nI am writing to ask whether {{company}} has openings for…\n\nTip: press “Write with AI” to draft this from your resume.'} />
            <div className="ou-tags"><span>Insert</span>{['{{name}}', '{{first_name}}', '{{company}}'].map((t) => <button key={t} type="button" onClick={() => insertTag(t)}>{t}</button>)}<small className="faint">Signature is added automatically.</small></div>
          </div>
        </section>

        {/* ---------- column C: settings + live ---------- */}
        <div className="ou-side">
          <section className="card ou-c">
            <div className="ou-h"><span className="ou-n">3</span><h2>Send settings</h2></div>
            <label className="f ou-f">Campaign name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Node.js jobs, November" maxLength={120} /></label>
            <label className="f ou-f">Resume to attach
              <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>{resumes.length === 0 && <option value="">Upload a resume PDF first</option>}{resumes.map((r) => <option key={r._id} value={r._id}>{r.title} · {r.fileName}</option>)}</select>
              {resumes.length === 0 && <span className="faint">Add a PDF in <a href="/resumes" style={{ color: 'var(--primary-600)' }}>Resume Studio</a>.</span>}
            </label>
            <div className="ou-two">
              <label className="f ou-f">Gap<select value={gap} onChange={(e) => setGap(Number(e.target.value))}>{[10, 15, 20, 30, 45, 60, 90, 120, 180].map((s) => <option key={s} value={s}>{s >= 60 ? `${s / 60} min` : `${s} sec`}</option>)}</select></label>
              <label className="ou-check"><input type="checkbox" checked={extra} onChange={(e) => setExtra(e.target.checked)} /><span>Extra files</span></label>
            </div>
            {gap < 30 && <div className="faint ou-warn">Very fast sending can look like spam to Gmail. For many emails, 30 sec or more is safer.</div>}
          </section>

          <section className="card ou-c ou-live" ref={liveRef as any}>
            <div className="ou-h"><h2>Live sending</h2><span className="sp" />{live && <Pill tone={TONES[live.status] ?? ''}>{live.status}</Pill>}</div>
            {!live ? (
              <div className="ou-idle"><div className="ou-stage idle"><span className="ou-doc"><i /><i /><i /></span><span className="ou-track" /><span className="ou-env"><Icon name="send" size={14} /></span></div><small>Start a campaign and watch each email fly out here.</small></div>
            ) : (
              <>
                <div className={`ou-stage ${sending ? 'go' : ''}`}>
                  <span className="ou-doc" title="Resume attached"><i /><i /><i /><b>PDF</b></span>
                  <span className="ou-track"><span className="ou-fly"><Icon name="send" size={13} /></span></span>
                  <span className="ou-to">{sending && nowRec ? <><small>Sending to</small><b>{nowRec.name || nowRec.email}</b></> : live.status === 'done' ? <><small>Finished</small><b>{sentN} sent</b></> : <><small>{live.status}</small><b>—</b></>}</span>
                </div>
                <div className="ou-meter"><div className="ou-ring" style={{ ['--p' as any]: pct }}><b>{pct}%</b></div>
                  <div className="ou-num"><span><b className="g">{sentN}</b> sent</span><span><b>{total - sentN - failN - skipN}</b> waiting</span>{failN > 0 && <span><b className="r">{failN}</b> failed</span>}{skipN > 0 && <span><b>{skipN}</b> skipped</span>}</div></div>
                <div className="ou-names"><b>{live.name}</b>{sending && live.nextAt ? <small>next at {new Date(live.nextAt).toLocaleTimeString()}</small> : null}</div>
                {live.note && <div className="msg warn" style={{ margin: 0 }}>{live.note}</div>}
                <div className="ou-feed">{recs.map((r) => (
                  <div key={r.email} className={`ou-r ${r.status}`}>
                    <span className="ou-st">{r.status === 'sent' ? <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : r.status === 'failed' ? '!' : r.status === 'sending' ? <i className="ou-spin" /> : r.status === 'skipped' ? '–' : ''}</span>
                    <span className="ou-em">{r.name ? <b>{r.name}</b> : null}{r.email}</span>
                    <small>{r.status === 'sent' ? 'sent ✓' : r.status === 'sending' ? 'sending…' : r.status === 'failed' ? (r.error ?? 'failed') : r.status}</small>
                  </div>))}</div>
                <div className="ou-row">
                  {live.status === 'running' && <button className="btn sm" onClick={() => act(live.id, 'pause')}><Icon name="pause" size={12} />Pause</button>}
                  {(live.status === 'paused' || live.status === 'draft') && <button className="btn sm primary" onClick={() => act(live.id, 'start')}><Icon name="send" size={12} />{live.status === 'draft' ? 'Start' : 'Resume'}</button>}
                  {failN > 0 && <button className="btn sm" onClick={() => act(live.id, 'retry')}>Retry failed</button>}
                  {['running', 'paused', 'draft'].includes(live.status) && <button className="btn sm" onClick={() => act(live.id, 'cancel')}>Cancel</button>}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <div className="ou-bottom card">
        <ul className="ou-checks">{checks.map((c) => <li key={c.t} className={c.ok ? 'ok' : ''}><i>{c.ok ? '✓' : ''}</i>{c.t}</li>)}</ul>
        <span className="sp" />
        <button type="button" className="btn sm" onClick={preview} disabled={!body.trim() || !!busy}><Icon name="search" size={13} />{busy === 'prev' ? 'Building…' : 'Preview'}</button>
        <button type="button" className="btn sm" onClick={() => create(false)} disabled={!ready || !!busy}>Save draft</button>
        <button type="button" className="btn primary ou-start" onClick={() => create(true)} disabled={!ready || !!busy}><Icon name="send" size={14} />{busy === 'start' ? 'Starting…' : `Start sending${n ? ` to ${n}` : ''}`}</button>
      </div>

      {camps.length > 0 && (
        <section className="card ou-c">
          <div className="ou-h"><h2>Campaigns</h2><span className="sp" /><small className="faint">{camps.length} total</small></div>
          <div className="ou-clist">{camps.map((c) => {
            const d = c.counts.sent + c.counts.failed + c.counts.skipped; const p = c.total ? Math.round((d / c.total) * 100) : 0;
            return (
              <button key={c.id} type="button" className={`ou-cm ${liveId === c.id ? 'on' : ''}`} onClick={() => { setLiveId(c.id); liveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                <span className="ou-cm-t"><b>{c.name}</b><Pill tone={TONES[c.status] ?? ''}>{c.status}</Pill></span>
                <span className="ou-prog"><i style={{ width: `${p}%` }} /></span>
                <small>{c.counts.sent}/{c.total} sent{c.counts.failed ? ` · ${c.counts.failed} failed` : ''}</small>
              </button>);
          })}</div>
        </section>
      )}

      {prev && (
        <div className="ou-modal" role="dialog" aria-modal="true" aria-label="Email preview" onClick={() => setPrev(null)}>
          <div className="ou-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="ou-sub"><span><b>Subject:</b> {prev.subject}</span><button className="btn sm" onClick={() => setPrev(null)}>Close</button></div>
            <iframe title="Email preview" sandbox="" srcDoc={prev.html} />
          </div>
        </div>
      )}
    </div>
  );
}
