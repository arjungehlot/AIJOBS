'use client';
import { useState } from 'react';
import { api, errText } from '@/lib/api';

/** "Continue with Google": one step that signs in (or creates the account) and connects Gmail. */
export function GoogleButton({ label = 'Continue with Google', onError }: { label?: string; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); onError('');
    try { const r = await api<{ url: string }>('/auth/google/start'); window.location.href = r.url; } catch (e) { onError(errText(e)); setBusy(false); }
  }
  return (
    <button type="button" className="btn lg gbtn" onClick={go} disabled={busy} style={{ justifyContent: 'center', height: 43 }}>
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.3 5.7c4.3-4 6.8-9.9 6.8-17.2z" /><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.9 2.3-8.6 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
      {busy ? 'Opening Google…' : label}
    </button>
  );
}
