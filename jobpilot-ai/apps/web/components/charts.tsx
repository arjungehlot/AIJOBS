/* Dependency-free SVG charts. All colours are CSS-independent so they print and export cleanly. */

export const PALETTE = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#F43F5E', '#64748B'];

const niceMax = (m: number) => {
  if (m <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  const n = m / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

export function Sparkline({ data, color = '#4F46E5', w = 72, h = 26 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2 || data.every((v) => v === 0)) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * (w - 4) + 2, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const id = `sp${color.slice(1)}${data.length}`;
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Trend">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${w - 2},${h} L2,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface Series { name: string; color: string; values: number[] }

/** Grouped bars or a line+area per series. */
export function BarChart({ labels, series, height = 190, width = 640, kind = 'bar' }: { labels: string[]; series: Series[]; height?: number; width?: number; kind?: 'bar' | 'line' }) {
  const W = width, H = height, L = 30, B = 22, T = 8, R = 6;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const iw = W - L - R, ih = H - T - B, n = labels.length;
  const step = iw / n;
  const y = (v: number) => T + ih - (v / max) * ih;
  const every = Math.ceil(n / 8);
  const grid = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={series.map((s) => s.name).join(' and ') + ' over time'} style={{ display: 'block' }}>
      {grid.map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={y(g * max)} y2={y(g * max)} stroke="#E8ECF4" strokeDasharray={g ? '3 4' : undefined} />
          <text x={L - 6} y={y(g * max) + 3} textAnchor="end" fontSize="10" fill="#6B7A93">{Math.round(g * max)}</text>
        </g>
      ))}
      {kind === 'bar' && series.map((s, si) => {
        const bw = Math.min(22, (step * 0.7) / series.length);
        return s.values.map((v, i) => {
          const x = L + i * step + (step - bw * series.length) / 2 + si * bw;
          return <rect key={`${si}-${i}`} x={x} y={y(v)} width={bw - 2} height={Math.max(0, T + ih - y(v))} rx="3" fill={s.color}><title>{`${s.name}: ${v} (${labels[i]})`}</title></rect>;
        });
      })}
      {kind === 'line' && series.map((s, si) => {
        const pts = s.values.map((v, i) => [L + i * step + step / 2, y(v)]);
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        const id = `ar${si}${s.color.slice(1)}`;
        return (
          <g key={si}>
            <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".22" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient></defs>
            <path d={`${d} L${pts[pts.length - 1][0]},${T + ih} L${pts[0][0]},${T + ih} Z`} fill={`url(#${id})`} />
            <path d={d} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.6" fill="#fff" stroke={s.color} strokeWidth="1.8"><title>{`${s.name}: ${s.values[i]} (${labels[i]})`}</title></circle>)}
          </g>
        );
      })}
      {labels.map((l, i) => i % every === 0 && (
        <text key={i} x={L + i * step + step / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#6B7A93">{l}</text>
      ))}
    </svg>
  );
}

export function Donut({ parts, center, sub, size = 130 }: { parts: { label: string; value: number; color: string }[]; center: string; sub: string; size?: number }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = 44, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`${sub}: ${total}`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#EEF1F7" strokeWidth="13" />
      {total > 0 && parts.filter((p) => p.value > 0).map((p) => {
        const len = (p.value / total) * C;
        const el = <circle key={p.label} cx="60" cy="60" r={r} fill="none" stroke={p.color} strokeWidth="13" strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 60 60)"><title>{`${p.label}: ${p.value}`}</title></circle>;
        acc += len; return el;
      })}
      <text x="60" y="59" textAnchor="middle" fontSize="20" fontWeight="700" fill="#0F172A">{center}</text>
      <text x="60" y="74" textAnchor="middle" fontSize="9" fill="#6B7A93">{sub}</text>
    </svg>
  );
}

/** Ring gauge for a 0-100 score. */
export function Gauge({ value, label, color = '#4F46E5', size = 92 }: { value: number; label: string; color?: string; size?: number }) {
  const r = 40, C = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${label}: ${value} of 100`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#EEF1F7" strokeWidth="10" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(value / 100) * C} ${C}`} transform="rotate(-90 50 50)" />
      <text x="50" y="54" textAnchor="middle" fontSize="24" fontWeight="700" fill="#0F172A">{value}</text>
      <text x="50" y="68" textAnchor="middle" fontSize="8" fill="#6B7A93">of 100</text>
    </svg>
  );
}

/** Horizontal funnel with step-to-step conversion. */
export function Funnel({ stages }: { stages: { stage: string; count: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div>
      {stages.map((s, i) => {
        const prev = i ? stages[i - 1].count : 0;
        const conv = i && prev ? Math.round((s.count / prev) * 100) : null;
        return (
          <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
            <span style={{ flex: '0 0 76px', fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500 }}>{s.stage}</span>
            <div style={{ flex: 1, height: 15, background: 'var(--line-2)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(s.count ? 3 : 0, (s.count / max) * 100)}%`, height: '100%', borderRadius: 6, background: `linear-gradient(90deg, ${PALETTE[0]}, ${PALETTE[1]})`, opacity: 1 - i * 0.07 }} />
            </div>
            <b style={{ flex: '0 0 32px', textAlign: 'right' }}>{s.count}</b>
            <span className="faint" style={{ flex: '0 0 38px', textAlign: 'right' }}>{conv === null ? '' : `${conv}%`}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: number }[] }) {
  return <div className="legend">{items.map((i) => <span key={i.label}><i style={{ background: i.color }} />{i.label}{i.value !== undefined ? ` · ${i.value}` : ''}</span>)}</div>;
}
