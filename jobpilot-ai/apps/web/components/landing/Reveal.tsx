'use client';
import { ReactNode, useEffect, useRef, useState } from 'react';

/** Adds the class `in` once the block scrolls into view, so its demo animation plays when someone can see it. */
export function Reveal({ children, className = '', as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const T = Tag as any;
  return <T ref={ref} className={`${className} ${seen ? 'in' : ''}`}>{children}</T>;
}
