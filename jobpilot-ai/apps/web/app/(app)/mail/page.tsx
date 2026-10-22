'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import { api, errText } from '@/lib/api';

type Folder = 'inbox' | 'sent' | 'all';
const when = (d: string) => { const x = new Date(d), n = new Date(); return x.toDateString() === n.toDateString() ? x.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : x.toLocaleDateString([], { day: 'numeric', month: 'short' }); };
const daysAgo = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));

export default function Mailbox() {
  const [st, setSt] = useState<any>(null);
  const [folder, setFolder] = useState<Folder>('inbox');
  const [q, setQ] = useState(''); const [applied, setApplied] = useState('');
  const [items, setItems] = useState<any[] | null>(null); const [next, setNext] = useState<string | null>(null);
  const [track, setTrack] = useState<Record<string, any>>({});
  const [sel, setSel] = useState<any>(null); const [thread, setThread] = useState<any>(null);
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState<{ to: string; subject: string; body: string; threadId?: string } | null>(null);
  const [reply, setReply] = useState('');
  const seq = useRef(0);

  useEffect(() => { api('/integrations/gmail/status').then(setSt).catch((e) => setErr(errText(e))); }, []);

  async function load(more = false) {
    const my = ++seq.current; setErr('');
    try {
      const qs = new URLSearchParams({ folder, ...(applied && { q: applied }), ...(more && next ? { pageToken: next } : {}) });
      const r = await api(`/integrations/gmail/messages?${qs}`);
      if (my !== seq.current) return;
      setItems(more ? [...(items ?? []), ...r.items] : r.items); setNext(r.nextPageToken);
      if (folder === 'sent' && r.items.length) {
        const ids = [...new Set(r.items.map((m: any) => m.threadId))].slice(0, 20);
        api('/integrations/gmail/tracking', { body: { threadIds: ids } }).then((t) => my === seq.current && setTrack((o) => ({ ...o, ...t }))).catch(() => undefined);
      }
    } catch (e) { if (my === seq.current) { setErr(errText(e)); setItems([]); } }
  }
  useEffect(() => { if (st?.connected) { setItems(null); setSel(null); setThread(null); load(); } }, [st?.connected, folder, applied]);

  async function open(m: any) {
    setSel(m); setThread(null); setReply('');
    try { setThread(await api(`/integrations/gmail/threads/${m.threadId}`)); } catch (e) { setErr(errText(e)); }
  }
  async function send(e: FormEvent) {
    e.preventDefault(); if (!compose) return; setBusy(true); setErr(''); setOk('');
    try { await api('/integrations/gmail/send', { body: compose }); setCompose(null); setOk('Sent from your Gmail.'); if (folder === 'sent') load(); }
    catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  }
  async function sendReply() {
    if (!thread || !reply.trim()) return; setBusy(true); setErr(''); setOk('');
    const last = [...thread.messages].reverse().find((m: any) => !m.mine) ?? thread.messages[thread.messages.length - 1];
    const to = last.mine ? last.to.match(/[^\s<>,"]+@[^\s<>,"]+/)?.[0] ?? '' : last.from.email;
    const subject = /^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`;
    try { await api('/integrations/gmail/send', { body: { to, subject, body: reply, threadId: thread.threadId } }); setReply(''); setOk('Reply sent.'); await open(sel); }
    catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  }
  async function toInbox(m: any) {
    setErr(''); setOk('');
    try { await api('/inbox', { body: { fromEmail: m.from.email, subject: m.subject, body: m.body, receivedAt: m.date } }); setOk('Added to Reply Inbox for classification. Nothing was changed automatically.'); } catch (x) { setErr(errText(x)); }
  }

  if (!st) return <div className="card muted">{err || 'Loading'}</div>;
  if (!st.connected) return (
    <>
      <div className="ph"><div><h1>Mailbox</h1><p>Your Gmail inside JobPilot: read, send and track replies.</p></div></div>
      <div className="card empty" style={{ padding: 40 }}><Icon name="mail" size={28} /><p>Connect your Gmail account to see your mail here.</p><Link href="/settings/email" className="btn primary">Go to Email Setup</Link></div>
    </>
  );

  return (
    <>
      <div className="ph"><div><h1>Mailbox</h1><p>{st.email} · {st.mailMode === 'gmail' ? 'Live: messages you send go out for real.' : 'Reading works. Sending is off until MAIL_PROVIDER=gmail is set.'}</p></div>
        <button className="btn primary" onClick={() => setCompose({ to: '', subject: '', body: '' })}><Icon name="plus" size={13} />Compose</button></div>
      {err && <div className="msg err" role="alert">{err}</div>}{ok && <div className="msg ok">{ok}</div>}
      <div className="mail">
        <section className="card mail-list">
          <div style={{ padding: 10, borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="seg" role="tablist" style={{ display: 'flex' }}>
              {(['inbox', 'sent', 'all'] as Folder[]).map((f) => <button key={f} role="tab" aria-selected={folder === f} style={{ flex: 1, textTransform: 'capitalize' }} onClick={() => setFolder(f)}>{f === 'all' ? 'All mail' : f}</button>)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setApplied(q); }} style={{ display: 'flex', gap: 6 }}>
              <input aria-label="Search mail" placeholder="Search mail (from:, subject:, is:unread)" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn" aria-label="Search"><Icon name="search" size={14} /></button>
              <button type="button" className="btn" aria-label="Refresh" title="Refresh" onClick={() => { setItems(null); load(); }}>↻</button>
            </form>
          </div>
          <div className="scroller">
            {!items ? <div className="muted" style={{ padding: 16 }}>Loading your mail…</div> : items.length === 0 ? <div className="empty">No messages here.</div> : items.map((m) => {
              const t = track[m.threadId];
              return (
                <button key={m.id} className={`mrow ${m.unread ? 'unread' : ''}`} aria-current={sel?.id === m.id} onClick={() => open(m)}>
                  <div className="top"><span className="who">{folder === 'sent' || m.sent ? `To: ${m.to.replace(/<.*?>/g, '').trim() || m.to}` : m.from.name}</span><span className="when">{when(m.date)}</span></div>
                  <div className="sub">{m.subject}</div>
                  <div className="snip">{m.snippet}</div>
                  {folder === 'sent' && t && <div style={{ marginTop: 4 }}>{t.replied ? <span className="pill ok">Replied{t.replies > 1 ? ` · ${t.replies}` : ''}</span> : <span className="pill gray">Awaiting reply · {daysAgo(m.date)}d</span>}</div>}
                </button>);
            })}
            {next && <div style={{ padding: 10, textAlign: 'center' }}><button className="btn sm" onClick={() => load(true)}>Load more</button></div>}
          </div>
        </section>

        <section className="card mread">
          {!sel ? <div className="empty" style={{ padding: 60 }}>Select a message to read it.</div> : !thread ? <div className="muted" style={{ padding: 20 }}>Loading conversation…</div> : (
            <>
              <div className="hd"><h2 style={{ margin: 0 }}>{thread.messages[0]?.subject}</h2>
                <div className="faint">{thread.messages.length} message{thread.messages.length > 1 ? 's' : ''} in this conversation</div></div>
              {thread.messages.map((m: any) => (
                <article key={m.id} className={`mmsg ${m.mine ? 'mine' : ''}`}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <b>{m.mine ? 'You' : m.from.name}</b><span className="faint">{m.from.email}</span>
                    <span className="faint" style={{ marginLeft: 'auto' }}>{new Date(m.date).toLocaleString()}</span>
                  </div>
                  <div className="faint">to {m.to.replace(/<.*?>/g, '').trim() || m.to}</div>
                  <pre>{m.body}</pre>
                  {m.attachments.length > 0 && <div className="faint" style={{ marginTop: 6 }}>📎 {m.attachments.join(', ')} <i>(attachments are listed, not downloaded)</i></div>}
                  {!m.mine && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => toInbox(m)}>Analyze in Reply Inbox</button>}
                </article>))}
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea aria-label="Reply" rows={4} style={{ height: 'auto' }} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
                <div className="row" style={{ alignItems: 'center' }}>
                  <button className="btn primary" disabled={busy || !reply.trim()} onClick={sendReply}><Icon name="send" size={13} />{busy ? 'Sending…' : 'Send reply'}</button>
                  <span className="faint">Sent from {st.email}. Nothing is sent until you press this.</span>
                </div>
              </div>
            </>)}
        </section>
      </div>

      {compose && (
        <form className="compose" onSubmit={send} aria-label="Compose message">
          <div className="ch"><b>New message</b><button type="button" aria-label="Close" onClick={() => setCompose(null)}>✕</button></div>
          <div className="cb">
            <input aria-label="To" type="email" required placeholder="To" value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })} />
            <input aria-label="Subject" required placeholder="Subject" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} />
            <textarea aria-label="Message" required rows={9} style={{ height: 'auto' }} placeholder="Write your message" value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} />
            <div className="row" style={{ alignItems: 'center' }}><button className="btn primary" disabled={busy}><Icon name="send" size={13} />{busy ? 'Sending…' : 'Send'}</button><span className="faint">Plain text. One recipient.</span></div>
          </div>
        </form>)}
    </>
  );
}
