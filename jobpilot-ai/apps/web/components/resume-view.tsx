import type { ReactNode } from 'react';

type Block = { k: 'h'; t: string } | { k: 'title'; t: string } | { k: 'tech'; t: string[] } | { k: 'b'; t: string } | { k: 'skill'; label: string; t: string } | { k: 'p'; t: string };
const HEAD = /^[A-Z][A-Z0-9 &/+,\-]{2,34}$/;
const BULLET = /^[•▪◦●\-*–—]\s+/;
const SKILL_LABELS = ['Frontend', 'Backend', 'Database', 'Databases', 'Languages', 'Language', 'Platforms', 'Platform', 'Tools', 'Tool', 'Cloud', 'DevOps', 'Frameworks', 'Libraries', 'Testing', 'Soft Skills', 'Technical Skills', 'Core Skills', 'Skills'];
const isTech = (s: string) => s.includes(' · ') || (s.split(',').length >= 4 && s.length < 160 && !BULLET.test(s));

function parse(text: string) {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim());
  const firstHead = lines.findIndex((l) => HEAD.test(l));
  const top = (firstHead === -1 ? lines.slice(0, 4) : lines.slice(0, firstHead)).filter(Boolean);
  const rest = firstHead === -1 ? lines.slice(top.length) : lines.slice(firstHead);
  const name = top[0] ?? ''; const headline = top[1] && !/[@|+]/.test(top[1]) ? top[1] : '';
  const contact = top.slice(headline ? 2 : 1).join(' | ').split(/\s*\|\s*|\s{2,}/).map((s) => s.trim()).filter(Boolean);
  const blocks: Block[] = []; let section = '';
  const body = rest.filter((l) => l !== '');
  body.forEach((l, i) => {
    const next = body[i + 1] ?? '';
    if (HEAD.test(l)) { section = l; blocks.push({ k: 'h', t: l }); return; }
    if (BULLET.test(l)) { blocks.push({ k: 'b', t: l.replace(BULLET, '') }); return; }
    if (isTech(l) && !/^(frontend|backend|database|languages?|tools?)\b/i.test(l)) { blocks.push({ k: 'tech', t: l.split(/\s·\s|,\s*/).map((s) => s.trim()).filter(Boolean) }); return; }
    if (/SKILL/.test(section)) {
      const lab = SKILL_LABELS.find((x) => l.toLowerCase().startsWith(x.toLowerCase() + ' '));
      if (lab) {
        // "Languages C++, … Platforms AWS …" can hold several labels on one line: split on each known label.
        const re = new RegExp(`\\b(${SKILL_LABELS.join('|')})\\b\\s+`, 'g'); const parts: { label: string; t: string }[] = []; let m: RegExpExecArray | null; let last: { label: string; start: number } | null = null;
        while ((m = re.exec(l))) { if (last) parts.push({ label: last.label, t: l.slice(last.start, m.index).trim() }); last = { label: m[1], start: m.index + m[0].length }; }
        if (last) parts.push({ label: last.label, t: l.slice(last.start).trim() });
        parts.forEach((p) => blocks.push({ k: 'skill', label: p.label, t: p.t }));
        return;
      }
    }
    if (isTech(next) || BULLET.test(next)) { blocks.push({ k: 'title', t: l }); return; }
    blocks.push({ k: 'p', t: l });
  });
  return { name, headline, contact, blocks };
}

function Chips({ items, tone }: { items: string[]; tone?: 'tech' }) {
  return <span className={`rv-chips ${tone ?? ''}`}>{items.map((s, i) => <span key={i}>{s}</span>)}</span>;
}

export function ResumeView({ text }: { text: string }) {
  const { name, headline, contact, blocks } = parse(text);
  const out: ReactNode[] = []; let bullets: string[] = [];
  const flush = () => { if (bullets.length) { out.push(<ul key={`u${out.length}`} className="rv-ul">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>); bullets = []; } };
  blocks.forEach((b, i) => {
    if (b.k === 'b') { bullets.push(b.t); return; }
    flush();
    if (b.k === 'h') out.push(<h3 key={i} className="rv-h">{b.t.charAt(0) + b.t.slice(1).toLowerCase()}</h3>);
    else if (b.k === 'title') out.push(<div key={i} className="rv-title">{b.t}</div>);
    else if (b.k === 'tech') out.push(<Chips key={i} items={b.t} tone="tech" />);
    else if (b.k === 'skill') out.push(<div key={i} className="rv-skill"><b>{b.label}</b><Chips items={b.t.split(/,\s*|\s{2,}/).map((s) => s.trim()).filter(Boolean)} /></div>);
    else out.push(<p key={i} className="rv-p">{b.t}</p>);
  });
  flush();
  return (
    <article className="rv">
      <header className="rv-top">
        <h2>{name}</h2>
        {headline && <div className="rv-headline">{headline.split('·').map((s) => s.trim()).filter(Boolean).join('  ·  ')}</div>}
        {contact.length > 0 && <div className="rv-contact">{contact.map((c, i) => <span key={i}>{c}</span>)}</div>}
      </header>
      {out}
    </article>
  );
}
