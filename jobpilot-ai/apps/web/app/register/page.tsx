'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { Icon } from '@/components/ui';
import { api, errText, token } from '@/lib/api';

// Length-and-variety hint only. The server enforces the real rule (10+ characters).
const strength = (p: string) => (p.length < 10 ? (p ? 1 : 0) : [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length >= 3 || p.length >= 16 ? 3 : 2);

export default function Register() {
  const router = useRouter();
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false); const [pw, setPw] = useState('');
  const s = strength(pw);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(''); setBusy(true);
    const f = new FormData(e.currentTarget);
    try { const r = await api<{ token: string }>('/auth/register', { body: { name: f.get('name'), email: f.get('email'), password: f.get('password') } }); token.set(r.token); router.push('/dashboard'); }
    catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  }

  return (
    <AuthShell>
      <div><h1>Create your account</h1><p className="muted" style={{ marginTop: 4 }}>Free to start. No email is sent without your approval.</p></div>
      <form onSubmit={submit}>
        <label className="f">Full name<input name="name" required autoComplete="name" placeholder="Aarav Kumar" /></label>
        <label className="f">Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
        <label className="f">Password (10+ characters)
          <span className="pw"><input name="password" type={show ? 'text' : 'password'} required minLength={10} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button></span>
          <span className="strength" aria-hidden="true">{[1, 2, 3].map((n) => <i key={n} className={s >= n ? `on${s}` : ''} />)}</span>
          <span className="faint" style={{ fontWeight: 400 }}>{s === 0 ? 'Use a long passphrase you do not use elsewhere.' : s === 1 ? 'Too short: needs at least 10 characters.' : s === 2 ? 'Okay. Mixing letters, numbers and symbols makes it stronger.' : 'Strong.'}</span>
        </label>
        {err && <div className="msg err" role="alert">{err}</div>}
        <button className="btn primary lg" disabled={busy} style={{ justifyContent: 'center' }}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <div className="muted" style={{ textAlign: 'center' }}>Already registered? <Link href="/login" style={{ color: 'var(--primary-600)', fontWeight: 600 }}>Log in</Link></div>
      <div className="faint" style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}><Icon name="lock" size={12} />Passwords are hashed. You connect your own Gmail later, inside the app.</div>
    </AuthShell>
  );
}
