'use client';
/**
 * Hero 3D scene: a holographic data globe with orbiting job cards, drifting particles and glowing links.
 * Everything is generated locally (no model calls, no network, no font or texture downloads).
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const CARDS = [
  { t: 'Senior React Engineer', c: 'Northwind · Remote', s: 94 },
  { t: 'Node.js Backend Developer', c: 'Zeta Cloud · Bengaluru', s: 91 },
  { t: 'Full Stack Engineer', c: 'Brightpay · Hybrid', s: 88 },
  { t: 'AI Platform Engineer', c: 'Sample Labs · Remote', s: 86 },
  { t: 'DevOps Engineer', c: 'Skyline · Pune', s: 82 },
  { t: 'Frontend Developer', c: 'Orbitly · London', s: 79 },
];
const GLOBE_R = 1.25;

function cardTexture(t: string, c: string, s: number) {
  const W = 512, H = 300; const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const rr = (x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, 'rgba(14,24,56,.94)'); bg.addColorStop(1, 'rgba(26,18,64,.94)');
  rr(6, 6, W - 12, H - 12, 28); g.fillStyle = bg; g.fill();
  const bd = g.createLinearGradient(0, 0, W, 0); bd.addColorStop(0, '#22d3ee'); bd.addColorStop(1, '#8b5cf6'); g.lineWidth = 3; g.strokeStyle = bd; g.stroke();
  g.fillStyle = '#e8eeff'; g.font = '700 34px system-ui, sans-serif'; g.textBaseline = 'alphabetic'; g.fillText(t.length > 24 ? t.slice(0, 23) + '…' : t, 32, 82);
  g.fillStyle = '#93a4cf'; g.font = '500 25px system-ui, sans-serif'; g.fillText(c, 32, 122);
  g.fillStyle = 'rgba(255,255,255,.1)'; rr(32, 168, W - 64, 14, 7); g.fill();
  const bar = g.createLinearGradient(32, 0, W - 32, 0); bar.addColorStop(0, '#3b82f6'); bar.addColorStop(1, '#22d3ee');
  rr(32, 168, (W - 64) * (s / 100), 14, 7); g.fillStyle = bar; g.fill();
  g.fillStyle = '#67e8f9'; g.font = '700 46px system-ui, sans-serif'; g.fillText(`${s}%`, 32, 252);
  g.fillStyle = '#93a4cf'; g.font = '500 24px system-ui, sans-serif'; g.fillText('AI match', 140, 252);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}

function fibonacci(n: number, r: number) {
  const a = new Float32Array(n * 3); const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 2; const rad = Math.sqrt(1 - y * y); const th = phi * i; a.set([Math.cos(th) * rad * r, y * r, Math.sin(th) * rad * r], i * 3); }
  return a;
}
function shell(n: number, rMin: number, rMax: number) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1; const th = Math.random() * Math.PI * 2; const rad = Math.sqrt(1 - u * u); const r = rMin + Math.random() * (rMax - rMin); a.set([Math.cos(th) * rad * r, u * r, Math.sin(th) * rad * r], i * 3); }
  return a;
}

const GLOW_V = `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const GLOW_F = `varying vec3 vN; varying vec3 vV; uniform vec3 uA; uniform vec3 uB; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4); gl_FragColor = vec4(mix(uA, uB, f), f * 0.95 + 0.06); }`;

function World({ lite, active }: { lite: boolean; active: boolean }) {
  const globe = useRef<THREE.Group>(null); const dust = useRef<THREE.Points>(null); const links = useRef<THREE.LineSegments>(null);
  const cardRefs = useRef<(THREE.Mesh | null)[]>([]);
  const dots = useMemo(() => fibonacci(lite ? 380 : 760, GLOBE_R + 0.012), [lite]);
  const specks = useMemo(() => shell(lite ? 220 : 520, 2.6, 6), [lite]);
  const textures = useMemo(() => CARDS.map((c) => cardTexture(c.t, c.c, c.s)), []);
  const linkPos = useMemo(() => new Float32Array(CARDS.length * 6), []);
  const uniforms = useMemo(() => ({ uA: { value: new THREE.Color('#1d4ed8') }, uB: { value: new THREE.Color('#22d3ee') } }), []);
  const orbit = useMemo(() => CARDS.map((_, i) => ({ r: 2.15 + (i % 3) * 0.42, speed: (0.1 + (i % 3) * 0.035) * (i % 2 ? -1 : 1), phase: (i / CARDS.length) * Math.PI * 2, tilt: new THREE.Euler(0.45 - (i % 3) * 0.4, 0, (i % 2 ? 0.3 : -0.25) + i * 0.05) })), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);

  useFrame((state, dt) => {
    if (!active) return;
    const d = Math.min(dt, 0.05); const t = state.clock.elapsedTime;
    if (globe.current) globe.current.rotation.y += d * 0.12;
    if (dust.current) { dust.current.rotation.y -= d * 0.015; dust.current.rotation.x += d * 0.004; }
    CARDS.forEach((_, i) => {
      const m = cardRefs.current[i]; if (!m) return; const o = orbit[i]; const a = o.phase + t * o.speed;
      tmp.set(Math.cos(a) * o.r, Math.sin(t * 0.6 + i) * 0.08, Math.sin(a) * o.r).applyEuler(o.tilt);
      m.position.copy(tmp); m.quaternion.copy(state.camera.quaternion);
      const k = i * 6; tmp.normalize().multiplyScalar(GLOBE_R);
      linkPos[k] = tmp.x; linkPos[k + 1] = tmp.y; linkPos[k + 2] = tmp.z; linkPos[k + 3] = m.position.x; linkPos[k + 4] = m.position.y; linkPos[k + 5] = m.position.z;
    });
    if (links.current) links.current.geometry.attributes.position.needsUpdate = true;
    // Smooth camera drift that follows the pointer.
    const cam = state.camera; cam.position.x += (state.pointer.x * 0.7 - cam.position.x) * 0.04; cam.position.y += (state.pointer.y * 0.45 - cam.position.y) * 0.04; cam.lookAt(0, 0, 0);
  });

  return (
    <>
      <group ref={globe} rotation={[0.25, 0, 0.1]}>
        <mesh><sphereGeometry args={[GLOBE_R - 0.03, 48, 48]} /><meshBasicMaterial color="#060b1f" /></mesh>
        <mesh><sphereGeometry args={[GLOBE_R, 24, 16]} /><meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.14} /></mesh>
        <points>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[dots, 3]} /></bufferGeometry>
          <pointsMaterial size={0.024} color="#67e8f9" sizeAttenuation transparent opacity={0.95} depthWrite={false} />
        </points>
      </group>
      <mesh scale={1.16}><sphereGeometry args={[GLOBE_R, 48, 48]} /><shaderMaterial uniforms={uniforms} vertexShader={GLOW_V} fragmentShader={GLOW_F} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide} /></mesh>
      {[2.15, 2.57, 2.99].map((r, i) => (
        <mesh key={r} rotation={orbit[i].tilt}><torusGeometry args={[r, 0.0035, 6, 160]} /><meshBasicMaterial color={i === 1 ? '#8b5cf6' : '#3b82f6'} transparent opacity={0.28} /></mesh>
      ))}
      <lineSegments ref={links}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[linkPos, 3]} usage={THREE.DynamicDrawUsage} /></bufferGeometry>
        <lineBasicMaterial color="#22d3ee" transparent opacity={0.4} />
      </lineSegments>
      {CARDS.map((_, i) => (
        <mesh key={i} ref={(el) => { cardRefs.current[i] = el; }} renderOrder={2}>
          <planeGeometry args={[1.28, 0.75]} /><meshBasicMaterial map={textures[i]} transparent toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <points ref={dust}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[specks, 3]} /></bufferGeometry>
        <pointsMaterial size={0.02} color="#a78bfa" sizeAttenuation transparent opacity={0.7} depthWrite={false} />
      </points>
    </>
  );
}

export default function Scene({ active, lite, onReady, onFail }: { active: boolean; lite: boolean; onReady: () => void; onFail: () => void }) {
  const [dpr, setDpr] = useState(Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, lite ? 1.5 : 1.75));
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'} dpr={dpr} camera={{ position: [0, 0, lite ? 7.4 : 6.4], fov: 45 }}
      gl={{ antialias: !lite, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onFail(); }); onReady(); }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)}>
        <World lite={lite} active={active} />
      </PerformanceMonitor>
    </Canvas>
  );
}
