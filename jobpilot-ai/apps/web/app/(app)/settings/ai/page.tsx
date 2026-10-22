'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui';
import { api, errText } from '@/lib/api';

export default function AiSettings() {
  const [s, setS] = useState<any>(null); const [pick, setPick] = useState('');
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<any>(null); const [q, setQ] = useState('');
  const load = (refresh = false) => api(`/ai/settings${refresh ? '?refresh=1' : ''}`).then((r) => { setS(r); setPick(r.model ?? ''); }).catch((e) => setErr(errText(e)));
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true); setErr(''); setOk(''); setTest(null);
    try { const r = await api('/ai/settings', { method: 'PUT', body: { model: pick } }); setS(r); setOk(`Model set to ${r.model}.`); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  async function runTest() {
    setBusy(true); setErr(''); setOk(''); setTest(null);
    try { setTest(await api('/ai/test', { body: {} })); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  if (!s) return <div className="card muted">{err || 'Loading'}</div>;
  const models = (s.models as any[]).filter((m) => !q || `${m.id} ${m.label}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="ph"><div><h1>AI settings</h1><p>Choose which Gemini model powers job analysis, resume reading and application emails. The API key stays on the server and is never shown here.</p></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}{ok && <div className="msg ok">{ok}</div>}
      <section className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', borderColor: s.configured ? 'var(--ok)' : 'var(--warn)' }}>
        <span className="kpi-ic c-violet" style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center' }}><Icon name="spark" size={18} /></span>
        <div style={{ flex: '1 1 240px' }}>
          <b style={{ fontSize: 15 }}>{s.configured ? 'Gemini is connected' : 'AI is off'}</b>
          <div className="faint">{s.configured ? <>Active model: <b style={{ color: 'var(--ink)' }}>{s.model}</b> · server default: {s.defaultModel}</> : s.note}</div>
        </div>
        <button className="btn" disabled={busy || !s.configured} onClick={runTest}>{busy ? 'Testing…' : 'Test connection'}</button>
        <button className="btn" disabled={busy || !s.configured} onClick={() => load(true)} title="Ask Google which models this key can use">↻ Refresh models</button>
      </section>
      {test && <div className="msg ok">Works. {test.model} answered in {test.ms} ms.</div>}

      {s.configured && s.keys?.length > 1 && (
        <section className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>API keys</b><span className="faint">{s.keys.filter((k: any) => k.state === 'ready').length} of {s.keys.length} ready · switches to the next key automatically when one hits its limit</span>
          {s.keys.map((k: any) => (
            <span key={k.label} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: k.state === 'ready' ? '#10B981' : k.state === 'cooling' ? '#F59E0B' : '#EF4444', color: '#fff' }}>
              {k.label} …{k.tail} · {k.state === 'cooling' ? `resting ${Math.ceil((k.retryInSec ?? 0) / 60)}m` : k.state}
            </span>
          ))}
        </section>
      )}

      {s.configured && (
        <section className="card stack">
          <div className="card-h"><h2>Model</h2><input aria-label="Filter models" placeholder="Filter…" style={{ maxWidth: 200, height: 30 }} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 10 }}>
            {models.map((m) => (
              <button key={m.id} type="button" onClick={() => setPick(m.id)} aria-pressed={pick === m.id}
                style={{ textAlign: 'left', padding: 12, borderRadius: 12, cursor: 'pointer', font: 'inherit', border: `1.5px solid ${pick === m.id ? 'var(--primary)' : 'var(--line)'}`, background: pick === m.id ? 'var(--primary-50)' : '#fff', boxShadow: pick === m.id ? '0 4px 14px rgba(79,70,229,.14)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><b>{m.label}</b>{m.id === s.defaultModel && <span className="pill gray">default</span>}{pick === m.id && <span className="pill ok">selected</span>}</div>
                <div className="faint" style={{ marginTop: 2, fontFamily: 'ui-monospace,monospace', fontSize: 11 }}>{m.id}</div>
                {m.description && <div className="faint" style={{ marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.description}</div>}
              </button>))}
            {models.length === 0 && <div className="empty">No models match.</div>}
          </div>
          <div className="row" style={{ alignItems: 'center' }}>
            <button className="btn primary" disabled={busy || !pick || pick === s.model} onClick={save}>Save model</button>
            <span className="faint">Tip: Flash models are fast and cheap, good for daily use. Pro models read resumes and postings more carefully but are slower and hit free-tier limits sooner.</span>
          </div>
        </section>)}

      <section className="card stack">
        <h2>What the AI does here</h2>
        <ul className="faint" style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>Job Finder / Analyzer:</b> reads a posting and pulls out skills, experience, salary and the apply email.</li>
          <li><b>Resume upload:</b> reads your PDF into text so it can be scored. The original PDF is what gets attached to emails.</li>
          <li><b>Application emails:</b> written only from your profile and resume. It is told not to invent experience.</li>
          <li><b>Never:</b> sends anything on its own. Sending goes through your limits, approval and the send gate.</li>
        </ul>
        {!s.configured && <div className="msg warn">To switch AI on: add <code>GEMINI_API_KEY=your-key</code> to the server <code>.env</code> and restart the API.</div>}
      </section>
    </>
  );
}
