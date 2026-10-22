'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { Icon, Logo } from '@/components/ui';
import { api, token } from '@/lib/api';

const GROUPS = [
  { h: 'Workspace', items: [
    { label: 'Overview', href: '/dashboard', icon: 'dash' }, { label: 'Job Analyzer', href: '/analyzer', icon: 'scan' },
    { label: 'Applications', href: '/applications', icon: 'kanban' }, { label: 'Career Profiles', href: '/profiles', icon: 'user' } ] },
  { h: 'Outreach', items: [
    { label: 'Mailbox', href: '/mail', icon: 'mail' }, { label: 'Reply Inbox', href: '/inbox', icon: 'scan' }, { label: 'HR Contacts', href: '/contacts', icon: 'users' },
    { label: 'Follow-ups', href: '/followups', icon: 'bell' }, { label: 'Email Setup', href: '/settings/email', icon: 'send' }, { label: 'Resume Studio', href: '/resumes', icon: 'file' } ] },
  { h: 'Automation & insight', items: [
    { label: 'AI Agent', href: '/agent', icon: 'bot' }, { label: 'Analytics', href: '/analytics', icon: 'chart' }, { label: 'Interview Prep', href: '/prep', icon: 'book' } ] },
];
const ADMIN = { h: 'Super admin', items: [
  { label: 'Admin Overview', href: '/admin', icon: 'shield' }, { label: 'Users', href: '/admin/users', icon: 'users' },
  { label: 'Audit Log', href: '/admin/audit', icon: 'file' }, { label: 'System Health', href: '/admin/system', icon: 'target' } ] };
const ALL = [...GROUPS, ADMIN].flatMap((g) => g.items);
const TITLES: Record<string, string> = Object.fromEntries(ALL.map((i) => [i.href, i.label]));

function Palette({ onClose, go }: { onClose: () => void; go: (h: string) => void }) {
  const [q, setQ] = useState(''); const [i, setI] = useState(0);
  const acts = [...ALL.map((n) => ({ label: `Go to ${n.label}`, href: n.href })), { label: 'Analyze a new job', href: '/analyzer' }, { label: 'Add a reminder', href: '/followups' }, { label: 'Paste a recruiter reply', href: '/inbox' }];
  const res = acts.filter((a) => a.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div role="dialog" aria-modal="true" aria-label="Command palette" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', display: 'grid', placeItems: 'start center', paddingTop: '14vh', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 'min(520px, 92vw)', padding: 8, boxShadow: '0 20px 50px rgba(15,23,42,.25)' }}>
        <input autoFocus placeholder="Jump to…" value={q} aria-label="Search commands" onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowDown') { e.preventDefault(); setI((i + 1) % Math.max(res.length, 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setI((i - 1 + res.length) % Math.max(res.length, 1)); } if (e.key === 'Enter' && res[i]) go(res[i].href); }} />
        <div style={{ maxHeight: 300, overflow: 'auto', marginTop: 6 }}>
          {res.length === 0 ? <div className="empty">No match</div> : res.map((a, n) => (
            <button key={a.label} onClick={() => go(a.href)} onMouseEnter={() => setI(n)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, font: 'inherit', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: n === i ? 'var(--primary-50)' : 'transparent', color: 'var(--ink)' }}>{a.label}</button>))}
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [pal, setPal] = useState(false);
  const [me, setMe] = useState<{ name: string; email: string; plan: string; role?: string } | null>(null);
  useEffect(() => {
    if (!token.get()) { router.replace('/login'); return; }
    api('/auth/me').then(setMe).catch(() => undefined);
  }, [router]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal((v) => !v); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  if (!token.get() && typeof window !== 'undefined') return null;
  const initials = (me?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <Logo />
        {(me?.role === 'super_admin' ? [ADMIN, ...GROUPS] : GROUPS).map((g) => (
          <div key={g.h}>
            <div className="nav-h">{g.h}</div>
            {g.items.map((n) => {
              const on = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
              return <Link key={n.href} href={n.href} className={`nav ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined}><Icon name={n.icon} />{n.label}</Link>;
            })}
          </div>
        ))}
        <div className="side-foot">
          <div className="avatar" aria-hidden="true">{initials}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me?.name ?? ' '}</div>
            <div className="faint" style={{ textTransform: 'capitalize' }}>{me?.role === 'super_admin' ? 'Super admin' : `${me?.plan?.replace('_', ' ') ?? ''} plan`}</div>
          </div>
          <button className="btn sm" aria-label="Log out" title="Log out" onClick={() => { token.clear(); router.push('/login'); }}><Icon name="out" size={14} /></button>
        </div>
      </nav>
      <div className="content">
        <header className="topbar">
          <b>{TITLES[path] ?? ''}</b>
          <span className="sp" />
          <button className="btn sm" onClick={() => setPal(true)} aria-label="Open command palette"><Icon name="search" size={13} />Search <span className="faint">Ctrl K</span></button>
          <Link href="/profiles" className="btn sm"><Icon name="user" size={13} />Profiles</Link>
          <Link href="/analyzer" className="btn primary sm"><Icon name="plus" size={13} />Analyze a job</Link>
        </header>
        <main className="main">{children}</main>
      </div>
      {pal && <Palette onClose={() => setPal(false)} go={(h) => { setPal(false); router.push(h); }} />}
    </div>
  );
}
