'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui';

const LINKS: [string, string][] = [['Match', '#match'], ['Resume', '#resume'], ['How it works', '#journey'], ['Live demo', '#demo'], ['FAQ', '#faq']];

export function Nav() {
  const [open, setOpen] = useState(false); const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 12); on(); window.addEventListener('scroll', on, { passive: true });
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false); window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('keydown', esc); };
  }, []);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [open]);
  return (
    <header className={`nx-nav ${solid || open ? 'solid' : ''}`}>
      <div className="nx-nav-in">
        <Link href="/" className="nx-logo" aria-label="JobPilot AI home"><i><Icon name="send" size={15} /></i>JobPilot AI</Link>
        <nav className="nx-links" aria-label="Sections">{LINKS.map(([n, h]) => <a key={h} href={h}>{n}</a>)}</nav>
        <span className="nx-sp" />
        <Link href="/login" className="nx-btn ghost sm nx-hide-sm">Log in</Link>
        <Link href="/register" className="nx-btn solid sm nx-hide-sm">Start free</Link>
        <button type="button" className="nx-burger" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="nx-menu" onClick={() => setOpen(!open)}><span /><span /><span /></button>
      </div>
      {open && (
        <div id="nx-menu" className="nx-menu">
          {LINKS.map(([n, h]) => <a key={h} href={h} onClick={() => setOpen(false)}>{n}</a>)}
          <div className="nx-menu-cta"><Link href="/login" className="nx-btn ghost" onClick={() => setOpen(false)}>Log in</Link><Link href="/register" className="nx-btn solid" onClick={() => setOpen(false)}>Start free</Link></div>
        </div>
      )}
    </header>
  );
}
