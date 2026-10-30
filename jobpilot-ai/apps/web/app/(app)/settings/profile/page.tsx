'use client';
import { useEffect, useRef, useState } from 'react';
import { api, errText } from '@/lib/api';

type Me = { name: string; email: string; plan: string; role?: string; image: string | null; hasCustomImage: boolean };

/** Crops to a centred square and shrinks to 256 px so the stored photo stays small (about 20 KB). */
async function toAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read that image')); i.src = url; });
    const side = Math.min(img.width, img.height); const c = document.createElement('canvas'); c.width = c.height = 256;
    c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

export default function Profile() {
  const [me, setMe] = useState<Me | null>(null); const [name, setName] = useState('');
  const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { api<Me>('/auth/me').then((m) => { setMe(m); setName(m.name); }).catch((e) => setErr(errText(e))); }, []);

  const done = (m: Me, msg: string) => { setMe(m); setName(m.name); setOk(msg); window.dispatchEvent(new Event('jobpilot:profile')); };
  async function saveName() { setBusy('name'); setErr(''); setOk(''); try { done(await api('/auth/profile', { method: 'PATCH', body: { name } }), 'Name saved.'); } catch (e) { setErr(errText(e)); } finally { setBusy(''); } }
  async function upload(f?: File) {
    if (!f) return; setErr(''); setOk('');
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setErr('Choose a JPEG, PNG or WebP image.'); return; }
    setBusy('img');
    try { done(await api('/auth/avatar', { method: 'PUT', body: { image: await toAvatar(f) } }), 'Photo updated.'); } catch (e) { setErr(e instanceof Error && !('status' in e) ? e.message : errText(e)); } finally { setBusy(''); }
  }
  async function remove() { setBusy('img'); setErr(''); setOk(''); try { done(await api('/auth/avatar', { method: 'DELETE' }), 'Custom photo removed.'); } catch (e) { setErr(errText(e)); } finally { setBusy(''); } }

  const initials = (me?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="stack" style={{ gap: 14, maxWidth: 640 }}>
      <div className="ph"><div><h1>My profile</h1><p>Your name and photo. If you signed in with Google, your Google photo is used until you upload your own.</p></div></div>
      {err && <div className="msg err" role="alert">{err}</div>}{ok && <div className="msg ok" role="status">{ok}</div>}
      <section className="card stack" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {me?.image ? <img src={me.image} alt="" referrerPolicy="no-referrer" width={84} height={84} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <div className="avatar" style={{ width: 84, height: 84, fontSize: 28 }} aria-hidden="true">{initials}</div>}
          <div className="stack" style={{ gap: 8 }}>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={() => file.current?.click()} disabled={busy === 'img'}>{busy === 'img' ? 'Saving…' : 'Upload new photo'}</button>
              {me?.hasCustomImage && <button className="btn" onClick={remove} disabled={busy === 'img'}>Use Google photo</button>}
            </div>
            <span className="faint">JPEG, PNG or WebP. It is cropped to a square automatically.</span>
          </div>
        </div>
        <label className="f">Full name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
        <label className="f">Email<input value={me?.email ?? ''} disabled readOnly /><span className="faint">Your sign-in email cannot be changed here.</span></label>
        <div><button className="btn primary" onClick={saveName} disabled={busy === 'name' || !name.trim() || name === me?.name}>{busy === 'name' ? 'Saving…' : 'Save name'}</button></div>
      </section>
    </div>
  );
}
