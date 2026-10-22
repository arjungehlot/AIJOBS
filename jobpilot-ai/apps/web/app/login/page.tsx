'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Logo } from '@/components/ui';
import { api, errText, token } from '@/lib/api';

const POINTS = [
  'Explainable match scores',
  'Nothing sent without your approval',
  'Every action is logged',
];

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(''); setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const body = mode === 'register'
        ? { name: f.get('name'), email: f.get('email'), password: f.get('password') }
        : { email: f.get('email'), password: f.get('password') };
      const r = await api<{ token: string }>(`/auth/${mode}`, { body });
      token.set(r.token); router.push('/dashboard');
    } catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  }

  const [show, setShow] = useState(false);
  const isLogin = mode === 'login';
  const swap = (m: 'login' | 'register') => { setMode(m); setErr(''); };

  return (
    <div className="auth">
      <div className="auth-brand">
        <Link href="/" aria-label="JobPilot AI home"><Logo size={20} /></Link>
        <span className="muted">Your AI job search agent, with you in control.</span>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="seg" role="tablist" aria-label="Log in or register">
          <button type="button" role="tab" aria-selected={isLogin} onClick={() => swap('login')}>Log in</button>
          <button type="button" role="tab" aria-selected={!isLogin} onClick={() => swap('register')}>Create account</button>
        </div>
        <div>
          <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
          <p className="muted" style={{ marginTop: 4 }}>{isLogin ? 'Log in to continue your search.' : 'Free to start. No email is sent without your approval.'}</p>
        </div>
        {!isLogin && <label className="f">Full name<input name="name" required autoComplete="name" placeholder="Aarav Kumar" /></label>}
        <label className="f">Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
        <label className="f">Password{!isLogin && ' (10+ characters)'}
          <span className="pw">
            <input name="password" type={show ? 'text' : 'password'} required minLength={isLogin ? 1 : 10} autoComplete={isLogin ? 'current-password' : 'new-password'} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
          </span>
        </label>
        {err && <div className="msg err" role="alert">{err}</div>}
        <button className="btn primary lg" disabled={busy} style={{ justifyContent: 'center' }}>{busy ? 'Please wait' : isLogin ? 'Log in' : 'Create account'}</button>
        <div className="faint" style={{ textAlign: 'center', display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}><Icon name="lock" size={12} />Passwords are hashed. Google and Microsoft sign-in are not built yet.</div>
      </form>
      <div className="auth-points">
        {POINTS.map((p) => <span key={p}><i><Icon name="check" size={13} /></i>{p}</span>)}
      </div>
    </div>
  );
}
