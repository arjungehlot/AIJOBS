'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import { SearchProgress, Step, Thinking } from '@/components/progress';
import { api, errText } from '@/lib/api';
import { CountryPicker, CountryOpt } from '@/components/CountryPicker';

const REC: Record<string, { l: string; c: string }> = { apply: { l: 'Strong match', c: 'ok' }, consider: { l: 'Consider', c: 'warn' }, skip: { l: 'Weak match', c: 'gray' } };
const scoreColor = (n: number) => (n >= 75 ? 'var(--ok)' : n >= 55 ? '#F59E0B' : '#94A3B8');
const ago = (d?: string) => { if (!d) return ''; const n = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); return n < 1 ? 'today' : `${n}d ago`; };

export default function Discover() {
  const [profiles, setProfiles] = useState<any[]>([]); const [resumes, setResumes] = useState<any[]>([]); const [sources, setSources] = useState<any[]>([]);
  const [f, setF] = useState({ profileId: '', query: '', limit: 20, enrich: true, maxAge: 5 }); const [on, setOn] = useState<Record<string, boolean>>({});
  const [res, setRes] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [ai, setAi] = useState<any>(null); const [mail, setMail] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null); // right-side panel
  const [min, setMin] = useState(0);
  const [sel, setSel] = useState<Record<string, boolean>>({}); const [st, setSt] = useState<Record<string, any>>({}); const [sending, setSending] = useState(false);
  const [resumeId, setResumeId] = useState(''); const [upBusy, setUpBusy] = useState(false);
  const [defs, setDefs] = useState<any>({ signature: '', defaultResumeId: null, attachments: [] }); const [defsOpen, setDefsOpen] = useState(false); const [extraBusy, setExtraBusy] = useState(false);
  const [sig, setSig] = useState(''); const [sigOpen, setSigOpen] = useState(false); const [sigSaved, setSigSaved] = useState('');
  const [steps, setSteps] = useState<Step[]>([]); const [pct, setPct] = useState(0); const [t0, setT0] = useState(0); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []); // set true on mount too: React dev StrictMode runs cleanup once, which used to stop polling for good

  useEffect(() => {
    let dead = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // Initial data. The API may still be starting or reloading, so retry a few times before showing an error.
    async function load<T>(path: string, apply: (r: T) => void, tries = 4) {
      for (let i = 0; i < tries && !dead; i++) {
        try { apply(await api<T>(path)); return true; } catch { await sleep(1200 * (i + 1)); }
      }
      return false;
    }
    (async () => {
      const okP = await load<any[]>('/career-profiles', (p) => { setProfiles(p); if (p[0]) setF((x) => ({ ...x, profileId: p[0]._id })); });
      if (!okP && !dead) setErr('Could not reach the server. Is the API running? Reload the page once it is up.'); else setErr('');
    })();
    load<any[]>('/resumes', setResumes);
    load<any[]>('/discovery/sources', (s) => { setSources(s); setOn(Object.fromEntries(s.map((x: any) => [x.id, true]))); });
    load('/ai/settings', setAi);
    // Saved defaults come from the database, so they are the same after a refresh or on another device.
    load<any>('/ai/defaults', (r) => { setDefs(r); setSig(r.signature ?? ''); setSigSaved(r.signature ?? ''); if (r.defaultResumeId) setResumeId(r.defaultResumeId); setDefsOpen(!r.signature && !r.attachments?.length && !r.defaultResumeId); });
    load('/integrations/gmail/status', setMail);
    return () => { dead = true; };
  }, []);

  const [countries, setCountries] = useState<CountryOpt[]>([]); const [cc, setCc] = useState<string[]>([]); const [ww, setWw] = useState(true);
  useEffect(() => { api<CountryOpt[]>('/discovery/countries').then(setCountries).catch(() => setCountries([])); }, []);
  const [ext, setExt] = useState<{ id: string; name: string; url: string }[]>([]);
  const extQ = f.query || profiles.find((p) => p._id === f.profileId)?.targetTitles?.[0] || '';
  useEffect(() => {
    if (!extQ) { setExt([]); return; }
    const t = setTimeout(() => { api<any[]>(`/discovery/links?q=${encodeURIComponent(extQ)}&days=${f.maxAge}${cc.length ? `&loc=${encodeURIComponent(countries.find((c) => c.code === cc[0])?.name ?? '')}` : ''}`).then(setExt).catch(() => setExt([])); }, 300);
    return () => clearTimeout(t);
  }, [extQ, f.maxAge, cc, countries]);

  async function search(e?: FormEvent) {
    e?.preventDefault(); setBusy(true); setErr(''); setOk(''); setRes(null); setSel({}); setSt({}); setSteps([]); setPct(0); setT0(Date.now());
    try {
      const sel = Object.keys(on).filter((k) => on[k]);
      const { id } = await api('/discovery/start', { body: { careerProfileId: f.profileId, query: f.query || undefined, sources: sel.length ? sel : undefined, limit: f.limit, enrich: f.enrich, maxAgeDays: f.maxAge, countries: cc.length ? cc : undefined, includeWorldwide: ww } });
      let seen = 0;
      // The server reports each real step as it happens; we poll for new ones.
      let fails = 0;
      while (alive.current) {
        let st: any;
        try { st = await api(`/discovery/status/${id}?since=${seen}`); fails = 0; }
        catch (x) { if (++fails >= 4) throw x; await new Promise((r) => setTimeout(r, 900)); continue; } // tolerate a brief network hiccup

        if (st.steps.length) { seen = st.total; setSteps((a) => [...a, ...st.steps]); }
        setPct(st.pct);
        if (st.done) {
          if (st.error) setErr(st.error); else { await new Promise((r) => setTimeout(r, 500)); setRes(st.result); }
          break;
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    } catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  }

  async function writeEmail(it: any) {
    setErr(''); setOk(''); setDraft({ job: it, loading: true });
    try {
      const d = await api('/applications/ai-draft', { body: { jobId: it.jobId, careerProfileId: f.profileId, resumeId: resume?._id, tone: 'professional' } });
      setDraft({ job: it, ...d, to: d.recipient?.email ?? '', resumeId: d.resumeId, loading: false });
    } catch (x) { setDraft(null); setErr(errText(x)); }
  }
  async function save(send: boolean) {
    setBusy(true); setErr('');
    try {
      const app = await api('/applications/drafts', { body: { jobId: draft.job.jobId, careerProfileId: f.profileId, recipientEmail: draft.to, recipientConfidence: 'source_reported', subject: draft.subject, body: draft.body, matchScore: draft.score, resumeId: draft.resumeId ?? undefined } });
      if (send) {
        await api(`/applications/${app._id}/approve`, { body: {} });
        const r = await api(`/applications/${app._id}/send`, { body: {} });
        setOk(r.status === 'applied' ? `Sent to ${draft.to}${draft.resumeAttached ? ' with your resume attached' : ''}.` : (r.message ?? `Status: ${r.status}`));
      } else setOk('Draft saved. Review and send it from Applications.');
      setDraft(null);
    } catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  }

  const profile = profiles.find((p) => p._id === f.profileId);
  const resumeFiles = resumes.filter((r) => r.fileName);
  const resume = resumeFiles.find((r) => r._id === resumeId) ?? resumeFiles[0] ?? null;
  const sentLike = ['applied', 'hr_replied', 'interview', 'assessment', 'offer', 'accepted'];
  const appOf = (it: any) => st[it.jobId] ?? it.application ?? null;
  const canPick = (it: any) => it.applyMethod === 'email' && !sentLike.includes(appOf(it)?.status) && appOf(it)?.state !== 'sending';
  const picked = (res?.items ?? []).filter((it: any) => sel[it.jobId] && canPick(it));

  async function uploadResume(file: File, rewrite?: any) {
    setErr(''); setOk('');
    if (file.type !== 'application/pdf') { setErr('Attach a PDF file.'); return; }
    if (file.size > 4 * 1024 * 1024) { setErr('The PDF is larger than 4 MB.'); return; }
    setUpBusy(true);
    try {
      const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = () => rej(new Error('Could not read the file')); r.readAsDataURL(file); });
      const r = await api('/resumes/upload', { body: { title: file.name.replace(/\.[^.]+$/, ''), filename: file.name, mime: 'application/pdf', base64: b64 } });
      const list = await api<any[]>('/resumes'); setResumes(list); setResumeId(r._id); if (!defs.defaultResumeId) setDefaultResume(r._id);
      setOk(r.readable === false ? `${file.name} attached. Its text could not be read right now, so emails use your profile.` : `${file.name} uploaded and ready to attach.`);
      if (rewrite) { const d = await api('/applications/ai-draft', { body: { jobId: rewrite.jobId, careerProfileId: f.profileId, resumeId: r._id, tone: 'professional' } }); setDraft((cur: any) => cur && ({ ...cur, ...d, to: cur.to || (d.recipient?.email ?? ''), resumeId: d.resumeId, loading: false })); }
    } catch (x) { setErr(errText(x)); } finally { setUpBusy(false); }
  }
  const picker = (rewrite?: any) => (
    <span className="jf-att">
      <span aria-hidden>📎</span>
      {resumeFiles.length > 0 && <select aria-label="Resume to attach" value={resume?._id ?? ''} onChange={(e) => { setResumeId(e.target.value); if (rewrite) writeEmailWith(rewrite, e.target.value); }}>
        {resumeFiles.map((r) => <option key={r._id} value={r._id}>{r.fileName}</option>)}</select>}
      <label className="btn sm" style={{ cursor: 'pointer' }}>{upBusy ? 'Uploading…' : resumeFiles.length ? '⬆ Upload another' : '⬆ Upload PDF'}
        <input type="file" hidden accept="application/pdf" disabled={upBusy} onChange={(e) => { const fl = e.target.files?.[0]; if (fl) uploadResume(fl, rewrite); e.target.value = ''; }} /></label>
    </span>
  );
  async function writeEmailWith(it: any, rid: string) {
    setDraft((cur: any) => ({ ...cur, loading: true }));
    try {
      const d = await api('/applications/ai-draft', { body: { jobId: it.jobId, careerProfileId: f.profileId, resumeId: rid, tone: 'professional' } });
      setDraft((cur: any) => ({ ...cur, ...d, to: cur.to || (d.recipient?.email ?? ''), resumeId: d.resumeId, loading: false }));
    } catch (x) { setErr(errText(x)); setDraft((cur: any) => ({ ...cur, loading: false })); }
  }
  function selectSuitable() {
    const need = profile?.minMatchScore ?? 70; const next: Record<string, boolean> = {};
    for (const it of items) if (canPick(it) && it.score >= need) next[it.jobId] = true;
    setSel(next);
  }
  async function saveSig() {
    try { const r = await api('/ai/defaults', { method: 'PUT', body: { signature: sig } }); setDefs(r); setSigSaved(r.signature); setOk('Signature saved. It is added to every email.'); } catch (x) { setErr(errText(x)); }
  }
  async function setDefaultResume(id: string) {
    setResumeId(id);
    try { setDefs(await api('/ai/defaults', { method: 'PUT', body: { defaultResumeId: id || null } })); } catch (x) { setErr(errText(x)); }
  }
  const readB64 = (file: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = () => rej(new Error('Could not read the file')); r.readAsDataURL(file); });
  async function addExtra(file: File) {
    setErr(''); setOk(''); setExtraBusy(true);
    try { setDefs(await api('/ai/attachments', { body: { filename: file.name, mime: file.type, base64: await readB64(file) } })); setOk(`${file.name} will be attached to every email.`); } catch (x) { setErr(errText(x)); } finally { setExtraBusy(false); }
  }
  async function removeExtra(id: string) { try { setDefs(await api(`/ai/attachments/${id}`, { method: 'DELETE' })); } catch (x) { setErr(errText(x)); } }
  async function refreshStatus() {
    if (!res?.items?.length) return;
    try {
      const m = await api('/applications/status-by-jobs', { body: { jobIds: res.items.map((i: any) => i.jobId) } });
      setSt((cur) => { const n = { ...cur }; for (const [k, v] of Object.entries<any>(m)) n[k] = { ...v }; return n; });
      setOk('Status refreshed.');
    } catch (x) { setErr(errText(x)); }
  }
  const [add, setAdd] = useState<{ id: string; email: string; phone: string } | null>(null); const [addBusy, setAddBusy] = useState(false);
  async function saveContact(it: any) {
    if (!add) return; setAddBusy(true); setErr('');
    try {
      const r = await api('/discovery/contact', { body: { jobId: it.jobId, email: add.email.trim(), phone: add.phone.trim() } });
      setRes((cur: any) => cur && ({ ...cur, items: cur.items.map((x: any) => x.jobId === it.jobId ? { ...x, applicationEmail: r.applicationEmail, contactPhone: r.contactPhone, applyMethod: r.applyMethod } : x) }));
      setAdd(null); setOk(r.applicationEmail ? 'Contact saved. You can now send your resume from here.' : 'Contact saved.');
    } catch (x) { setErr(errText(x)); } finally { setAddBusy(false); }
  }
  const [meName, setMeName] = useState('');
  useEffect(() => { api('/auth/me').then((m: any) => setMeName(m?.name ?? '')).catch(() => undefined); }, []);
  /** Opens WhatsApp with the message typed in. WhatsApp itself needs one tap on Send; no web app can send it silently. */
  const waDigits = (ph: string) => { const d = ph.replace(/\D/g, ''); return d.length === 10 && /^[6-9]/.test(d) ? `91${d}` : d.length === 11 && d.startsWith('0') ? `91${d.slice(1)}` : d; };
  const waLink = (it: any, emailed = false) => {
    const msg = `Hello, I am ${meName || 'a candidate'}. I am interested in the ${it.title} role at ${it.company}.${emailed || it.applicationEmail ? ` I have ${emailed ? 'sent' : 'also written'} an email${it.applicationEmail ? ` to ${it.applicationEmail}` : ''} with my resume attached.` : ''} I would be glad to discuss it. Thank you.`;
    return `https://wa.me/${waDigits(it.contactPhone)}?text=${encodeURIComponent(msg)}`;
  };
  async function sendBoth(it: any) {
    if (!window.confirm(`Send your application email to ${it.applicationEmail} (resume attached) and open WhatsApp for ${it.contactPhone}?\n\nIn WhatsApp you press Send yourself.`)) return;
    const w = window.open('', '_blank'); // opened now, inside the click, so the browser does not block it
    setErr(''); setOk('');
    setSt((c) => ({ ...c, [it.jobId]: { state: 'sending', label: 'Writing email…' } }));
    try {
      const r = await api('/applications/quick-send', { body: { jobId: it.jobId, careerProfileId: f.profileId, resumeId: resume?._id } });
      setSt((c) => ({ ...c, [it.jobId]: { id: r.applicationId, status: r.status, error: r.ok ? null : r.message, sentAt: r.ok ? new Date().toISOString() : null, to: r.to } }));
      if (r.ok) { setOk(`Email sent to ${r.to ?? it.applicationEmail}. WhatsApp is open: press Send there.`); if (w) w.location.href = waLink(it, true); }
      else { w?.close(); setErr(r.message ?? 'The email was not sent, so WhatsApp was not opened.'); }
    } catch (x) { w?.close(); setSt((c) => ({ ...c, [it.jobId]: { status: 'send_failed', error: errText(x) } })); }
  }
  async function sendSelected() {
    if (!picked.length) return;
    if (!window.confirm(`Send ${picked.length} application${picked.length === 1 ? '' : 's'} from your Gmail${resume ? ` with ${resume.fileName} attached` : ''}?\n\nA personalised email is written for each company.`)) return;
    setSending(true); setErr(''); setOk('');
    let sent = 0;
    for (const it of picked) {
      setSt((c) => ({ ...c, [it.jobId]: { state: 'sending', label: 'Writing email…' } }));
      try {
        const r = await api('/applications/quick-send', { body: { jobId: it.jobId, careerProfileId: f.profileId, resumeId: resume?._id } });
        setSt((c) => ({ ...c, [it.jobId]: { id: r.applicationId, status: r.status, error: r.ok ? null : r.message, sentAt: r.ok ? new Date().toISOString() : null, to: r.to } }));
        if (r.ok) { sent++; setSel((c) => ({ ...c, [it.jobId]: false })); }
      } catch (x) { setSt((c) => ({ ...c, [it.jobId]: { status: 'send_failed', error: errText(x) } })); }
      await new Promise((r) => setTimeout(r, 900)); // gentle pacing between emails
    }
    setSending(false); setOk(`${sent} of ${picked.length} sent. Check the status on each row.`);
  }
  const badge = (it: any) => {
    const a = appOf(it); if (!a) return null;
    if (a.state === 'sending') return <span className="pill warn jf-spin">⏳ {a.label}</span>;
    const m: Record<string, [string, string]> = { applied: ['ok', '✓ Sent'], hr_replied: ['ok', '💬 Replied'], interview: ['ok', '🎤 Interview'], assessment: ['ok', '📝 Assessment'], offer: ['ok', '🏆 Offer'], accepted: ['ok', '🏆 Accepted'],
      send_failed: ['bad', '✕ Failed'], send_unknown: ['warn', '? Unconfirmed'], draft: ['gray', 'Draft saved'], awaiting_approval: ['gray', 'Draft saved'], approved: ['warn', 'Approved'], sending: ['warn', 'Sending…'], blocked: ['bad', '✕ Not sent'], rejected: ['bad', 'Rejected'], closed: ['gray', 'Closed'] };
    const [c, l] = m[a.status] ?? ['gray', a.status]; const when = a.sentAt && a.status === 'applied' ? ` · ${new Date(a.sentAt).toLocaleDateString()}` : '';
    return <span className={`pill ${c}`} title={a.error ?? ''}>{l}{when}</span>;
  };

  const items = (res?.items ?? []).filter((i: any) => i.score >= min);
  const live = mail?.mailMode === 'gmail' && mail?.connected;

  return (
    <>
      <div className="ph"><div><h1>Job Finder</h1><p>Live openings from public job boards, scored against your profile. AI writes the email; nothing is sent until you press Send.</p></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}{ok && <div className="msg ok">{ok}</div>}

      <form className="card jf-hero" onSubmit={search}>
        <div className="jf-row">
          <label className="az-f" style={{ flex: '1 1 190px' }}>Career profile<select value={f.profileId} onChange={(e) => setF({ ...f, profileId: e.target.value })}>{profiles.length === 0 && <option value="">Create a profile first</option>}{profiles.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></label>
          <label className="az-f" style={{ flex: '3 1 260px' }}>Search
            <span className="jf-q"><Icon name="search" size={14} /><input placeholder="Roles, separated by commas · e.g. Frontend developer, Full stack developer" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} /></span></label>
          <div className="az-f" style={{ flex: '0 0 150px' }}>Country<CountryPicker options={countries} value={cc} onChange={setCc} worldwide={ww} onWorldwide={setWw} /></div>
          <label className="az-f" style={{ flex: '0 0 118px' }}>Posted within<select value={f.maxAge} onChange={(e) => setF({ ...f, maxAge: Number(e.target.value) })}>{[1, 2, 3, 5, 7, 14].map((n) => <option key={n} value={n}>{n === 1 ? '24 hours' : `${n} days`}</option>)}</select></label>
          <label className="az-f" style={{ flex: '0 0 84px' }}>Results<select value={f.limit} onChange={(e) => setF({ ...f, limit: Number(e.target.value) })}>{[10, 20, 30, 40].map((n) => <option key={n}>{n}</option>)}</select></label>
          <button className="btn primary jf-go" disabled={busy || !f.profileId}><Icon name="search" size={14} />{busy ? 'Searching…' : 'Find jobs'}</button>
        </div>
        <div className="jf-row" style={{ alignItems: 'center' }}>
          <span className="jf-lab">Sources</span>
          {sources.map((s) => <label key={s.id} className="pg-chk"><input type="checkbox" checked={!!on[s.id]} onChange={(e) => setOn({ ...on, [s.id]: e.target.checked })} /><span>{s.name}</span></label>)}
          <span style={{ flex: 1 }} />
          <label className="pg-chk" title={ai?.configured ? `Uses ${ai.model}` : 'Add GEMINI_API_KEY to enable'}>
            <input type="checkbox" disabled={!ai?.configured} checked={f.enrich && !!ai?.configured} onChange={(e) => setF({ ...f, enrich: e.target.checked })} /><span title="Gemini suggests related job titles from your skills, searches them too, and rates the fit of the best openings">✨ AI search boost + review{ai?.configured && <em className="jf-model">{ai.model}</em>}</span>
          </label>
        </div>
        {ext.length > 0 && (
          <div className="jf-row jf-ext" style={{ alignItems: 'center' }}>
            <span className="jf-lab">Also search on</span>
            {ext.map((x) => <a key={x.id} className="jf-xl" href={x.url} target="_blank" rel="noopener noreferrer">{x.name} ↗</a>)}
            <span className="faint" style={{ fontSize: 11.5 }}>Opens a ready search for “{extQ}”. These sites have no public feed, so results can’t be imported here.</span>
          </div>)}
      </form>

      <section className="card jf-def">
        <button type="button" className="jf-sig-h" onClick={() => setDefsOpen(!defsOpen)} aria-expanded={defsOpen}>
          <span className="pg-h"><span className="ic" style={{ background: 'linear-gradient(135deg,#6366F1,#4338CA)' }}>⚙</span><b>Email defaults</b><small className="faint">Set once, used on every email</small></span>
          <span className="jf-sum">
            <span className={sigSaved ? 'ok' : ''}>{sigSaved ? '✓' : '○'} Signature</span>
            <span className={resume ? 'ok' : ''}>{resume ? '✓' : '○'} Resume{resume ? `: ${resume.fileName}` : ''}</span>
            {defs.attachments.length > 0 && <span className="ok">✓ +{defs.attachments.length} file{defs.attachments.length === 1 ? '' : 's'}</span>}
            <em>{defsOpen ? 'Hide ▴' : 'Edit ▾'}</em>
          </span>
        </button>
        {defsOpen && (
          <div className="jf-def-b">
            <div className="jf-def-col">
              <h4>Signature &amp; highlights</h4>
              <textarea value={sig} onChange={(e) => setSig(e.target.value)} placeholder={'Best regards,\nYour Name\nFull Stack Developer\nLinkedIn: https://…\nGitHub: https://…\n\nSome highlights of my profile:\n* …'} style={{ minHeight: 150 }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><button type="button" className="btn primary sm" disabled={sig === sigSaved} onClick={saveSig}>Save signature</button><span className="faint" style={{ fontSize: 11.5 }}>{sig !== sigSaved ? 'Unsaved changes' : sigSaved ? 'Saved' : 'Added after the AI-written text'}</span></div>
            </div>
            <div className="jf-def-col">
              <h4>Attachments</h4>
              <div className="jf-file prim">
                <span className="n">📄 <b>Resume</b> <small>(default)</small></span>
                {resumeFiles.length > 0 && <select aria-label="Default resume" value={resume?._id ?? ''} onChange={(e) => setDefaultResume(e.target.value)}>{resumeFiles.map((r) => <option key={r._id} value={r._id}>{r.fileName}</option>)}</select>}
                <label className="btn sm" style={{ cursor: 'pointer' }}>{upBusy ? 'Uploading…' : resumeFiles.length ? '⬆ Replace / add' : '⬆ Upload PDF'}
                  <input type="file" hidden accept="application/pdf" disabled={upBusy} onChange={(e) => { const fl = e.target.files?.[0]; if (fl) uploadResume(fl); e.target.value = ''; }} /></label>
              </div>
              {defs.attachments.map((a: any) => (
                <div key={a.id} className="jf-file"><span className="n">📎 {a.filename} <small>{Math.max(1, Math.round(a.size / 1024))} KB</small></span><button type="button" className="btn sm" aria-label={`Remove ${a.filename}`} onClick={() => removeExtra(a.id)}>✕ Remove</button></div>
              ))}
              {defs.attachments.length < 3 && (
                <label className="jf-add">{extraBusy ? 'Uploading…' : '＋ Add another file (cover letter, portfolio…)'}
                  <input type="file" hidden accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt" disabled={extraBusy} onChange={(e) => { const fl = e.target.files?.[0]; if (fl) addExtra(fl); e.target.value = ''; }} /></label>
              )}
              <div className="faint" style={{ fontSize: 11.5 }}>Everything listed here is attached automatically to every email you send. PDF, Word, image or text, up to 4 MB each.</div>
            </div>
          </div>)}
      </section>

      {busy && <SearchProgress pct={pct} steps={steps} since={t0} title={f.enrich && ai?.configured ? `Gemini (${ai.model}) is finding and reviewing jobs` : 'Finding and scoring jobs'} />}

      {res && (
        <section className="card scroll">
          <div className="card-h">
            <h2>{items.length} openings</h2>
            <span className="faint">{res.scanned} scanned · {res.relevant} relevant · {res.items.filter((i: any) => i.isNew).length} new{res.staleSkipped ? ` · ${res.staleSkipped} older than ${res.maxAgeDays} days hidden` : ''}{res.countrySkipped ? ` · ${res.countrySkipped} outside chosen countries` : ''}</span>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn sm" onClick={selectSuitable}>☑ Select suitable</button>
            <button type="button" className="btn sm" onClick={refreshStatus}>↻ Check status</button>
            <label className="faint" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>Min score <select value={min} onChange={(e) => setMin(Number(e.target.value))} style={{ width: 100, minWidth: 100, height: 30, lineHeight: '20px', paddingBottom: 3 }}>{[0, 50, 60, 70, 80].map((n) => <option key={n} value={n}>{n || 'any'}</option>)}</select></label>
          </div>
          {res.sources.some((s: any) => !s.ok) && <div className="msg warn" style={{ marginBottom: 8 }}>Could not reach: {res.sources.filter((s: any) => !s.ok).map((s: any) => `${s.name} (${s.error})`).join(', ')}.</div>}
          <div className="jc-src">
            <b>Searched</b>
            {res.sources.map((x: any) => <span key={x.id} className={x.ok ? (x.count ? 'ok' : '') : 'bad'} title={x.ok ? `${x.count} openings fetched` : x.error}>{x.name} <i>{x.ok ? x.count : '✕'}</i></span>)}
            {res.aiRanked > 0 && <span className="ai">✨ Gemini rated {res.aiRanked} openings</span>}
          </div>
          {res.aiRoles?.length > 0 && <div className="faint" style={{ marginBottom: 6 }}>✨ AI also searched related titles from your skills: {res.aiRoles.join(' · ')}</div>}
          {(res.aiRoleNote || res.rankNote) && <div className="faint" style={{ marginBottom: 6 }}>AI boost partly skipped: {res.aiRoleNote ?? res.rankNote}</div>}
          {res.roles?.length > 1 && <div className="faint" style={{ marginBottom: 6 }}>Searched {res.roles.length} roles separately: {res.roles.join(' · ')}</div>}
          {(res.hints ?? []).map((h: string) => <div key={h} className="msg info" style={{ marginBottom: 8 }}>💡 {h}</div>)}
          {res.aiNote && <div className="msg warn" style={{ marginBottom: 8 }}>AI review stopped: {res.aiNote} Showing keyword-based scores for the rest.</div>}
          {items.length === 0 ? <div className="pg-empty"><div className="big">🔎</div><b>No openings matched</b><span>Try a broader search or add more skills to your profile.</span></div> : (
            <div className="jc-list">
              {items.map((it: any) => {
                const a = appOf(it); const dom = it.applicationUrl ? (() => { try { return new URL(it.applicationUrl).hostname.replace(/^www\./, ''); } catch { return null; } })() : null;
                const applied = sentLike.includes(a?.status); const hasMail = !!it.applicationEmail; const hasPhone = !!it.contactPhone;
                const places: string[] = it.countriesList?.length ? it.countriesList : it.location ? [it.location] : [];
                const worldwide = places.length === 1 && /worldwide|anywhere/i.test(places[0]);
                return (
                <article key={it.jobId} className={`jc ${sel[it.jobId] && canPick(it) ? 'picked' : ''}`}>
                  <div className="jc-top">
                    <label className="jf-pick" title={canPick(it) ? 'Select to send' : hasMail ? 'Already handled' : 'Add an HR email below to send from here'}>
                      <input type="checkbox" disabled={!canPick(it) || sending} checked={!!sel[it.jobId] && canPick(it)} onChange={(e) => setSel({ ...sel, [it.jobId]: e.target.checked })} />
                    </label>
                    <div className="jc-logo" aria-hidden="true">{it.logoLetter ?? it.company?.[0] ?? '?'}</div>
                    <div className="jc-head">
                      <div className="jc-title"><b>{it.title}</b>{it.isNew && <span className="jf-new">New</span>}</div>
                      <div className="jc-co"><b>{it.company}</b><span>·</span><span>{it.source}</span>{ago(it.postedAt) && <><span>·</span><span>Posted {ago(it.postedAt)}</span></>}</div>
                    </div>
                    <div className="jc-score" title={`${REC[it.recommendation]?.l ?? ''} (match score)`} style={{ ['--c' as any]: scoreColor(it.score), ['--p' as any]: it.score }}><b>{it.score}</b><small>{REC[it.recommendation]?.l ?? ''}</small></div>
                  </div>

                  <div className="jc-chips">
                    {it.workMode && <span className="jc-c mode">🏠 {it.workMode === 'remote' ? 'Remote' : it.workMode === 'hybrid' ? 'Hybrid' : 'On-site'}</span>}
                    {worldwide ? <span className="jc-c loc">🌍 Worldwide</span> : places.slice(0, 5).map((pl) => <span key={pl} className={`jc-c loc ${/india/i.test(pl) ? 'in' : ''}`}>📍 {pl}</span>)}
                    {places.length > 5 && <span className="jc-c">+{places.length - 5} more</span>}
                    {(it.cities ?? []).map((c: string) => <span key={c} className="jc-c city" title="City mentioned in the posting">🏙 {c}</span>)}
                    {it.employmentType && <span className="jc-c">💼 {it.employmentType}</span>}
                    {it.salary?.max && <span className="jc-c pay">💰 {[it.salary.min, it.salary.max].filter(Boolean).map((n: number) => Number(n).toLocaleString()).join(' – ')} {it.salary.currency ?? ''}</span>}
                  </div>
                  <div className="jc-skills">
                    {it.matched.slice(0, 7).map((sk: string) => <span key={sk} className="ok">✓ {sk}</span>)}
                    {it.missing.slice(0, 4).map((sk: string) => <span key={sk} className="no">✕ {sk}</span>)}
                  </div>

                  {it.aiFit != null && <div className="jc-ai"><b>✨ AI fit {it.aiFit}%</b>{it.aiReason ? <span>{it.aiReason}</span> : null}</div>}

                  <div className="jc-foot">
                    <div className="jc-contact">
                      <div className={`jc-ct ${hasMail ? 'on' : ''}`}><span className="ic">✉</span>{hasMail ? <><a href={`mailto:${it.applicationEmail}`}>{it.applicationEmail}</a><button type="button" className="cp" title="Copy email" onClick={() => { navigator.clipboard?.writeText(it.applicationEmail); setOk(`Copied ${it.applicationEmail}`); }}>⧉</button></> : <em>No email in this posting</em>}</div>
                      <div className={`jc-ct ${hasPhone ? 'on' : ''}`}><span className="ic">📞</span>{hasPhone ? <a href={`tel:${it.contactPhone.replace(/[^+\d]/g, '')}`}>{it.contactPhone}</a> : <em>No phone in this posting</em>}</div>
                    </div>
                    <div className="jc-act">
                      {applied ? <button className="btn sm" disabled>✓ Applied</button>
                        : hasMail ? <><button className="btn sm primary" onClick={() => writeEmail(it)}>✉ Preview &amp; send</button>
                          {hasPhone && <button className="btn sm primary" disabled={sending} onClick={() => sendBoth(it)} title="Sends the email now and opens WhatsApp">✉ + 💬 Both</button>}</>
                        : <>{it.applicationUrl && <a className="btn sm primary" href={it.applicationUrl} target="_blank" rel="noopener noreferrer" title="This employer takes applications on the job board">Apply on {dom ?? 'site'} ↗</a>}
                          <button className="btn sm" onClick={() => writeEmail(it)} title="AI writes a cover note you can paste into the application">✎ Cover note</button></>}
                      {hasPhone && <a className="btn sm jf-wa" href={waLink(it)} target="_blank" rel="noopener noreferrer" title="Opens WhatsApp with a message ready to send">💬 WhatsApp</a>}
                      {!applied && <button type="button" className="btn sm" onClick={() => setAdd(add?.id === it.jobId ? null : { id: it.jobId, email: it.applicationEmail ?? '', phone: it.contactPhone ?? '' })}>{hasMail || hasPhone ? '✎ Edit contact' : '➕ Add HR contact'}</button>}
                      {it.applicationUrl && hasMail && <a className="btn sm" href={it.applicationUrl} target="_blank" rel="noopener noreferrer">Posting ↗</a>}
                    </div>
                  </div>

                  {!hasMail && !applied && <div className="jc-tip">💡 <b>No email is published for this job.</b> Apply on {dom ?? 'the site'}, or find the HR/recruiter email (company site, LinkedIn) and press <b>Add HR contact</b>: then you can send your resume and open WhatsApp from here.</div>}
                  {add?.id === it.jobId && (
                    <form className="jc-add" onSubmit={(e) => { e.preventDefault(); saveContact(it); }}>
                      <label>HR email<input type="email" value={add.email} placeholder="hr@company.com" onChange={(e) => setAdd({ ...add, email: e.target.value })} /></label>
                      <label>Phone / WhatsApp<input value={add.phone} placeholder="+91 98765 43210" onChange={(e) => setAdd({ ...add, phone: e.target.value })} /></label>
                      <button className="btn sm primary" disabled={addBusy}>{addBusy ? 'Saving…' : 'Save contact'}</button>
                      <button type="button" className="btn sm" onClick={() => setAdd(null)}>Cancel</button>
                    </form>
                  )}
                  {a?.error && <div className="jf-err">{a.error}</div>}
                </article>); })}
            </div>)}
          {picked.length > 0 || sending ? (
            <div className="jf-bar">
              <b>{picked.length} selected</b>
              {picker()}
              {defs.attachments.length > 0 && <span className="faint">+ {defs.attachments.map((a: any) => a.filename).join(', ')}</span>}
              {!live && <span className="pill warn" title="Set MAIL_PROVIDER=gmail and connect Gmail">Real sending is off</span>}
              <span style={{ flex: 1 }} />
              <button className="btn primary" disabled={sending || !picked.length || !resume} onClick={sendSelected}><Icon name="send" size={13} />{sending ? 'Sending…' : `Send ${picked.length} application${picked.length === 1 ? '' : 's'}`}</button>
            </div>) : null}
          <div className="faint" style={{ marginTop: 10 }}>Listings come from {sources.map((s, i) => <span key={s.id}>{i > 0 && ', '}<a href={s.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>{s.name}</a></span>)}. Apply links go to the original posting.</div>
        </section>)}

      {draft && (<>
        <div className="drawer-bg" onClick={() => setDraft(null)} aria-hidden="true" />
        <div className="drawer" role="dialog" aria-modal="true" aria-label="Application email">
          <div className="dh"><span className="av" style={{ background: 'var(--primary)', width: 28, height: 28, borderRadius: 99, display: 'grid', placeItems: 'center', color: '#fff' }} aria-hidden="true"><Icon name="spark" size={13} /></span>
            <h2>{draft.job.title} · {draft.job.company}</h2><button className="icon-btn" aria-label="Close" onClick={() => setDraft(null)}>✕</button></div>
          {draft.loading ? <div className="db"><Thinking label="Gemini is writing your email from your profile and resume" /></div> : (<>
            <div className="db">
              <div className="faint">Written by {draft.provider === 'gemini' ? 'Gemini' : 'the offline template'} from your own profile and resume. Check every line before sending.</div>
              {draft.recipient ? <label className="f">To<input type="email" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label> : <div className="msg warn">This posting has no email address. Copy the note below and apply on <a href={draft.applicationUrl ?? '#'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>the company site</a>.</div>}
              <label className="f">Subject<input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></label>
              <label className="f" style={{ flex: 1, minHeight: 0 }}>Message<textarea style={{ flex: 1 }} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
              <div className="jf-attbox">
                <div className="faint" style={{ marginBottom: 6 }}>{draft.resumeAttached ? 'Attachment that will be sent with this email:' : '⚠ No resume attached yet. Upload your PDF (the email is rewritten to mention it):'}</div>
                {picker(draft.job)}
              </div>
            </div>
            <div className="df">
              {draft.recipient ? (<>
                <button className="btn primary" disabled={busy || !draft.to || !live} title={live ? '' : 'Real sending needs Gmail connected and MAIL_PROVIDER=gmail'} onClick={() => save(true)}><Icon name="send" size={13} />{busy ? 'Sending…' : 'Send now'}</button>
                <button className="btn" disabled={busy || !draft.to} onClick={() => save(false)}>Save draft</button>
              </>) : <button className="btn primary" onClick={() => { navigator.clipboard?.writeText(`${draft.subject}\n\n${draft.body}`); setOk('Copied to clipboard.'); }}>Copy note</button>}
              <span className="faint" style={{ marginLeft: 'auto' }}>Score {draft.score}</span>
            </div>
          </>)}
        </div>
      </>)}
    </>
  );
}
