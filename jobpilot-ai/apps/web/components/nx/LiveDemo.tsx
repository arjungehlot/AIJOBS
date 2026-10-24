'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

interface Result { title: string; company: string | null; seniority: string; skills: string[]; summary: string; tips: string[]; emailOpener: string }

const SAMPLE = `Senior Node.js Backend Engineer — Zeta Cloud (Sample posting)
Bengaluru or remote (India). 4+ years building APIs with Node.js, Express/NestJS and MongoDB. Experience with AWS, Docker and CI/CD.
You will design REST services, improve performance and mentor two junior developers. Nice to have: Kubernetes, GraphQL.
Send your resume and a short note to careers@example.com.`;

export function LiveDemo() {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [out, setOut] = useState<Result | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => { api<{ enabled: boolean }>('/demo/status').then((r) => setEnabled(r.enabled)).catch(() => setEnabled(false)); }, []);
  const tooShort = text.trim().length < 40;

  async function run() {
    setBusy(true); setErr(''); setOut(null);
    try { setOut(await api<Result>('/demo/analyze', { body: { text } })); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }

  return (
    <div className="nx-demo">
      <div className="nx-demo-in">
        <label htmlFor="nx-jd">Paste a job post</label>
        <textarea id="nx-jd" value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} placeholder="Paste the text of any job posting here…" rows={9} />
        <div className="nx-demo-row">
          <button type="button" className="nx-btn solid" onClick={run} disabled={busy || tooShort || enabled === false}>{busy ? 'Analyzing…' : 'Analyze with AI'}</button>
          <button type="button" className="nx-btn ghost" onClick={() => { setText(SAMPLE); setOut(null); setErr(''); }} disabled={busy}>Use a sample post</button>
          <span className="nx-count">{text.length}/4000</span>
        </div>
        {enabled === false && <p className="nx-note" role="status">The live demo is not switched on for this site yet. You can still try the full Job Analyzer after creating a free account.</p>}
        <p className="nx-fine">Your text is sent to our server and analysed by NVIDIA Nemotron. Please do not paste personal data. Limited to a few tries per visitor.</p>
      </div>
      <div className="nx-demo-out" aria-live="polite">
        {busy && <div className="nx-skel" aria-label="Analyzing"><i /><i /><i /><i /></div>}
        {err && !busy && <div className="nx-err" role="alert">{err}</div>}
        {!busy && !err && !out && <div className="nx-empty"><b>Your analysis appears here</b><span>Role, required skills, a tailoring plan and an honest email opener.</span></div>}
        {out && !busy && (
          <div className="nx-res">
            <h3>{out.title}</h3><p className="nx-sub2">{[out.company, out.seniority].filter(Boolean).join(' · ')}</p>
            {out.summary && <p>{out.summary}</p>}
            {out.skills.length > 0 && <div className="nx-chips">{out.skills.map((s) => <span key={s}>{s}</span>)}</div>}
            {out.tips.length > 0 && <><h4>How to tailor your application</h4><ul>{out.tips.map((t) => <li key={t}>{t}</li>)}</ul></>}
            {out.emailOpener && <><h4>Suggested email opener</h4><blockquote>{out.emailOpener}</blockquote></>}
            <Link href="/register" className="nx-btn solid sm">Match this against my resume — free</Link>
          </div>
        )}
      </div>
    </div>
  );
}
