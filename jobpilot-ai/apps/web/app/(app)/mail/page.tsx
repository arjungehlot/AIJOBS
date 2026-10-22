'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import { api, errText } from '@/lib/api';

type Folder = 'inbox' | 'sent' | 'all';
const COLORS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#F43F5E', '#64748B'];
const color = (s: string) => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const initials = (s: string) => (s.replace(/[<@].*$/, '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || '?').toUpperCase();
const when = (d: string) => { const x = new Date(d), n = new Date(); return x.toDateString() === n.toDateString() ? x.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : x.toLocaleDateString([], { day: 'numeric', month: 'short' }); };
const ago = (d: string) => { const n = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); return n < 1 ? 'today' : `${n}d`; };
// Hides the quoted earlier conversation by default. Purely cosmetic: the full text is one click away.
const split = (b: string) => { const i = b.search(/^(On .{5,120} wrote:|-{2,}\s*Original Message|>.*)$/m); return i > 40 ? [b.slice(0, i).trimEnd(), b.slice(i)] : [b, '']; };
const dec = (t: string) => (t ?? '').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' } as Record<string, string>)[n]);
// Display-only cleanup: shortens <long tracking links> to their host and squeezes blank-line runs.
const tidy = (t: string) => dec(t).replace(/<(https?:\/\/([^\/>\s]+)[^>]*)>/g, (_, _u, h) => `[${h}]`).replace(/(https?:\/\/[^\s/]+)[^\s]{60,}/g, '$1/…').replace(/\n[ \t]*(\n[ \t]*){2,}/g, '\n\n').trim();
const recip = (to: string) => to.replace(/<.*?>/g, '').replace(/"/g, '').trim() || to;

export default function Mailbox() {
  const [st, setSt] = useState<any>(null);
  const [folder, setFolder] = useState<Folder>('inbox');
  const [q, setQ] = useState(''); const [applied, setApplied] = useState('');
  const [items, setItems] = useState<any[] | null>(null); const [next, setNext] = useState<string | null>(null);
  const [track, setTrack] = useState<Record<string, any>>({});
  const [sel, setSel] = useState<any>(null); const [thread, setThread] = useState<any>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({}); const [quoted, setQuoted] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [reply, setReply] = useState(''); const [replying, setReplying] = useState(false);
  const seq = useRef(0);

  useEffect(() => { api('/integrations/gmail/status').then(setSt).catch((e) => setErr(errText(e))); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && setCompose(null); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);

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

  async function openMsg(m: any) {
    setSel(m); setThread(null); setReply(''); setReplying(false); setQuoted({});
    try {
      const t = await api(`/integrations/gmail/threads/${m.threadId}`);
      setThread(t); setOpen({ [t.messages[t.messages.length - 1].id]: true }); // newest expanded, older collapsed
    } catch (e) { setErr(errText(e)); }
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
    try { await api('/integrations/gmail/send', { body: { to, subject, body: reply, threadId: thread.threadId } }); setReply(''); setReplying(false); setOk('Reply sent.'); await openMsg(sel); }
    catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  }
  async function toInbox(m: any) {
    setErr(''); setOk('');
    try { await api('/inbox', { body: { fromEmail: m.from.email, subject: m.subject, body: m.body, receivedAt: m.date } }); setOk('Added to Reply Inbox. Nothing was changed automatically.'); } catch (x) { setErr(errText(x)); }
  }

  if (!st) return <div className="card muted">{err || 'Loading'}</div>;
  if (!st.connected) return (
    <div className="card empty" style={{ padding: 40 }}><Icon name="mail" size={28} /><p>Connect your Gmail account to see your mail here.</p><Link href="/settings/email" className="btn primary">Go to Email Setup</Link></div>
  );
  const live = st.mailMode === 'gmail';
  const tr = sel && track[sel.threadId];

  return (
    <div className="mailpage">
      <div className="mailbar">
        <h1>Mailbox</h1>
        <span className="pill gray">{st.email}</span>
        <span className={`pill ${live ? 'ok' : 'warn'}`} title={live ? 'Messages you send go out for real' : 'Reading works. Set MAIL_PROVIDER=gmail to send'}>{live ? 'Live sending' : 'Read-only mode'}</span>
        <span style={{ flex: 1 }} />
        {err && <span className="msg err" role="alert" style={{ padding: '4px 10px' }}>{err}</span>}{ok && <span className="msg ok" style={{ padding: '4px 10px' }}>{ok}</span>}
        <button className="btn primary" onClick={() => setCompose({ to: '', subject: '', body: '' })}><Icon name="plus" size={13} />Compose</button>
      </div>

      <div className="mail">
        <section className="mpanel">
          <div className="mhead">
            <div className="seg" role="tablist" style={{ display: 'flex' }}>
              {(['inbox', 'sent', 'all'] as Folder[]).map((f) => <button key={f} role="tab" aria-selected={folder === f} onClick={() => setFolder(f)}>{f === 'all' ? 'All mail' : f[0].toUpperCase() + f.slice(1)}</button>)}
            </div>
            <form className="msearch" onSubmit={(e) => { e.preventDefault(); setApplied(q); }}>
              <input aria-label="Search mail" placeholder="Search (from:, subject:, is:unread)" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn" aria-label="Search"><Icon name="search" size={13} /></button>
              <button type="button" className="btn" aria-label="Refresh" title="Refresh" onClick={() => { setItems(null); load(); }}>↻</button>
            </form>
          </div>
          <div className="mscroll">
            {!items ? <div className="muted" style={{ padding: 14 }}>Loading your mail…</div> : items.length === 0 ? <div className="empty">No messages here.</div> : items.map((m) => {
              const mine = folder === 'sent' || m.sent; const name = mine ? recip(m.to) : m.from.name; const t = track[m.threadId];
              return (
                <button key={m.id} className={`mrow ${m.unread ? 'unread' : ''}`} aria-current={sel?.id === m.id} onClick={() => openMsg(m)}>
                  <span className="av" style={{ background: color(name) }} aria-hidden="true">{initials(name)}</span>
                  <span className="mb">
                    <span className="top"><span className="who">{mine ? `To ${name}` : name}</span><span className="when">{when(m.date)}</span></span>
                    <span className="sub" style={{ display: 'block' }}>{dec(m.subject)}</span>
                    <span className="snip" style={{ display: 'block' }}>{dec(m.snippet)}</span>
                    {folder === 'sent' && t && (t.replied ? <span className="chip ok">✓ Replied{t.replies > 1 ? ` · ${t.replies}` : ''}</span> : <span className="chip wait">Awaiting reply · {ago(m.date)}</span>)}
                  </span>
                </button>);
            })}
            {next && <div style={{ padding: 8, textAlign: 'center' }}><button className="btn sm" onClick={() => load(true)}>Load more</button></div>}
          </div>
        </section>

        <section className="mpanel">
          {!sel ? <div className="empty" style={{ margin: 'auto' }}><Icon name="mail" size={26} /><p>Select a message to read it.</p></div> : !thread ? <div className="muted" style={{ padding: 16 }}>Loading conversation…</div> : (
            <>
              <div className="mrhead">
                <h2 title={dec(thread.messages[0]?.subject)}>{dec(thread.messages[0]?.subject)}</h2>
                <span className="faint">{thread.messages.length} msg{thread.messages.length > 1 ? 's' : ''}</span>
                {tr && (tr.replied ? <span className="chip ok" style={{ margin: 0 }}>✓ Replied</span> : <span className="chip wait" style={{ margin: 0 }}>Awaiting reply</span>)}
              </div>
              <div className="mscroll">
                {thread.messages.map((m: any) => {
                  const isOpen = !!open[m.id]; const [fresh, old] = split(m.body); const showAll = quoted[m.id];
                  return (
                    <article key={m.id} className={`mmsg ${m.mine ? 'mine' : ''}`}>
                      <div className="mh" onClick={() => setOpen({ ...open, [m.id]: !isOpen })} role="button" tabIndex={0} aria-expanded={isOpen} onKeyDown={(e) => e.key === 'Enter' && setOpen({ ...open, [m.id]: !isOpen })}>
                        <span className="av" style={{ background: m.mine ? '#64748B' : color(m.from.name) }} aria-hidden="true">{m.mine ? 'ME' : initials(m.from.name)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><b style={{ fontSize: 12.5 }}>{m.mine ? 'You' : m.from.name}</b><span className="faint" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isOpen ? `to ${recip(m.to)}` : tidy(m.body).replace(/\s+/g, ' ').slice(0, 90)}</span><span className="faint">{new Date(m.date).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
                        </div>
                      </div>
                      {isOpen && (<>
                        <pre>{tidy(showAll ? m.body : fresh)}</pre>
                        {old && <div className="acts"><button className="btn sm" onClick={() => setQuoted({ ...quoted, [m.id]: !showAll })}>{showAll ? 'Hide quoted text' : '⋯ Show quoted text'}</button></div>}
                        {(m.attachments.length > 0 || !m.mine) && (
                          <div className="acts">
                            {m.attachments.length > 0 && <span className="faint">📎 {m.attachments.join(', ')} (not downloaded)</span>}
                            {!m.mine && <button className="btn sm" onClick={() => toInbox(m)}>Analyze in Reply Inbox</button>}
                          </div>)}
                      </>)}
                    </article>);
                })}
              </div>
              <div className="mreplybar">
                {!replying ? <button className="btn" style={{ justifyContent: 'flex-start', color: 'var(--muted)' }} onClick={() => setReplying(true)}>↩ Reply to this conversation…</button> : (<>
                  <textarea aria-label="Reply" autoFocus rows={4} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
                  <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                    <button className="btn primary" disabled={busy || !reply.trim()} onClick={sendReply}><Icon name="send" size={13} />{busy ? 'Sending…' : 'Send reply'}</button>
                    <button className="btn" onClick={() => { setReplying(false); setReply(''); }}>Discard</button>
                    <span className="faint">Nothing is sent until you press Send.</span>
                  </div></>)}
              </div>
            </>)}
        </section>
      </div>

      {compose && (<>
        <div className="drawer-bg" onClick={() => setCompose(null)} aria-hidden="true" />
        <form className="drawer" onSubmit={send} role="dialog" aria-modal="true" aria-label="New message">
          <div className="dh"><span className="av" style={{ background: 'var(--primary)' }} aria-hidden="true"><Icon name="send" size={13} /></span><h2>New message</h2><button type="button" className="icon-btn" aria-label="Close" onClick={() => setCompose(null)}>✕</button></div>
          <div className="db">
            <div className="faint">From <b style={{ color: 'var(--ink)' }}>{st.email}</b></div>
            <label className="f">To<input type="email" required autoFocus placeholder="recruiter@company.com" value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })} /></label>
            <label className="f">Subject<input required placeholder="Application for Full Stack Developer" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} /></label>
            <label className="f" style={{ flex: 1, minHeight: 0 }}>Message<textarea required style={{ flex: 1 }} placeholder="Write your message" value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} /></label>
          </div>
          <div className="df">
            <button className="btn primary" disabled={busy}><Icon name="send" size={13} />{busy ? 'Sending…' : 'Send'}</button>
            <button type="button" className="btn" onClick={() => setCompose(null)}>Discard</button>
            <span className="faint" style={{ marginLeft: 'auto' }}>{live ? 'Plain text · 1 recipient' : 'Read-only mode: sending is off'}</span>
          </div>
        </form>
      </>)}
    </div>
  );
}
