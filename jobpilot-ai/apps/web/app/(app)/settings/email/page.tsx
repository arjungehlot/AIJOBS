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

  return (
    <>
      <div className="ph"><div><h1>Email setup</h1><p>Connect your own Gmail account. Applications are sent from your address, only after you approve each one.</p></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}{ok && <div className="msg ok">{ok}</div>}

      <div className="grid">
        <section className="card s7 stack">
          <div className="card-h"><h2>Gmail</h2><span className={`pill ${s.connected ? 'ok' : s.accountStatus === 'error' ? 'bad' : 'gray'}`}>{s.connected ? 'Connected' : s.accountStatus === 'error' ? 'Needs reconnecting' : 'Not connected'}</span></div>
          {!s.configured && <div className="msg warn"><b>Server is not configured.</b> Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in the API <code>.env</code> file, then restart the API.</div>}
          {s.connected ? (
            <div className="row" style={{ alignItems: 'center', gap: 12 }}>
              <span className="c-emerald" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name="mail" size={18} /></span>
              <div style={{ flex: 1 }}><b>{s.email}</b><div className="faint">{s.lastSyncAt ? `Last synced ${new Date(s.lastSyncAt).toLocaleString()}` : 'Not synced yet'}</div></div>
              <button className="btn primary" disabled={!!busy} onClick={sync}>{busy === 'sync' ? 'Syncing…' : 'Sync replies'}</button>
              <button className="btn" disabled={!!busy} onClick={disconnect}>Disconnect</button>
            </div>
          ) : (
            <div className="stack">
              {s.lastError && <div className="msg err">{s.lastError}</div>}
              <button className="btn primary lg" style={{ alignSelf: 'flex-start' }} disabled={!s.configured || !!busy} onClick={connect}><Icon name="mail" size={15} />{busy === 'connect' ? 'Opening Google…' : s.accountStatus === 'error' ? 'Reconnect Gmail' : 'Connect Gmail'}</button>
              <p className="faint" style={{ margin: 0 }}>You will be sent to Google to approve access, then brought back here.</p>
            </div>
          )}
          <div className="msg" style={{ background: live ? 'var(--ok-bg)' : 'var(--warn-bg)', color: live ? 'var(--ok)' : 'var(--warn)' }}>
            {live ? 'Live mode: approved applications are sent through your Gmail.' : <>Test mode: <b>no real email is sent</b>. Set <code>MAIL_PROVIDER=gmail</code> in the API <code>.env</code> and restart to send through Gmail.</>}
          </div>
        </section>

        <div className="s5 stack">
          <section className="card">
            <h2>What JobPilot can do</h2>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
              <li><b>Send</b> an application you approved, from your address.</li>
              <li><b>Read</b> replies only inside conversations of applications it sent. It does not browse your other mail.</li>
              <li>It never changes a status, sends a reply, or accepts anything on its own.</li>
              <li>Access can be removed here, or in your Google account settings.</li>
            </ul>
          </section>
          <section className="card">
            <h2>Google Cloud checklist</h2>
            <ol className="faint" style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Enable the <b>Gmail API</b> for your project.</li>
              <li>Create an <b>OAuth client (Web application)</b>.</li>
              <li>Add this exact <b>authorized redirect URI</b>:<br /><code style={{ wordBreak: 'break-all' }}>{s.redirectUri}</code></li>
              <li>While the app is in <i>Testing</i>, add your Gmail address under <b>Test users</b>.</li>
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
