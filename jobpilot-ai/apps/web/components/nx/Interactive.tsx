'use client';
import gsap from 'gsap';
import { ReactNode, useEffect, useRef } from 'react';

/** Wraps a button/link so it leans toward the pointer. Disabled for coarse pointers and reduced motion. */
export function Magnetic({ children, strength = 0.35 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return;
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.5)' }); const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.5)' });
    const move = (e: PointerEvent) => { const r = el.getBoundingClientRect(); x((e.clientX - (r.left + r.width / 2)) * strength); y((e.clientY - (r.top + r.height / 2)) * strength); };
    const leave = () => { x(0); y(0); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); gsap.killTweensOf(el); };
  }, [strength]);
  return <span ref={ref} className="nx-mag">{children}</span>;
}

/** 3D tilt on hover (CSS perspective), with a moving highlight. */
export function Tilt({ children, className = '', max = 8 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return;
    const move = (e: PointerEvent) => { const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - 0.5; const py = (e.clientY - r.top) / r.height - 0.5; el.style.transform = `perspective(1100px) rotateY(${px * max}deg) rotateX(${-py * max}deg)`; el.style.setProperty('--hx', `${(px + 0.5) * 100}%`); el.style.setProperty('--hy', `${(py + 0.5) * 100}%`); };
    const leave = () => { el.style.transform = ''; };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, [max]);
  return <div ref={ref} className={`nx-tilt ${className}`}>{children}</div>;
}
