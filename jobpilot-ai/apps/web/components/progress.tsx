'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui';

export interface Step { at: number; pct: number; text: string }
const STAGES = [{ k: 'Search', to: 30 }, { k: 'Filter', to: 44 }, { k: 'Score', to: 52 }, { k: 'AI review', to: 96 }, { k: 'Rank', to: 101 }];

/** The orb: pulsing rings around a spinning sparkle. Pure CSS animation. */
export function Orb({ size = 64 }: { size?: number }) {
  return (
    <span className="orb" style={{ width: size, height: size }} aria-hidden="true">
      <i /><i /><i />
      <span className="orb-core"><Icon name="spark" size={Math.round(size * 0.36)} /></span>
    </span>
  );
}

/** Live view of a running search. Every line is a real step reported by the server as it happens. */
export function SearchProgress({ pct, steps, title, since }: { pct: number; steps: Step[]; title: string; since: number }) {
  const [now, setNow] = useState(Date.now());
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t); }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [steps.length]);
  const secs = ((now - since) / 1000).toFixed(1);
  const cur = steps[steps.length - 1]?.text ?? 'Starting…';
  const stage = STAGES.findIndex((s) => pct < s.to);

  return (
    <section className="prog card" role="status" aria-live="polite">
      <div className="prog-top">
        <Orb />
        <div className="prog-head">
          <div className="prog-title">{title}</div>
          <div className="prog-now" key={cur}>{cur}<span className="caret" aria-hidden="true" /></div>
        </div>
        <div className="prog-time" aria-label="Elapsed time">{secs}<small>s</small></div>
      </div>
      <div className="prog-stages" aria-hidden="true">
        {STAGES.map((s, i) => <span key={s.k} className={i < stage || pct >= 100 ? 'done' : i === stage ? 'on' : ''}>{i < stage ? '✓' : ''} {s.k}</span>)}
      </div>
      <div className="prog-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${Math.max(4, pct)}%` }} /><b>{Math.round(pct)}%</b></div>
      <div className="prog-log">
        {steps.slice(-7).map((s, i, a) => (
          <div key={s.at + s.text} className={`prog-line ${i === a.length - 1 ? 'last' : ''}`}>
            <span className="tick">{i === a.length - 1 ? <span className="spin" /> : '✓'}</span>
            <span className="txt">{s.text}</span><span className="at">{(s.at / 1000).toFixed(1)}s</span>
          </div>))}
        <div ref={end} />
      </div>
    </section>
  );
}

/** Skeleton shown while the AI writes something (an email). */
export function Thinking({ label }: { label: string }) {
  return (
    <div className="think" role="status" aria-live="polite">
      <Orb size={52} />
      <div className="think-t">{label}<span className="dots" aria-hidden="true"><i /><i /><i /></span></div>
      <div className="think-lines" aria-hidden="true"><span style={{ width: '92%' }} /><span style={{ width: '78%' }} /><span style={{ width: '86%' }} /><span style={{ width: '60%' }} /><span style={{ width: '40%' }} /></div>
    </div>
  );
}
