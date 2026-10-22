'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui';
import { api, errText } from '@/lib/api';

export default function EmailSetup() {
  const [s, setS] = useState<any>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const load = () => api('/integrations/gmail/status').then(setS).catch((e) => setErr(errText(e)));
  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search);
    if (q.get('connected')) setOk('Gmail connected. Nothing has been sent.');
    if (q.get('error')) setErr(q.get('error')!);
    if (q.toString()) window.history.replaceState({}, '', '/settings/email');
  }, []);

  async function connect() {
    setErr(''); setBusy('connect');
    try { const r = await api<{ url: string }>('/integrations/gmail/connect'); window.location.href = r.url; } catch (e) { setErr(errText(e)); setBusy(''); }
  }
  async function disconnect() {
    if (!window.confirm('Disconnect Gmail? Pending sends will fail until you reconnect.')) return;
    setBusy('dc'); try { await api('/integrations/gmail/disconnect', { body: {} }); setOk('Gmail disconnected and access revoked.'); await load(); } catch (e) { setErr(errText(e)); } setBusy('');
  }
  async function sync() {
    setErr(''); setOk(''); setBusy('sync');
    try { const r = await api('/integrations/gmail/sync', { body: {} }); setOk(`Checked ${r.threadsChecked} conversations, imported ${r.imported} new ${r.imported === 1 ? 'reply' : 'replies'}. See them in Inbox.`); await load(); } catch (e) { setErr(errText(e)); }
    setBusy('');
  }
  if (!s) return <div className="card muted">{err || 'Loading'}</div>;
  const live = s.mailMode === 'gmail';

  const stateTxt = s.connected ? 'Connected' : s.accountStatus === 'error' ? 'Needs reconnecting' : 'Not connected';
  return (
    <>
      <div className="ph"><div><h1>Email Setup</h1><p>Connect your own Gmail. Applications go out from your address, only after you approve each one.</p></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}{ok && <div className="msg ok">{ok}</div>}

      <div className="pg-two" style={{ gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, 1fr)' }}>
        <div className="pg-list">
          <section className={`card es-hero ${s.connected ? 'on' : ''}`}>
            <div className="es-logo"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" fill="#fff" /><path d="M3 7l9 6 9-6" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2>Gmail</h2>
              <div className="faint">{s.connected ? <><b style={{ color: 'var(--ink)' }}>{s.email}</b> · {s.lastSyncAt ? `synced ${new Date(s.lastSyncAt).toLocaleString()}` : 'not synced yet'}</> : 'Send applications and read replies from your own account.'}</div>
            </div>
            <span className={`pill ${s.connected ? 'ok' : s.accountStatus === 'error' ? 'bad' : 'gray'}`}>● {stateTxt}</span>
          </section>
          {!s.configured && <div className="msg warn"><b>Server is not configured.</b> Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in the API <code>.env</code> file, then restart the API.</div>}
          {s.lastError && !s.connected && <div className="msg err">{s.lastError}</div>}
          <section className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {s.connected ? (<>
              <button className="btn primary" disabled={!!busy} onClick={sync}>{busy === 'sync' ? 'Syncing…' : '↻ Sync replies'}</button>
              <button className="btn" disabled={!!busy} onClick={disconnect}>Disconnect</button>
            </>) : (<>
              <button className="btn primary lg" disabled={!s.configured || !!busy} onClick={connect}><Icon name="mail" size={15} />{busy === 'connect' ? 'Opening Google…' : s.accountStatus === 'error' ? 'Reconnect Gmail' : 'Connect Gmail'}</button>
              <span className="faint">You will approve access on Google, then return here.</span>
            </>)}
          </section>
          <div className={`es-mode ${live ? 'live' : 'test'}`}>
            <span className="d" />{live ? <><b>Live mode</b> · approved applications are sent through your Gmail.</> : <><b>Test mode</b> · no real email is sent. Set <code>MAIL_PROVIDER=gmail</code> in the API <code>.env</code> and restart to send.</>}
          </div>
        </div>

        <div className="pg-list">
          <section className="card">
            <div className="pg-h" style={{ marginBottom: 6 }}><span className="ic" style={{ background: 'linear-gradient(135deg,#34D399,#059669)' }}>✓</span><h2>What JobPilot can do</h2></div>
            <ul className="es-list">
              <li><b>Send</b> an application you approved, from your address.</li>
              <li><b>Read</b> replies only inside conversations of applications it sent.</li>
              <li>Never changes a status, replies or accepts anything on its own.</li>
              <li>Access can be removed here or in your Google account.</li>
            </ul>
          </section>
          <section className="card">
            <div className="pg-h" style={{ marginBottom: 6 }}><span className="ic" style={{ background: 'linear-gradient(135deg,#38BDF8,#4F46E5)' }}>⚙</span><h2>Google Cloud checklist</h2></div>
            <ol className="es-steps">
              <li>Enable the <b>Gmail API</b> for your project.</li>
              <li>Create an <b>OAuth client (Web application)</b>.</li>
              <li>Add this <b>authorized redirect URI</b>:<code>{s.redirectUri}</code></li>
              <li>While in <i>Testing</i>, add your Gmail under <b>Test users</b>.</li>
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
