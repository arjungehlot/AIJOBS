'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Icon, Logo } from '@/components/ui';
import { api, token } from '@/lib/api';

const GROUPS = [
  { h: 'Workspace', items: [
    { label: 'Overview', href: '/dashboard', icon: 'dash' }, { label: 'Job Finder', href: '/discover', icon: 'search' }, { label: 'Job Analyzer', href: '/analyzer', icon: 'scan' },
    { label: 'Applications', href: '/applications', icon: 'kanban' }, { label: 'Career Profiles', href: '/profiles', icon: 'user' } ] },
  { h: 'Outreach', items: [
    { label: 'Mailbox', href: '/mail', icon: 'mail' }, { label: 'Reply Inbox', href: '/inbox', icon: 'scan' }, { label: 'HR Contacts', href: '/contacts', icon: 'users' },
    { label: 'HR Outreach', href: '/outreach', icon: 'send' }, { label: 'Follow-ups', href: '/followups', icon: 'bell' }, { label: 'Email Setup', href: '/settings/email', icon: 'send' }, { label: 'Resume Studio', href: '/resumes', icon: 'file' } ] },
  { h: 'Automation & insight', items: [
    { label: 'AI Agent', href: '/agent', icon: 'bot' }, { label: 'Analytics', href: '/analytics', icon: 'chart' }, { label: 'Interview Prep', href: '/prep', icon: 'book' }, { label: 'AI Settings', href: '/settings/ai', icon: 'spark' }, { label: 'My Profile', href: '/settings/profile', icon: 'user' } ] },
];
const ADMIN = { h: 'Super admin', items: [
  { label: 'Admin Overview', href: '/admin', icon: 'shield' }, { label: 'Users', href: '/admin/users', icon: 'users' },
  { label: 'Audit Log', href: '/admin/audit', icon: 'file' }, { label: 'System Health', href: '/admin/system', icon: 'target' } ] };
// Each destination gets its own gradient so the rail reads at a glance (white glyph on a raised chip).
const TONE: Record<string, [string, string]> = {
  '/admin': ['#F43F5E', '#BE123C'], '/admin/users': ['#8B5CF6', '#5B21B6'], '/admin/audit': ['#84CC16', '#4D9A0F'], '/admin/system': ['#14B8A6', '#0F766E'],
  '/dashboard': ['#6366F1', '#4338CA'], '/discover': ['#14B8A6', '#0F766E'], '/settings/ai': ['#F472B6', '#DB2777'], '/settings/profile': ['#38BDF8', '#0369A1'], '/analyzer': ['#0EA5E9', '#0369A1'], '/applications': ['#FBBF24', '#EA7A0C'], '/profiles': ['#EC4899', '#9D174D'],
  '/mail': ['#3B82F6', '#1D4ED8'], '/inbox': ['#8B5CF6', '#6D28D9'], '/contacts': ['#10B981', '#047857'], '/followups': ['#F97316', '#C2410C'], '/outreach': ['#EC4899', '#BE185D'],
  '/settings/email': ['#06B6D4', '#0E7490'], '/resumes': ['#A855F7', '#7E22CE'], '/agent': ['#D946EF', '#A21CAF'], '/analytics': ['#22C55E', '#15803D'], '/prep': ['#FBBF24', '#D97706'],
};
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
  const [col, setCol] = useState(false);
  useEffect(() => { try { setCol(localStorage.getItem('jp.side') === '1'); } catch { /* storage unavailable */ } }, []);
  const toggle = () => setCol((v) => { try { localStorage.setItem('jp.side', v ? '0' : '1'); } catch { /* ignore */ } return !v; });
  const [menu, setMenu] = useState(false); const menuRef = useRef<HTMLDivElement>(null);
  const [me, setMe] = useState<{ name: string; email: string; plan: string; role?: string; image?: string | null } | null>(null);
  useEffect(() => {
    if (!token.get()) { router.replace('/login'); return; }
    const load = () => api('/auth/me').then(setMe).catch(() => undefined);
    load(); window.addEventListener('jobpilot:profile', load);
  }, [router]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [menu]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal((v) => !v); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  if (!token.get() && typeof window !== 'undefined') return null;
  const initials = (me?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="shell">
      <nav className={`side ${col ? 'col' : ''}`} aria-label="Main">
        <div className="side-top"><Logo /><button className="collapse" onClick={toggle} aria-label={col ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!col} title={col ? 'Expand sidebar' : 'Collapse sidebar'}>{col ? '»' : '«'}</button></div>
        {(me?.role === 'super_admin' ? [ADMIN, ...GROUPS] : GROUPS).map((g) => (
          <div key={g.h}>
            <div className="nav-h">{g.h}</div><div className="nav-rule" />
            {g.items.map((n) => {
              const on = n.href === '/admin' ? path === '/admin' : n.href.startsWith('/settings/') ? path === n.href : path.startsWith(n.href);
              return <Link key={n.href} href={n.href} className={`nav ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined} title={col ? n.label : undefined}><span className="ni" style={{ background: `linear-gradient(145deg, ${TONE[n.href]?.[0] ?? '#6366F1'}, ${TONE[n.href]?.[1] ?? '#4338CA'})`, boxShadow: `0 3px 8px ${TONE[n.href]?.[1] ?? '#4338CA'}40, inset 0 1px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.14)` }}><Icon name={n.icon} size={13} /></span><span className="nl">{n.label}</span></Link>;
            })}
          </div>
        ))}
        <div className="side-foot">
          {me?.image ? <img className="avatar" src={me.image} alt="" referrerPolicy="no-referrer" style={{ objectFit: 'cover' }} /> : <div className="avatar" aria-hidden="true">{initials}</div>}
          <div className="nl" style={{ minWidth: 0, flex: 1 }}>
            <Link href="/settings/profile" title="Edit profile" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', color: 'inherit', textDecoration: 'none' }}>{me?.name ?? ' '}</Link>
            <div className="faint" style={{ textTransform: 'capitalize' }}>{me?.role === 'super_admin' ? 'Super admin' : `${me?.plan?.replace('_', ' ') ?? ''} plan`}</div>
          </div>
          <button className="btn sm lo" aria-label="Log out" title="Log out" onClick={() => { token.clear(); router.push('/login'); }}><Icon name="out" size={14} /></button>
        </div>
      </nav>
      <div className="content">
        <header className="topbar">
          <b>{TITLES[path] ?? ''}</b>
          <span className="sp" />
          <button className="btn sm" onClick={() => setPal(true)} aria-label="Open command palette"><Icon name="search" size={13} />Search <span className="faint">Ctrl K</span></button>
          <Link href="/profiles" className="btn sm"><Icon name="user" size={13} />Profiles</Link>
          <div className="pm" ref={menuRef}>
            <button className="pm-btn" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} aria-label="Account menu" title={me?.name ?? 'Account'}>
              {me?.image ? <img src={me.image} alt="" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
            </button>
            {menu && (
              <div className="pm-pop" role="menu">
                <div className="pm-who">
                  {me?.image ? <img src={me.image} alt="" referrerPolicy="no-referrer" /> : <span className="pm-ini">{initials}</span>}
                  <div style={{ minWidth: 0 }}><b>{me?.name ?? ' '}</b><small>{me?.email}</small></div>
                </div>
                <Link role="menuitem" href="/settings/profile" onClick={() => setMenu(false)}><Icon name="user" size={14} />My profile</Link>
                <Link role="menuitem" href="/settings/email" onClick={() => setMenu(false)}><Icon name="send" size={14} />Email setup</Link>
                <button role="menuitem" onClick={() => { token.clear(); router.push('/login'); }}><Icon name="out" size={14} />Log out</button>
              </div>
            )}
          </div>
        </header>
        <main className="main">{children}</main>
      </div>
      {pal && <Palette onClose={() => setPal(false)} go={(h) => { setPal(false); router.push(h); }} />}
    </div>
  );
}
