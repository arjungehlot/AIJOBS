'use client';
import { useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

const fmt = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m ${s % 60}s`);

export default function AdminSystem() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { api('/admin/system').then(setD).catch((e) => setErr(errText(e))); }, []);
  if (err) return <div className="msg err" role="alert">{err}</div>;
  if (!d) return <div className="card muted">Loading</div>;
  const bad = d.checks.filter((c: any) => c.status === 'bad').length, warn = d.checks.filter((c: any) => c.status === 'warn').length;
  return (
    <>
      <div className="ph"><div><h1>System health</h1><p>Configuration and connection checks. Secrets are never shown here.</p></div></div>
      <div className={`msg ${bad ? 'err' : warn ? 'warn' : 'ok'}`}>{bad ? `${bad} problem${bad > 1 ? 's' : ''} need attention.` : warn ? `No problems. ${warn} item${warn > 1 ? 's are' : ' is'} running in a development setting.` : 'Everything looks good.'}</div>
      <section className="card">
        {d.checks.map((c: any) => (
          <div key={c.name} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <span className={`pill ${c.status}`} style={{ width: 54, justifyContent: 'center' }}>{c.status === 'ok' ? 'OK' : c.status === 'warn' ? 'Note' : 'Fix'}</span>
            <b style={{ width: 170 }}>{c.name}</b><span className="muted" style={{ flex: 1 }}>{c.detail}</span>
          </div>))}
      </section>
      <section className="card"><h2>Runtime</h2>
        <div className="row" style={{ gap: 28, marginTop: 6 }}>
          {[['Node', d.runtime.node], ['Environment', d.runtime.env], ['API port', d.runtime.port], ['Uptime', fmt(d.runtime.uptimeSec)], ['Web URL', d.runtime.webUrl]].map(([k, v]) => <div key={k as string}><div className="faint">{k}</div><b>{v}</b></div>)}
        </div>
      </section>
    </>
  );
}
