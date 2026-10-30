'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { GoogleButton } from '@/components/google-button';
import { Icon } from '@/components/ui';
import { api, errText, token } from '@/lib/api';

export default function Login() {
  const router = useRouter();
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);

  useEffect(() => { const q = new URLSearchParams(window.location.search).get('error'); if (q) { setErr(q); window.history.replaceState({}, '', '/login'); } }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(''); setBusy(true);
    const f = new FormData(e.currentTarget);
    try { const r = await api<{ token: string; user: { role: string } }>('/auth/login', { body: { email: f.get('email'), password: f.get('password') } }); token.set(r.token); router.push(r.user.role === 'super_admin' ? '/admin' : '/dashboard'); }
    catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  }

  return (
    <AuthShell>
      <div><h1>Welcome back</h1><p className="muted" style={{ marginTop: 4 }}>Log in to continue your job search.</p></div>
      <GoogleButton onError={setErr} />
      <div className="divider">or use your email</div>
      <form onSubmit={submit}>
        <label className="f">Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
        <label className="f">Password
          <span className="pw"><input name="password" type={show ? 'text' : 'password'} required autoComplete="current-password" placeholder="Your password" />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button></span>
        </label>
        {err && <div className="msg err" role="alert">{err}</div>}
        <button className="btn primary lg" disabled={busy} style={{ justifyContent: 'center' }}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <div className="divider">New to JobPilot?</div>
      <Link href="/register" className="btn lg" style={{ justifyContent: 'center', height: 43 }}>Create a free account</Link>
      <div className="faint" style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}><Icon name="lock" size={12} />Emails are sent from your own Gmail. Nothing goes out without your say-so.</div>
    </AuthShell>
  );
}
