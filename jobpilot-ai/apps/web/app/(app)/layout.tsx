'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { token } from '@/lib/api';

// Only screens that exist are listed. More are added as they are built.
const NAV = [
  ['Overview', '/dashboard'], ['Job Analyzer', '/analyzer'], ['Application Tracker', '/applications'], ['Career Profiles', '/profiles'],
] as const;

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!token.get()) router.replace('/login'); else setReady(true); }, [router]);
  if (!ready) return null;
  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand">JobPilot AI</div>
        {NAV.map(([label, href]) => (
          <Link key={href} href={href} className={`nav ${path.startsWith(href) ? 'on' : ''}`} aria-current={path.startsWith(href) ? 'page' : undefined}>{label}</Link>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => { token.clear(); router.push('/login'); }}>Log out</button>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
