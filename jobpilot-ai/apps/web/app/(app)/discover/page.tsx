'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import { SearchProgress, Step, Thinking } from '@/components/progress';
import { api, errText } from '@/lib/api';

const REC: Record<string, { l: string; c: string }> = { apply: { l: 'Strong match', c: 'ok' }, consider: { l: 'Consider', c: 'warn' }, skip: { l: 'Weak match', c: 'gray' } };
const scoreColor = (n: number) => (n >= 75 ? 'var(--ok)' : n >= 55 ? '#F59E0B' : '#94A3B8');
const ago = (d?: string) => { if (!d) return ''; const n = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); return n < 1 ? 'today' : `${n}d ago`; };

export default function Discover() {
  const [profiles, setProfiles] = useState<any[]>([]); const [resumes, setResumes] = useState<any[]>([]); const [sources, setSources] = useState<any[]>([]);
  const [f, setF] = useState({ profileId: '', query: '', limit: 20, enrich: true }); const [on, setOn] = useState<Record<string, boolean>>({});
  const [res, setRes] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [ai, setAi] = useState<any>(null); const [mail, setMail] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null); // right-side panel
  const [min, setMin] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]); const [pct, setPct] = useState(0); const [t0, setT0] = useState(0); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []); // set true on mount too: React dev StrictMode runs cleanup once, which used to stop polling for good

  useEffect(() => {
    api<any[]>('/career-profiles').then((p) => { setProfiles(p); if (p[0]) setF((x) => ({ ...x, profileId: p[0]._id })); }).catch((e) => setErr(errText(e)));
    api<any[]>('/resumes').then(setResumes).catch(() => undefined);
    api<any[]>('/discovery/sources').then((s) => { setSources(s); setOn(Object.fromEntries(s.map((x) => [x.id, true]))); }).catch(() => undefined);
    api('/ai/settings').then(setAi).catch(() => undefined);
    api('/integrations/gmail/status').then(setMail).catch(() => undefined);
  }, []);

  async function search(e?: FormEvent) {
    e?.preventDefault(); setBusy(true); setErr(''); setOk(''); setRes(null); setSteps([]); setPct(0); setT0(Date.now());
    try {
      const sel = Object.keys(on).filter((k) => on[k]);
      const { id } = await api('/discovery/start', { body: { careerProfileId: f.profileId, query: f.query || undefined, sources: sel.length ? sel : undefined, limit: f.limit, enrich: f.enrich } });
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
      const resumeId = resumes.find((r) => r.fileName)?._id ?? resumes[0]?._id;
      const d = await api('/applications/ai-draft', { body: { jobId: it.jobId, careerProfileId: f.profileId, resumeId, tone: 'professional' } });
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
            <span className="jf-q"><Icon name="search" size={14} /><input placeholder="Optional · e.g. Node.js backend developer (defaults to your target titles)" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} /></span></label>
          <label className="az-f" style={{ flex: '0 0 84px' }}>Results<select value={f.limit} onChange={(e) => setF({ ...f, limit: Number(e.target.value) })}>{[10, 20, 30, 40].map((n) => <option key={n}>{n}</option>)}</select></label>
          <button className="btn primary jf-go" disabled={busy || !f.profileId}><Icon name="search" size={14} />{busy ? 'Searching…' : 'Find jobs'}</button>
        </div>
        <div className="jf-row" style={{ alignItems: 'center' }}>
          <span className="jf-lab">Sources</span>
          {sources.map((s) => <label key={s.id} className="pg-chk"><input type="checkbox" checked={!!on[s.id]} onChange={(e) => setOn({ ...on, [s.id]: e.target.checked })} /><span>{s.name}</span></label>)}
          <span style={{ flex: 1 }} />
          <label className="pg-chk" title={ai?.configured ? `Uses ${ai.model}` : 'Add GEMINI_API_KEY to enable'}>
            <input type="checkbox" disabled={!ai?.configured} checked={f.enrich && !!ai?.configured} onChange={(e) => setF({ ...f, enrich: e.target.checked })} /><span>✨ AI review of top results{ai?.configured && <em className="jf-model">{ai.model}</em>}</span>
          </label>
        </div>
      </form>

      {busy && <SearchProgress pct={pct} steps={steps} since={t0} title={f.enrich && ai?.configured ? `Gemini (${ai.model}) is finding and reviewing jobs` : 'Finding and scoring jobs'} />}

      {res && (
        <section className="card scroll">
          <div className="card-h">
            <h2>{items.length} openings</h2>
            <span className="faint">{res.scanned} scanned · {res.relevant} relevant · {res.items.filter((i: any) => i.isNew).length} new</span>
            <span style={{ flex: 1 }} />
            <label className="faint" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>Min score <select value={min} onChange={(e) => setMin(Number(e.target.value))} style={{ width: 100, minWidth: 100, height: 30, lineHeight: '20px', paddingBottom: 3 }}>{[0, 50, 60, 70, 80].map((n) => <option key={n} value={n}>{n || 'any'}</option>)}</select></label>
          </div>
          {res.sources.some((s: any) => !s.ok) && <div className="msg warn" style={{ marginBottom: 8 }}>Could not reach: {res.sources.filter((s: any) => !s.ok).map((s: any) => `${s.name} (${s.error})`).join(', ')}.</div>}
          {res.aiNote && <div className="msg warn" style={{ marginBottom: 8 }}>AI review stopped: {res.aiNote} Showing keyword-based scores for the rest.</div>}
          {items.length === 0 ? <div className="pg-empty"><div className="big">🔎</div><b>No openings matched</b><span>Try a broader search or add more skills to your profile.</span></div> : (
            <div className="jf-list">{items.map((it: any) => (
              <article key={it.jobId} className="jf-item">
                <div className="jf-score" title="Match score" style={{ ['--c' as any]: scoreColor(it.score) }}><b>{it.score}</b><small>match</small></div>
                <div className="jf-main">
                  <div className="jf-title"><b>{it.title}</b><span className={`pill ${REC[it.recommendation]?.c}`}>{REC[it.recommendation]?.l}</span>
                    {it.isNew && <span className="pill">new</span>}{it.aiReviewed && <span className="pill gray">✨ AI reviewed</span>}</div>
                  <div className="jf-meta"><b>{it.company}</b>{[it.workMode, it.location, it.source, ago(it.postedAt)].filter(Boolean).map((m: string) => <span key={m}>{m}</span>)}</div>
                  <div className="az-tags" style={{ marginTop: 5 }}>
                    {it.matched.slice(0, 6).map((s: string) => <span key={s} className="tag good">✓ {s}</span>)}
                    {it.missing.slice(0, 4).map((s: string) => <span key={s} className="tag bad">✕ {s}</span>)}
                  </div>
                </div>
                <div className="jf-act">
                  {it.applyMethod === 'email'
                    ? <button className="btn primary sm" onClick={() => writeEmail(it)}><Icon name="spark" size={12} />Write email &amp; apply</button>
                    : <button className="btn sm" onClick={() => writeEmail(it)}><Icon name="spark" size={12} />Write cover note</button>}
                  {it.applicationUrl && <a className="btn sm" href={it.applicationUrl} target="_blank" rel="noopener noreferrer">Open posting ↗</a>}
                  <small>{it.applyMethod === 'email' ? it.applicationEmail : 'Apply on their site'}</small>
                </div>
              </article>))}</div>)}
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
              <div className="faint">{draft.resumeAttached ? '📎 Your uploaded resume PDF will be attached.' : '⚠ No resume PDF on file: upload one in Resume Studio to attach it automatically.'}</div>
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
