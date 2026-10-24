'use client';
import dynamic from 'next/dynamic';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Component, ReactNode, useEffect, useRef, useState } from 'react';
import { cosmos } from '@/lib/cosmos';

const CareerUniverse = dynamic(() => import('./CareerUniverse'), { ssr: false });

class Boundary extends Component<{ onFail: () => void; children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.bad ? null : this.props.children; }
}
const hasWebGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

/**
 * Wraps the page. Owns the fixed 3D canvas, turns scroll position into camera progress (cosmos.zf),
 * and runs the GSAP ScrollTrigger reveals. Falls back to a static space backdrop when motion is reduced or WebGL is missing.
 */
export function ScrollExperience({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null); const stage = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'pending' | '3d' | 'static'>('pending');
  const [ready, setReady] = useState(false); const [tabOn, setTabOn] = useState(true); const [lite, setLite] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const decide = () => setMode(!mq.matches && hasWebGL() ? '3d' : 'static');
    decide(); setLite(window.innerWidth < 760 || (navigator.hardwareConcurrency ?? 8) <= 4);
    mq.addEventListener('change', decide); return () => mq.removeEventListener('change', decide);
  }, []);
  useEffect(() => { const f = () => setTabOn(!document.hidden); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
  useEffect(() => {
    if (mode !== '3d') return;
    const move = (e: PointerEvent) => { cosmos.mx = (e.clientX / window.innerWidth - 0.5) * 2; cosmos.my = -(e.clientY / window.innerHeight - 0.5) * 2; };
    window.addEventListener('pointermove', move, { passive: true }); return () => window.removeEventListener('pointermove', move);
  }, [mode]);

  // Scroll → camera progress, plus section reveals. Everything is created inside one gsap context and reverted on cleanup.
  useEffect(() => {
    const el = root.current; if (mode !== '3d' || !el) return;
    gsap.registerPlugin(ScrollTrigger);
    const secs = Array.from(el.querySelectorAll<HTMLElement>('[data-zone]')); let tops: number[] = [];
    const measure = () => { tops = secs.map((s) => s.getBoundingClientRect().top + window.scrollY); };
    const update = () => {
      const y = window.scrollY; let k = 0; for (let i = 0; i < tops.length; i++) if (y >= tops[i] - 1) k = i;
      const next = tops[k + 1]; cosmos.zf = next === undefined ? k : k + Math.min(1, Math.max(0, (y - tops[k]) / (next - tops[k])));
    };
    measure(); update();
    const ctx = gsap.context(() => {
      ScrollTrigger.create({ start: 0, end: 'max', onUpdate: update, onRefresh: () => { measure(); update(); } });
      secs.forEach((s, i) => {
        const c = s.querySelector<HTMLElement>('.nx-sc-in'); if (!c) return;
        if (i > 0) gsap.fromTo(c, { autoAlpha: 0, y: 70, filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', ease: 'none', scrollTrigger: { trigger: s, start: 'top 82%', end: 'top 38%', scrub: true } });
        if (i < secs.length - 1) gsap.fromTo(c, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -70, ease: 'none', immediateRender: false, scrollTrigger: { trigger: s, start: 'bottom 62%', end: 'bottom 22%', scrub: true } });
        const items = c.querySelectorAll('.nx-stag > *'); if (items.length) gsap.from(items, { y: 28, opacity: 0, stagger: 0.08, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 60%', toggleActions: 'play none none reverse' } });
      });
      if (stage.current && el.querySelector('.nx-after')) gsap.to(stage.current, { opacity: 0.22, ease: 'none', scrollTrigger: { trigger: el.querySelector('.nx-after'), start: 'top 90%', end: 'top 30%', scrub: true } });
      gsap.utils.toArray<HTMLElement>('[data-reveal]', el).forEach((n, i) => gsap.fromTo(n, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: (i % 3) * 0.05, ease: 'power3.out', scrollTrigger: { trigger: n, start: 'top 90%', once: true } }));
      gsap.utils.toArray<HTMLElement>('[data-parallax]', el).forEach((n) => gsap.to(n, { yPercent: Number(n.dataset.parallax) || -8, ease: 'none', scrollTrigger: { trigger: n, scrub: true } }));
    }, el);
    const re = () => ScrollTrigger.refresh(); window.addEventListener('load', re);
    return () => { window.removeEventListener('load', re); ctx.revert(); ScrollTrigger.getAll().forEach((t) => t.kill()); cosmos.zf = 0; };
  }, [mode]);

  const show3d = mode === '3d';
  return (
    <div ref={root} className={`nx-xp ${show3d ? 'is3d' : ''}`}>
      <div ref={stage} className="nx-stage-fixed" aria-hidden="true">
        {show3d && <div className={`nx-canvas ${ready ? 'on' : ''}`}><Boundary onFail={() => setMode('static')}><CareerUniverse active={tabOn} lite={lite} onReady={() => setReady(true)} onFail={() => setMode('static')} /></Boundary></div>}
        {!(show3d && ready) && <div className="nx-space" />}
      </div>
      {show3d && !ready && <div className="nx-loader" role="status"><div className="nx-ring" /><span>Entering the universe…</span></div>}
      {children}
    </div>
  );
}
