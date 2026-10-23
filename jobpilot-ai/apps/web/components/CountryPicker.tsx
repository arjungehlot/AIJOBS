'use client';
import { useEffect, useRef, useState } from 'react';

export interface CountryOpt { code: string; name: string }

/** Multi-select country dropdown with search and an "include worldwide remote" switch. */
export function CountryPicker({ options, value, onChange, worldwide, onWorldwide }: {
  options: CountryOpt[]; value: string[]; onChange: (v: string[]) => void; worldwide: boolean; onWorldwide: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, []);
  const name = (c: string) => options.find((o) => o.code === c)?.name ?? c;
  const label = value.length === 0 ? 'Any country' : value.length === 1 ? name(value[0]) : `${name(value[0])} +${value.length - 1}`;
  const shown = options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  return (
    <div className="ctry" ref={box}>
      <button type="button" className={`ctry-btn${value.length ? ' on' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        <span>{label}</span><span className="ctry-caret">▾</span>
      </button>
      {open && (
        <div className="ctry-pop" role="listbox" aria-multiselectable="true">
          <input className="ctry-q" autoFocus placeholder="Search countries" value={q} onChange={(e) => setQ(e.target.value)} />
          {value.length > 0 && <div className="ctry-chips">{value.map((c) => <button type="button" key={c} onClick={() => toggle(c)}>{name(c)} ×</button>)}<button type="button" className="clr" onClick={() => onChange([])}>Clear</button></div>}
          <div className="ctry-list">
            {shown.map((o) => (
              <label key={o.code} className="ctry-i"><input type="checkbox" checked={value.includes(o.code)} onChange={() => toggle(o.code)} />{o.name}</label>
            ))}
            {shown.length === 0 && <div className="ctry-none">No match</div>}
          </div>
          <label className="ctry-ww"><input type="checkbox" checked={worldwide} onChange={(e) => onWorldwide(e.target.checked)} disabled={value.length === 0} />Also show worldwide / anywhere remote jobs</label>
        </div>
      )}
    </div>
  );
}
