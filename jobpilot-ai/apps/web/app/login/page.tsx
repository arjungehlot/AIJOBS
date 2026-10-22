'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errText, token } from '@/lib/api';

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
    <main style={{ maxWidth: 400, margin: '10vh auto', padding: 16 }}>
      <div className="brand">JobPilot AI</div>
      <form className="card" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1>{mode === 'login' ? 'Log in' : 'Create your account'}</h1>
        {mode === 'register' && <label className="f">Name<input name="name" required autoComplete="name" /></label>}
        <label className="f">Email<input name="email" type="email" required autoComplete="email" /></label>
        <label className="f">Password{mode === 'register' && ' (10+ characters)'}
          <input name="password" type="password" required minLength={mode === 'register' ? 10 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {err && <div className="msg err" role="alert">{err}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait' : mode === 'login' ? 'Log in' : 'Sign up'}</button>
        <button type="button" className="btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
        </button>
      </form>
    </main>
  );
}
