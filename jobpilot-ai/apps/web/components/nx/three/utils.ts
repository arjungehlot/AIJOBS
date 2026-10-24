import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export type Ctx = CanvasRenderingContext2D;
export const COL = { cyan: '#22d3ee', blue: '#3b82f6', vio: '#8b5cf6', ink: '#e8eeff', mut: '#93a4cf', pink: '#f0abfc' };

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export function makeTex(w: number, h: number, draw: (g: Ctx, w: number, h: number) => void) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** Canvas-drawn texture, created once and disposed on unmount. Nothing is downloaded. */
export function useTex(w: number, h: number, draw: (g: Ctx, w: number, h: number) => void) {
  const tex = useMemo(() => makeTex(w, h, draw), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** Dark glass card with a cyan→violet border. */
export function glass(g: Ctx, w: number, h: number, r = 28, alpha = 0.9) {
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, `rgba(12,22,56,${alpha})`); bg.addColorStop(1, `rgba(28,18,70,${alpha})`);
  rr(g, 5, 5, w - 10, h - 10, r); g.fillStyle = bg; g.fill();
  const bd = g.createLinearGradient(0, 0, w, 0); bd.addColorStop(0, COL.cyan); bd.addColorStop(1, COL.vio); g.lineWidth = 3; g.strokeStyle = bd; g.stroke();
}
export function txt(g: Ctx, s: string, x: number, y: number, size: number, color = COL.ink, weight = 600, maxW?: number, align: CanvasTextAlign = 'left') {
  const font = (n: number) => `${weight} ${n}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  let n = size; g.font = font(n);
  if (maxW) while (g.measureText(s).width > maxW && n > size * 0.5) { n -= 2; g.font = font(n); } // shrink to fit, never cut the words
  g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y);
}
export type IconKind = 'doc' | 'search' | 'mail' | 'target' | 'check' | 'spark';
export function icon(g: Ctx, kind: IconKind, cx: number, cy: number, s: number, color = COL.cyan) {
  g.save(); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = Math.max(3, s * 0.07); g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'doc') { rr(g, cx - s * 0.32, cy - s * 0.42, s * 0.64, s * 0.84, s * 0.08); g.stroke(); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - s * 0.18, cy - s * 0.15 + i * s * 0.17); g.lineTo(cx + s * 0.18, cy - s * 0.15 + i * s * 0.17); g.stroke(); } }
  if (kind === 'search') { g.beginPath(); g.arc(cx - s * 0.06, cy - s * 0.06, s * 0.3, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(cx + s * 0.16, cy + s * 0.16); g.lineTo(cx + s * 0.4, cy + s * 0.4); g.stroke(); }
  if (kind === 'mail') { rr(g, cx - s * 0.42, cy - s * 0.3, s * 0.84, s * 0.6, s * 0.06); g.stroke(); g.beginPath(); g.moveTo(cx - s * 0.42, cy - s * 0.26); g.lineTo(cx, cy + s * 0.08); g.lineTo(cx + s * 0.42, cy - s * 0.26); g.stroke(); }
  if (kind === 'target') { for (const r of [0.4, 0.24, 0.08]) { g.beginPath(); g.arc(cx, cy, s * r, 0, Math.PI * 2); g.stroke(); } }
  if (kind === 'check') { g.beginPath(); g.moveTo(cx - s * 0.3, cy); g.lineTo(cx - s * 0.08, cy + s * 0.24); g.lineTo(cx + s * 0.32, cy - s * 0.24); g.stroke(); }
  if (kind === 'spark') { g.beginPath(); g.moveTo(cx, cy - s * 0.42); g.lineTo(cx + s * 0.1, cy - s * 0.1); g.lineTo(cx + s * 0.42, cy); g.lineTo(cx + s * 0.1, cy + s * 0.1); g.lineTo(cx, cy + s * 0.42); g.lineTo(cx - s * 0.1, cy + s * 0.1); g.lineTo(cx - s * 0.42, cy); g.lineTo(cx - s * 0.1, cy - s * 0.1); g.closePath(); g.stroke(); }
  g.restore();
}

/** Fresnel rim glow shared by planets, globe and orbs. */
export const GLOW_V = `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
export const GLOW_F = `varying vec3 vN; varying vec3 vV; uniform vec3 uA; uniform vec3 uB; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4); gl_FragColor = vec4(mix(uA, uB, f), f * 0.95 + 0.05); }`;
export const glowUniforms = (a: string, b: string) => ({ uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) } });

export const SAMPLE_JOBS = [
  { t: 'Senior React Engineer', c: 'Northwind', l: 'Remote', s: 94 },
  { t: 'Node.js Backend Developer', c: 'Zeta Cloud', l: 'Bengaluru', s: 91 },
  { t: 'Full Stack Engineer', c: 'Brightpay', l: 'Hybrid', s: 88 },
  { t: 'AI Platform Engineer', c: 'Helix Labs', l: 'Remote', s: 86 },
  { t: 'DevOps Engineer', c: 'Skyline', l: 'Pune', s: 82 },
  { t: 'Frontend Developer', c: 'Orbitly', l: 'London', s: 79 },
];
