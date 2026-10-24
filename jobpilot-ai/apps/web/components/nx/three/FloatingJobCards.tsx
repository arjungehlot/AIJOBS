'use client';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { COL, glass, makeTex, rr, SAMPLE_JOBS, txt } from './utils';

function jobTexture(t: string, c: string, l: string, s: number) {
  return makeTex(512, 300, (g, W, H) => {
    g.clearRect(0, 0, W, H); glass(g, W, H, 30, 0.93);
    const lg = g.createLinearGradient(30, 30, 110, 110); lg.addColorStop(0, COL.blue); lg.addColorStop(1, COL.vio); g.fillStyle = lg; g.beginPath(); g.arc(72, 76, 38, 0, Math.PI * 2); g.fill();
    txt(g, c[0], 72, 91, 40, '#fff', 800, undefined, 'center');
    txt(g, t, 124, 74, 34, COL.ink, 800, 360); txt(g, `${c} · ${l}`, 124, 112, 26, COL.mut, 600, 360);
    g.fillStyle = 'rgba(255,255,255,.1)'; rr(g, 34, 170, W - 68, 14, 7); g.fill();
    const bar = g.createLinearGradient(34, 0, W - 34, 0); bar.addColorStop(0, COL.blue); bar.addColorStop(1, COL.cyan); g.fillStyle = bar; rr(g, 34, 170, (W - 68) * (s / 100), 14, 7); g.fill();
    txt(g, `${s}%`, 34, 252, 46, '#67e8f9', 800); txt(g, 'AI match', 140, 252, 24, COL.mut, 500);
    g.fillStyle = 'rgba(34,211,238,.16)'; rr(g, W - 190, 214, 150, 44, 22); g.fill(); txt(g, 'Sample job', W - 115, 245, 21, '#8defff', 600, undefined, 'center');
  });
}

/** Job cards that orbit a centre point, each tied to it by a glowing line. */
export function FloatingJobCards({ center = [0, 0, 0], radius = 3.6, count = 6, speed = 1, lines = true }: { center?: [number, number, number]; radius?: number; count?: number; speed?: number; lines?: boolean }) {
  const jobs = SAMPLE_JOBS.slice(0, count);
  const tex = useMemo(() => jobs.map((j) => jobTexture(j.t, j.c, j.l, j.s)), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.forEach((t) => t.dispose()), [tex]);
  const refs = useRef<(THREE.Mesh | null)[]>([]); const linkRef = useRef<THREE.LineSegments>(null);
  const linkPos = useMemo(() => new Float32Array(jobs.length * 6), [jobs.length]);
  const orbit = useMemo(() => jobs.map((_, i) => ({ r: radius + (i % 3) * 0.45, sp: (0.1 + (i % 3) * 0.03) * (i % 2 ? -1 : 1) * speed, ph: (i / jobs.length) * Math.PI * 2, tilt: new THREE.Euler(0.4 - (i % 3) * 0.35, 0, (i % 2 ? 0.28 : -0.22)) })), [jobs.length, radius, speed]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    jobs.forEach((_, i) => {
      const m = refs.current[i]; if (!m) return; const o = orbit[i]; const a = o.ph + t * o.sp;
      tmp.set(Math.cos(a) * o.r, Math.sin(t * 0.7 + i) * 0.1, Math.sin(a) * o.r).applyEuler(o.tilt); m.position.copy(tmp);
      m.parent!.getWorldQuaternion(m.quaternion); m.quaternion.invert().multiply(s.camera.quaternion); // face the camera
      const k = i * 6; linkPos[k] = linkPos[k + 1] = linkPos[k + 2] = 0; linkPos[k + 3] = tmp.x; linkPos[k + 4] = tmp.y; linkPos[k + 5] = tmp.z;
    });
    if (linkRef.current) linkRef.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <group position={center}>
      {lines && <lineSegments ref={linkRef}><bufferGeometry><bufferAttribute attach="attributes-position" args={[linkPos, 3]} usage={THREE.DynamicDrawUsage} /></bufferGeometry><lineBasicMaterial color="#22d3ee" transparent opacity={0.32} /></lineSegments>}
      {jobs.map((_, i) => (<mesh key={i} ref={(el) => { refs.current[i] = el; }} renderOrder={3}><planeGeometry args={[1.5, 0.88]} /><meshBasicMaterial map={tex[i]} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} /></mesh>))}
    </group>
  );
}
