'use client';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Dust, Nebula } from './parts';
import { COL, glass, icon, rr, txt, useTex } from './utils';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function Tag({ position, label, w = 1.7, phase = 0, color = COL.cyan }: { position: [number, number, number]; label: string; w?: number; phase?: number; color?: string }) {
  const g = useRef<THREE.Group>(null);
  const tex = useTex(448, 112, (c, tw, th) => { c.clearRect(0, 0, tw, th); glass(c, tw, th, 46, 0.95); c.fillStyle = color; c.beginPath(); c.arc(46, th / 2, 11, 0, Math.PI * 2); c.fill(); txt(c, label, 74, th / 2 + 14, 42, '#fff', 800, tw - 104); });
  useFrame((s) => { if (g.current) g.current.position.y = position[1] + Math.sin(s.clock.elapsedTime * 1.1 + phase) * 0.09; });
  return <group ref={g} position={position}><mesh><planeGeometry args={[w, w * 0.25]} /><meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} /></mesh></group>;
}

/** A scan beam that sweeps a panel (additive, cheap). */
function Beam({ w, y0, y1, speed = 0.5 }: { w: number; y0: number; y1: number; speed?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => { if (ref.current) ref.current.position.y = y0 + (y1 - y0) * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * speed * 2)); });
  return <mesh ref={ref} position={[0, y0, 0.05]}><planeGeometry args={[w, 0.07]} /><meshBasicMaterial color="#67e8f9" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>;
}

/** 3D resume hologram: scanned page, score ring, skill chips and a light platform. */
export function ResumeHologram({ lite }: { lite: boolean }) {
  const page = useRef<THREE.Group>(null);
  const resume = useTex(512, 700, (g, w, h) => {
    g.clearRect(0, 0, w, h); glass(g, w, h, 24, 0.9);
    g.fillStyle = 'rgba(103,232,249,.9)'; g.beginPath(); g.arc(80, 86, 38, 0, 6.3); g.fill(); txt(g, 'AG', 80, 99, 34, '#04101f', 800, undefined, 'center');
    txt(g, 'Full Stack Developer', 140, 78, 36, '#fff', 700, 330); txt(g, 'Node.js · React · MongoDB', 140, 114, 22, COL.mut, 500, 330);
    ['EXPERIENCE', 'PROJECTS', 'SKILLS'].forEach((s, i) => { const y = 200 + i * 160; txt(g, s, 40, y, 22, COL.cyan, 700); for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(255,255,255,.16)'; rr(g, 40, y + 22 + k * 30, 430 - k * 70, 10, 5); g.fill(); } });
    const bar = g.createLinearGradient(40, 0, 470, 0); bar.addColorStop(0, COL.blue); bar.addColorStop(1, COL.cyan); g.fillStyle = bar; rr(g, 40, 640, 330, 12, 6); g.fill();
  });
  const score = useTex(320, 320, (g, w, h) => {
    g.clearRect(0, 0, w, h); glass(g, w, h, 40, 0.9); g.lineWidth = 18; g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(w / 2, h / 2 - 8, 82, 0, 6.283); g.stroke();
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, COL.cyan); gr.addColorStop(1, COL.vio); g.strokeStyle = gr; g.lineCap = 'round'; g.beginPath(); g.arc(w / 2, h / 2 - 8, 82, -Math.PI / 2, -Math.PI / 2 + 6.283 * 0.92); g.stroke();
    txt(g, '92', w / 2, h / 2 + 12, 64, '#fff', 800, undefined, 'center'); txt(g, 'Resume score', w / 2, h - 34, 26, COL.mut, 500, undefined, 'center');
  });
  const frame = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.6, 3.55)), []);
  useEffect(() => () => frame.dispose(), [frame]);
  useFrame((s) => { if (page.current) page.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.5) * 0.28; });
  return (
    <group>
      <Nebula position={[0, 1, -12]} color="#6d28d9" size={60} opacity={0.35} />
      <group ref={page} position={[0, 0.5, 0]}>
        <mesh><planeGeometry args={[2.6, 3.55]} /><meshBasicMaterial map={resume} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <lineSegments geometry={frame}><lineBasicMaterial color="#22d3ee" /></lineSegments>
        <Beam w={2.7} y0={-1.7} y1={1.7} />
      </group>
      <mesh position={[-2.6, 1.1, 0.5]}><planeGeometry args={[1.5, 1.5]} /><meshBasicMaterial map={score} transparent toneMapped={false} depthWrite={false} /></mesh>
      {['Node.js', 'React', 'MongoDB', 'TypeScript', 'AWS'].map((l, i) => (<Tag key={l} label={`✓ ${l}`} position={[2.5 + (i % 2) * 0.5, 1.9 - i * 0.62, 0.5 + (i % 2) * 0.4]} phase={i} color={i === 4 ? COL.pink : COL.cyan} />))}
      <mesh position={[0, -1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.6, 1.68, 64]} /><meshBasicMaterial color="#22d3ee" transparent opacity={0.8} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.2, 2.24, 64]} /><meshBasicMaterial color="#8b5cf6" transparent opacity={0.6} side={THREE.DoubleSide} /></mesh>
      <gridHelper args={[14, 28, '#22d3ee', '#1e3a8a']} position={[0, -1.7, 0]} />
      <Dust count={lite ? 100 : 260} box={[14, 8, 8]} position={[0, 1, 0]} color="#c4b5fd" />
    </group>
  );
}

/** Job analysis: a "screenshot" is scanned, data streams across and a structured result appears. */
export function AnalysisScene({ lite }: { lite: boolean }) {
  const shot = useTex(480, 640, (g, w, h) => {
    g.clearRect(0, 0, w, h); glass(g, w, h, 24, 0.88); txt(g, 'Senior Node.js Engineer', 36, 84, 38, '#fff', 800, 410); txt(g, 'Zeta Cloud · Bengaluru', 36, 122, 26, COL.mut, 600);
    for (let i = 0; i < 12; i++) { g.fillStyle = i === 3 || i === 7 ? 'rgba(251,191,36,.55)' : 'rgba(255,255,255,.14)'; rr(g, 36, 160 + i * 38, 400 - ((i * 53) % 130), 12, 6); g.fill(); }
  });
  const result = useTex(480, 640, (g, w, h) => {
    g.clearRect(0, 0, w, h); glass(g, w, h, 24, 0.92); txt(g, 'AI extracted', 36, 74, 36, COL.cyan, 800);
    [['Role', 'Senior Node.js Engineer'], ['Company', 'Zeta Cloud'], ['Skills', 'Node, AWS, Docker'], ['Apply', 'careers@zeta…'], ['Fit', '92% match']].forEach(([k, v], i) => { const y = 130 + i * 92; g.fillStyle = 'rgba(255,255,255,.06)'; rr(g, 30, y - 36, w - 60, 72, 14); g.fill(); txt(g, k, 50, y - 8, 24, COL.mut, 700); txt(g, v, 50, y + 26, 34, '#fff', 800, w - 100); });
  });
  const n = lite ? 24 : 48; const dots = useRef<THREE.Points>(null);
  const pos = useMemo(() => new Float32Array(n * 3), [n]);
  useFrame((s) => {
    const t = s.clock.elapsedTime; for (let i = 0; i < n; i++) { const f = (t * 0.35 + i / n) % 1; pos[i * 3] = -1.0 + f * 2.0; pos[i * 3 + 1] = 0.3 + Math.sin(f * 6.28 * 2 + i) * 0.45 * (1 - Math.abs(f - 0.5) * 1.2); pos[i * 3 + 2] = Math.cos(i) * 0.3; }
    if (dots.current) dots.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <group>
      <Nebula position={[0, 0, -12]} color="#0e7490" size={60} opacity={0.3} />
      <group position={[-2.3, 0.3, 0]} rotation={[0, 0.22, 0]}>
        <mesh><planeGeometry args={[2.3, 3.07]} /><meshBasicMaterial map={shot} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <Beam w={2.2} y0={-1.3} y1={1.3} speed={0.7} />
      </group>
      <points ref={dots}><bufferGeometry><bufferAttribute attach="attributes-position" args={[pos, 3]} usage={THREE.DynamicDrawUsage} /></bufferGeometry><pointsMaterial size={0.07} color="#67e8f9" sizeAttenuation transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} /></points>
      <group position={[2.3, 0.3, 0]} rotation={[0, -0.22, 0]}><mesh><planeGeometry args={[2.3, 3.07]} /><meshBasicMaterial map={result} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} /></mesh></group>
      <Tag position={[0, 2.4, 0.2]} label="Reading screenshot" w={2.5} color={COL.cyan} />
      <Tag position={[0, -1.8, 0.2]} label="Skills matched" w={2.2} phase={1.4} color="#34d399" />
      <Dust count={lite ? 100 : 240} box={[16, 8, 8]} position={[0, 0.5, 0]} />
    </group>
  );
}

function Plane({ phase, speed }: { phase: number; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0.3, 0, 0, -0.2, 0.12, 0, -0.2, -0.12, 0, -0.2, 0.0, 0.1, -0.2, 0.12, 0]), 3)); g.setIndex([0, 1, 2, 0, 3, 1]); g.computeVertexNormals(); return g; }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((s) => { const m = ref.current; if (!m) return; const f = (s.clock.elapsedTime * speed + phase) % 1; m.position.set(-1.5 + f * 7.5, 0.9 + Math.sin(f * Math.PI) * 1.7, 1.2 - f * 3); m.rotation.z = Math.cos(f * Math.PI) * -0.5; m.rotation.y = 0.4; m.scale.setScalar(Math.sin(f * Math.PI) * 1.1 + 0.2); });
  return <mesh ref={ref} geometry={geo}><meshBasicMaterial color="#67e8f9" side={THREE.DoubleSide} /></mesh>;
}

/** Floating email window that "writes" itself, with paper planes flying out and a reply popping in. */
export function EmailScene({ lite }: { lite: boolean }) {
  const lines = useRef<(THREE.Mesh | null)[]>([]); const reply = useRef<THREE.Group>(null);
  const win = useTex(680, 460, (g, w, h) => {
    g.clearRect(0, 0, w, h); glass(g, w, h, 28, 0.92); [0, 1, 2].forEach((i) => { g.fillStyle = ['#fb7185', '#fbbf24', '#34d399'][i]; g.beginPath(); g.arc(40 + i * 28, 38, 8, 0, 6.3); g.fill(); });
    txt(g, 'To: hiring@zetacloud.example', 36, 96, 24, COL.mut, 500, 600); txt(g, 'Subject: Application — Senior Node.js Developer', 36, 134, 25, '#fff', 700, 610);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(36, 150, w - 72, 2);
    ['📄 Resume.pdf', '📎 Cover letter.pdf'].forEach((s, i) => { g.fillStyle = 'rgba(59,130,246,.25)'; rr(g, 36 + i * 190, 388, 176, 38, 12); g.fill(); txt(g, s, 50 + i * 190, 414, 20, '#cfe1ff', 600, 150); });
  });
  const send = useTex(256, 96, (g, w, h) => { g.clearRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, COL.blue); gr.addColorStop(1, COL.cyan); rr(g, 6, 6, w - 12, h - 12, 40); g.fillStyle = gr; g.fill(); txt(g, 'Approve & send', w / 2, 60, 30, '#04101f', 800, undefined, 'center'); });
  const rp = useTex(420, 150, (g, w, h) => { g.clearRect(0, 0, w, h); glass(g, w, h, 30, 0.95); icon(g, 'check', 56, h / 2, 70, '#34d399'); txt(g, 'Reply from HR', 110, 66, 28, '#fff', 700); txt(g, 'Interview invite · 28 Oct', 110, 106, 22, COL.mut, 500, 290); });
  useFrame((s) => {
    const t = s.clock.elapsedTime % 9;
    lines.current.forEach((m, i) => { if (m) { const k = clamp01(t * 1.1 - 0.6 - i * 0.55); m.scale.x = Math.max(0.001, k); m.position.x = -1.45 + (k * (2.9 - (i % 3) * 0.6)) / 2; } });
    if (reply.current) { const k = clamp01((t - 6.2) * 2.2); reply.current.scale.setScalar(Math.max(0.001, k)); }
  });
  return (
    <group>
      <Nebula position={[0, 1, -12]} color="#4c1d95" size={60} opacity={0.32} />
      <group position={[0, 0.4, 0]} rotation={[0, -0.18, 0]}>
        <mesh><planeGeometry args={[3.6, 2.44]} /><meshBasicMaterial map={win} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        {[0, 1, 2, 3, 4].map((i) => (<mesh key={i} ref={(el) => { lines.current[i] = el; }} position={[-1.45, 0.25 - i * 0.2, 0.02]}><planeGeometry args={[2.9 - (i % 3) * 0.6, 0.07]} /><meshBasicMaterial color="#9bd7ff" transparent opacity={0.85} /></mesh>))}
        <mesh position={[1.2, -1.45, 0.05]}><planeGeometry args={[1.2, 0.45]} /><meshBasicMaterial map={send} transparent toneMapped={false} /></mesh>
      </group>
      <group ref={reply} position={[2.4, -1.7, 0.9]}><mesh><planeGeometry args={[1.8, 0.64]} /><meshBasicMaterial map={rp} transparent toneMapped={false} depthWrite={false} /></mesh></group>
      {[0, 0.33, 0.66].map((p, i) => (<Plane key={i} phase={p} speed={0.16} />))}
      <Dust count={lite ? 100 : 240} box={[16, 9, 8]} position={[0, 0.5, 0]} color="#c4b5fd" />
    </group>
  );
}

/** Glowing journey line with four milestones, a travelling orb and an "Offer" star at the end. */
export function CareerJourney({ lite }: { lite: boolean }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(-4.8, -1.6, 0), new THREE.Vector3(-3, 0.5, -1), new THREE.Vector3(-1, -0.7, 0.4), new THREE.Vector3(1.3, 0.9, -1), new THREE.Vector3(3.2, 1.9, -0.5)]), []);
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 120, 0.04, 6, false), [curve]);
  const halo = useMemo(() => new THREE.TubeGeometry(curve, 120, 0.15, 8, false), [curve]);
  useEffect(() => () => { tube.dispose(); halo.dispose(); }, [tube, halo]);
  const orb = useRef<THREE.Mesh>(null); const star = useRef<THREE.Mesh>(null);
  const stops = useMemo(() => [0.04, 0.36, 0.66, 0.97].map((t, i) => ({ p: curve.getPointAt(t), label: ['1 · Profile', '2 · Find jobs', '3 · Apply', '4 · Interview'][i] })), [curve]);
  const offer = useTex(256, 96, (g, w, h) => { g.clearRect(0, 0, w, h); glass(g, w, h, 40, 0.95); txt(g, '★ Offer', w / 2, 66, 46, '#fde68a', 800, undefined, 'center'); });
  useFrame((s) => { const t = s.clock.elapsedTime; if (orb.current) orb.current.position.copy(curve.getPointAt((t * 0.07) % 1)); if (star.current) { star.current.rotation.y = t * 0.8; star.current.rotation.x = t * 0.4; } });
  return (
    <group>
      <Nebula position={[0, 1, -12]} color="#1e40af" size={64} opacity={0.35} />
      <mesh geometry={tube}><meshBasicMaterial color="#22d3ee" /></mesh>
      <mesh geometry={halo}><meshBasicMaterial color="#3b82f6" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
      {stops.map((s, i) => (
        <group key={i} position={s.p}>
          <mesh><sphereGeometry args={[0.2, 20, 16]} /><meshBasicMaterial color={i === 3 ? '#fde68a' : '#67e8f9'} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.36, 0.015, 6, 40]} /><meshBasicMaterial color="#8b5cf6" /></mesh>
          <Tag position={[0, 0.9, 0.2]} label={s.label} w={2.1} phase={i} color={i === 3 ? '#fde68a' : COL.cyan} />
        </group>
      ))}
      <mesh ref={orb}><sphereGeometry args={[0.13, 16, 16]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <mesh ref={star} position={[3.6, 2.1, -0.5]}><icosahedronGeometry args={[0.38, 0]} /><meshBasicMaterial color="#fde68a" wireframe /></mesh>
      <mesh position={[3.6, 2.9, -0.4]}><planeGeometry args={[1.3, 0.49]} /><meshBasicMaterial map={offer} transparent toneMapped={false} depthWrite={false} /></mesh>
      <Dust count={lite ? 140 : 360} box={[20, 10, 8]} position={[0, 0.8, 0]} color="#67e8f9" />
    </group>
  );
}
