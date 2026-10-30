'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errText, token } from '@/lib/api';

/** Landing page after Google sign-in. The token arrives in the URL fragment; store it, clear the URL, go to the app. */
export default function GoogleDone() {
  const router = useRouter(); const [err, setErr] = useState('');
  useEffect(() => {
    const t = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    window.history.replaceState({}, '', '/auth/google');
    if (!t) { setErr('No sign-in token was received. Please try again.'); return; }
    token.set(t);
    api<{ role: string }>('/auth/me').then((u) => router.replace(u.role === 'super_admin' ? '/admin' : '/dashboard')).catch((e) => { token.clear(); setErr(errText(e)); });
  }, [router]);
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 380, textAlign: 'center', display: 'grid', gap: 10 }}>
        {err ? <><b>Sign-in did not finish</b><span className="muted">{err}</span><Link href="/login" className="btn primary" style={{ justifyContent: 'center' }}>Back to log in</Link></> : <><b>Signing you in…</b><span className="muted">Connecting your Google account.</span></>}
      </div>
    </div>
  );
}
