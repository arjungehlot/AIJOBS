'use client';
import dynamic from 'next/dynamic';
import { Component, ReactNode, useEffect, useRef, useState } from 'react';

// three.js is loaded only in the browser and only when the 3D scene will actually be shown.
const Scene = dynamic(() => import('./Scene'), { ssr: false });

class Boundary extends Component<{ onFail: () => void; children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.bad ? null : this.props.children; }
}

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

/** Decorative stage. Falls back to a static CSS orb for reduced motion, no WebGL, or any 3D error. */
export function HeroScene() {
  const box = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'pending' | '3d' | 'static'>('pending');
  const [ready, setReady] = useState(false); const [visible, setVisible] = useState(true); const [tabOn, setTabOn] = useState(true); const [lite, setLite] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const decide = () => setMode(!mq.matches && hasWebGL() ? '3d' : 'static');
    decide(); setLite(window.innerWidth < 720 || (navigator.hardwareConcurrency ?? 8) <= 4);
    mq.addEventListener('change', decide); return () => mq.removeEventListener('change', decide);
  }, []);
  useEffect(() => {
    const el = box.current; if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 }); io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => { const f = () => setTabOn(!document.hidden); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);

  const show3d = mode === '3d';
  return (
    <div ref={box} className="nx-stage" aria-hidden="true">
      {show3d && (
        <div className={`nx-canvas ${ready ? 'on' : ''}`}>
          <Boundary onFail={() => setMode('static')}><Scene active={visible && tabOn} lite={lite} onReady={() => setReady(true)} onFail={() => setMode('static')} /></Boundary>
        </div>
      )}
      {!(show3d && ready) && (
        <div className={`nx-orb ${mode === 'pending' || show3d ? 'loading' : ''}`}>
          <i /><i /><i />
          {show3d && <span className="nx-load">Loading 3D scene…</span>}
        </div>
      )}
    </div>
  );
}
