'use client';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FloatingJobCards } from './FloatingJobCards';
import { Dust, Nebula } from './parts';
import { GLOW_F, GLOW_V, glowUniforms, rng } from './utils';

const R = 2.3;

function Ping({ p, delay }: { p: THREE.Vector3; delay: number }) {
  const ring = useRef<THREE.Mesh>(null); const mat = useRef<THREE.MeshBasicMaterial>(null);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize()), [p]);
  useFrame((s) => { const f = ((s.clock.elapsedTime * 0.5 + delay) % 1); if (ring.current) ring.current.scale.setScalar(0.4 + f * 2.2); if (mat.current) mat.current.opacity = (1 - f) * 0.8; });
  return <group position={p} quaternion={q}><mesh ref={ring}><ringGeometry args={[0.1, 0.12, 32]} /><meshBasicMaterial ref={mat} color="#22d3ee" transparent depthWrite={false} side={THREE.DoubleSide} /></mesh></group>;
}

/** Interactive-looking globe: glowing land dots, animated connection arcs with travelling pulses, match pings and orbiting job cards. */
export function JobGlobe({ lite }: { lite: boolean }) {
  const globe = useRef<THREE.Group>(null); const pulses = useRef<(THREE.Mesh | null)[]>([]);
  const gu = useMemo(() => glowUniforms('#1d4ed8', '#22d3ee'), []);
  const { land, ocean } = useMemo(() => {
    const n = lite ? 1000 : 2500; const land: number[] = []; const ocean: number[] = []; const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * i) / (n - 1); const rad = Math.sqrt(1 - y * y); const th = phi * i; const x = Math.cos(th) * rad; const z = Math.sin(th) * rad;
      const lat = Math.asin(y); const lon = Math.atan2(z, x);
      const v = Math.sin(lon * 2 + 1.2) * Math.cos(lat * 1.6) + 0.7 * Math.sin(lat * 4 - lon * 1.5) + 0.4 * Math.sin(lon * 5 + lat * 3);
      (v > 0.35 ? land : ocean).push(x * R, y * R, z * R);
    }
    return { land: new Float32Array(land), ocean: new Float32Array(ocean) };
  }, [lite]);
  const arcs = useMemo(() => {
    const Rn = rng(11); const n = lite ? 6 : 10; const pts = land.length / 3;
    const pick = () => { const k = Math.floor(Rn() * pts) * 3; return new THREE.Vector3(land[k], land[k + 1], land[k + 2]); };
    return Array.from({ length: n }, (_, i) => {
      const a = pick(); const b = pick(); const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1.3 + Rn() * 0.35));
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), new THREE.LineBasicMaterial({ color: i % 3 === 0 ? '#a78bfa' : '#22d3ee', transparent: true, opacity: 0.5 }));
      return { a, b, curve, line, sp: 0.12 + Rn() * 0.12, ph: Rn() };
    });
  }, [land, lite]);
  useEffect(() => () => arcs.forEach((a) => { a.line.geometry.dispose(); (a.line.material as THREE.Material).dispose(); }), [arcs]);
  const ends = useMemo(() => { const p = new Float32Array(arcs.length * 6); arcs.forEach((a, i) => p.set([a.a.x, a.a.y, a.a.z, a.b.x, a.b.y, a.b.z], i * 6)); return p; }, [arcs]);
  useFrame((s) => {
    const t = s.clock.elapsedTime; if (globe.current) globe.current.rotation.y = t * 0.1;
    arcs.forEach((a, i) => { const m = pulses.current[i]; if (m) m.position.copy(a.curve.getPoint((t * a.sp + a.ph) % 1)); });
  });
  return (
    <group>
      <Nebula position={[0, 0, -14]} color="#1d4ed8" size={60} opacity={0.35} />
      <group ref={globe} rotation={[0.35, 0, 0.12]}>
        <mesh><sphereGeometry args={[R - 0.03, 48, 40]} /><meshBasicMaterial color="#050c24" /></mesh>
        <mesh><sphereGeometry args={[R, 28, 18]} /><meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.1} /></mesh>
        <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[ocean, 3]} /></bufferGeometry><pointsMaterial size={0.02} color="#2563eb" sizeAttenuation transparent opacity={0.55} depthWrite={false} /></points>
        <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[land, 3]} /></bufferGeometry><pointsMaterial size={0.035} color="#67e8f9" sizeAttenuation transparent opacity={0.95} depthWrite={false} /></points>
        <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[ends, 3]} /></bufferGeometry><pointsMaterial size={0.09} color="#ffffff" sizeAttenuation transparent depthWrite={false} /></points>
        {arcs.map((a, i) => (<primitive key={i} object={a.line} />))}
        {arcs.map((_, i) => (<mesh key={`p${i}`} ref={(el) => { pulses.current[i] = el; }}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>))}
        {arcs.slice(0, 4).map((a, i) => (<Ping key={i} p={a.a} delay={i * 0.25} />))}
      </group>
      <mesh scale={1.17}><sphereGeometry args={[R, 48, 40]} /><shaderMaterial uniforms={gu} vertexShader={GLOW_V} fragmentShader={GLOW_F} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide} /></mesh>
      <mesh rotation={[Math.PI / 2 + 0.2, 0, 0]}><torusGeometry args={[R * 1.45, 0.008, 6, 160]} /><meshBasicMaterial color="#8b5cf6" transparent opacity={0.5} /></mesh>
      <FloatingJobCards radius={R + 1.4} count={lite ? 4 : 6} speed={0.8} />
      <Dust count={lite ? 120 : 300} box={[20, 12, 12]} position={[0, 0, -2]} color="#a78bfa" />
    </group>
  );
}
