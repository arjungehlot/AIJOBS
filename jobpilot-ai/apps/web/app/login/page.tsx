'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Logo } from '@/components/ui';
import { api, errText, token } from '@/lib/api';

const POINTS = [
  'Scores every job against your profile and explains the score',
  'Drafts honest applications from facts you provide, never invented ones',
  'Nothing is sent until you approve it, and every action is logged',
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

  return (
    <div className="auth">
      <aside className="auth-art">
        <Link href="/"><Logo size={17} /></Link>
        <div>
          <h1 style={{ fontSize: 34, lineHeight: 1.1, letterSpacing: '-0.03em', maxWidth: 420 }}>Your AI job search agent, with you in control.</h1>
          <div className="stack" style={{ marginTop: 22, maxWidth: 420 }}>
            {POINTS.map((p) => <div key={p} className="quote"><i><Icon name="check" size={12} /></i><span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{p}</span></div>)}
          </div>
        </div>
        <div className="faint">© JobPilot AI</div>
      </aside>
      <section className="auth-form">
        <form onSubmit={submit}>
          <div>
            <h1 style={{ fontSize: 24 }}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
            <p className="muted" style={{ marginTop: 4 }}>{mode === 'login' ? 'Log in to continue your search.' : 'Free to start. No email is sent without your approval.'}</p>
          </div>
          {mode === 'register' && <label className="f">Full name<input name="name" required autoComplete="name" /></label>}
          <label className="f">Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
          <label className="f">Password{mode === 'register' && ' (10+ characters)'}
            <input name="password" type="password" required minLength={mode === 'register' ? 10 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
          {err && <div className="msg err" role="alert">{err}</div>}
          <button className="btn primary lg" disabled={busy} style={{ justifyContent: 'center' }}>{busy ? 'Please wait' : mode === 'login' ? 'Log in' : 'Create account'}</button>
          <div className="muted" style={{ textAlign: 'center' }}>
            {mode === 'login' ? 'New here? ' : 'Already registered? '}
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}
              style={{ border: 0, background: 'none', color: 'var(--primary-600)', fontWeight: 600, cursor: 'pointer', font: 'inherit' }}>
              {mode === 'login' ? 'Create an account' : 'Log in'}
            </button>
          </div>
          <div className="faint" style={{ textAlign: 'center', display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}><Icon name="lock" size={12} />Passwords are hashed. Google and Microsoft sign-in are not built yet.</div>
        </form>
      </section>
    </div>
  );
}
