'use client';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLOW_F, GLOW_V, glass, glowUniforms, icon, IconKind, rng, txt, useTex } from './utils';

type V3 = [number, number, number];

/** Static star corridor that runs the whole length of the journey. */
export function Stars({ count, length }: { count: number; length: number }) {
  const { a, b } = useMemo(() => {
    const R = rng(7); const mk = (n: number) => { const p = new Float32Array(n * 3); for (let i = 0; i < n; i++) p.set([(R() - 0.5) * 150, (R() - 0.5) * 90, 45 - R() * (length + 110)], i * 3); return p; };
    return { a: mk(count), b: mk(Math.floor(count * 0.4)) };
  }, [count, length]);
  return (
    <>
      <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[a, 3]} /></bufferGeometry><pointsMaterial size={0.28} color="#bcd7ff" sizeAttenuation transparent opacity={0.85} depthWrite={false} /></points>
      <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[b, 3]} /></bufferGeometry><pointsMaterial size={0.4} color="#a78bfa" sizeAttenuation transparent opacity={0.7} depthWrite={false} /></points>
    </>
  );
}

/** Soft additive cloud (radial gradient drawn locally). */
export function Nebula({ position, color, size = 46, opacity = 0.4 }: { position: V3; color: string; size?: number; opacity?: number }) {
  const tex = useTex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  return <mesh position={position}><planeGeometry args={[size, size]} /><meshBasicMaterial map={tex} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} /></mesh>;
}

/** Small drifting dust cloud around a point. */
export function Dust({ count, box, position, color = '#67e8f9', size = 0.05 }: { count: number; box: V3; position: V3; color?: string; size?: number }) {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => { const R = rng(count + 3); const p = new Float32Array(count * 3); for (let i = 0; i < count; i++) p.set([(R() - 0.5) * box[0], (R() - 0.5) * box[1], (R() - 0.5) * box[2]], i * 3); return p; }, [count, box[0], box[1], box[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => { if (ref.current) { ref.current.rotation.y += dt * 0.02; ref.current.rotation.x += dt * 0.005; } });
  return <points ref={ref} position={position}><bufferGeometry><bufferAttribute attach="attributes-position" args={[pos, 3]} /></bufferGeometry><pointsMaterial size={size} color={color} sizeAttenuation transparent opacity={0.75} depthWrite={false} /></points>;
}

const PLANET_V = `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const PLANET_F = `varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform vec3 uA; uniform vec3 uB; uniform vec3 uRim;
void main(){ float b = 0.5 + 0.5 * sin(vP.y * 1.6 + vP.x * 0.5); vec3 base = mix(uA, uB, b) * 0.75;
  float lit = clamp(dot(normalize(vN), normalize(vec3(0.55, 0.45, 0.8))) * 0.5 + 0.55, 0.2, 1.0);
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6); gl_FragColor = vec4(base * lit + uRim * f * 1.3, 1.0); }`;

export function Planet({ position, radius, a, b, rim, ring = false, spin = 0.02 }: { position: V3; radius: number; a: string; b: string; rim: string; ring?: boolean; spin?: number }) {
  const g = useRef<THREE.Group>(null);
  const u = useMemo(() => ({ uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uRim: { value: new THREE.Color(rim) } }), [a, b, rim]);
  const gu = useMemo(() => glowUniforms(rim, rim), [rim]);
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * spin; });
  return (
    <group position={position}>
      <group ref={g}><mesh><sphereGeometry args={[radius, 48, 32]} /><shaderMaterial uniforms={u} vertexShader={PLANET_V} fragmentShader={PLANET_F} /></mesh></group>
      <mesh scale={1.1}><sphereGeometry args={[radius, 32, 24]} /><shaderMaterial uniforms={gu} vertexShader={GLOW_V} fragmentShader={GLOW_F} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide} /></mesh>
      {ring && <mesh rotation={[Math.PI / 2.3, 0, 0.35]}><ringGeometry args={[radius * 1.35, radius * 1.95, 96]} /><meshBasicMaterial color={rim} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} /></mesh>}
    </group>
  );
}

/** Floating rock island with a glowing rim, a few trees and light towers. */
export function Island({ position, r = 1, seed = 1, speed = 0.5, lite }: { position: V3; r?: number; seed?: number; speed?: number; lite: boolean }) {
  const g = useRef<THREE.Group>(null);
  const decor = useMemo(() => {
    const R = rng(seed * 97);
    const trees = Array.from({ length: lite ? 3 : 6 }, () => { const an = R() * 6.28; const d = R() * r * 0.7; return { x: Math.cos(an) * d, z: Math.sin(an) * d, h: 0.25 + R() * 0.4 }; });
    const towers = Array.from({ length: lite ? 2 : 4 }, () => ({ x: (R() - 0.5) * r * 0.9, z: (R() - 0.5) * r * 0.9, h: 0.3 + R() * 0.9, c: R() > 0.5 ? '#22d3ee' : '#a78bfa' }));
    return { trees, towers };
  }, [seed, r, lite]);
  useFrame((s) => { const g0 = g.current; if (!g0) return; const t = s.clock.elapsedTime; g0.position.y = position[1] + Math.sin(t * speed + seed * 1.7) * 0.18; g0.rotation.y = t * 0.05 + seed; });
  return (
    <group ref={g} position={position}>
      <mesh position={[0, -r * 0.55, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[r * 0.95, r * 1.3, 7]} /><meshStandardMaterial color="#1a2150" flatShading roughness={0.95} /></mesh>
      <mesh><cylinderGeometry args={[r, r * 0.96, 0.22, 7]} /><meshStandardMaterial color="#0f2a44" emissive="#0b4a6e" emissiveIntensity={0.55} flatShading /></mesh>
      <mesh position={[0, 0.115, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r * 0.99, 0.025, 6, 56]} /><meshBasicMaterial color="#22d3ee" /></mesh>
      {decor.trees.map((t, i) => (<mesh key={i} position={[t.x, 0.11 + t.h / 2, t.z]}><coneGeometry args={[0.12, t.h, 5]} /><meshStandardMaterial color="#0f766e" emissive="#14b8a6" emissiveIntensity={0.35} flatShading /></mesh>))}
      {decor.towers.map((t, i) => (<mesh key={i} position={[t.x, 0.11 + t.h / 2, t.z]}><boxGeometry args={[0.1, t.h, 0.1]} /><meshBasicMaterial color={t.c} /></mesh>))}
    </group>
  );
}

const PORTAL_F = `varying vec2 vUv; uniform float uT; void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
  float s = sin(a * 6.0 + r * 11.0 - uT * 1.6) * 0.5 + 0.5; vec3 c = mix(vec3(0.04, 0.09, 0.4), vec3(0.1, 0.8, 1.0), s * (1.0 - r));
  c += vec3(0.55, 0.3, 1.0) * pow(max(1.0 - r, 0.0), 3.0); float al = smoothstep(1.0, 0.82, r); gl_FragColor = vec4(c, al * 0.92); }`;
const PORTAL_V = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** Glowing career portal: swirling disc inside three counter-rotating rings. */
export function Portal({ position, radius = 2.3 }: { position: V3; radius?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null); const r1 = useRef<THREE.Mesh>(null); const r2 = useRef<THREE.Mesh>(null); const r3 = useRef<THREE.Mesh>(null);
  const u = useMemo(() => ({ uT: { value: 0 } }), []);
  const label = useTex(512, 256, (g, w, h) => { g.clearRect(0, 0, w, h); txt(g, 'YOUR', w / 2, 92, 54, '#ffffff', 800, undefined, 'center'); txt(g, 'DREAM JOB', w / 2, 152, 54, '#ffffff', 800, undefined, 'center'); txt(g, 'AWAITS', w / 2, 212, 54, '#67e8f9', 800, undefined, 'center'); });
  useFrame((s) => { const t = s.clock.elapsedTime; if (mat.current) mat.current.uniforms.uT.value = t; if (r1.current) r1.current.rotation.z = t * 0.3; if (r2.current) r2.current.rotation.z = -t * 0.45; if (r3.current) r3.current.rotation.z = t * 0.15; });
  return (
    <group position={position}>
      <mesh><circleGeometry args={[radius * 0.93, 64]} /><shaderMaterial ref={mat} uniforms={u} vertexShader={PORTAL_V} fragmentShader={PORTAL_F} transparent depthWrite={false} /></mesh>
      <mesh ref={r1}><torusGeometry args={[radius, 0.07, 12, 96]} /><meshBasicMaterial color="#22d3ee" /></mesh>
      <mesh ref={r2}><torusGeometry args={[radius * 0.9, 0.035, 8, 96]} /><meshBasicMaterial color="#8b5cf6" /></mesh>
      <mesh ref={r3}><torusGeometry args={[radius * 1.14, 0.03, 8, 6]} /><meshBasicMaterial color="#3b82f6" /></mesh>
      <mesh position={[0, 0, 0.05]}><planeGeometry args={[radius * 1.2, radius * 0.6]} /><meshBasicMaterial map={label} transparent depthWrite={false} toneMapped={false} /></mesh>
      <mesh scale={1.3}><circleGeometry args={[radius, 48]} /><meshBasicMaterial color="#3b82f6" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
    </group>
  );
}

/** Low-poly astronaut seen from behind, facing -Z. Feet at y = 0. */
export function Astronaut({ position }: { position: V3 }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => { if (g.current) g.current.position.y = position[1] + Math.sin(s.clock.elapsedTime * 1.2) * 0.03; });
  return (
    <group ref={g} position={position} scale={1.15}>
      <mesh position={[-0.09, 0.21, 0]}><capsuleGeometry args={[0.07, 0.28, 4, 8]} /><meshStandardMaterial color="#dbe6ff" roughness={0.6} /></mesh>
      <mesh position={[0.09, 0.21, 0]}><capsuleGeometry args={[0.07, 0.28, 4, 8]} /><meshStandardMaterial color="#dbe6ff" roughness={0.6} /></mesh>
      <mesh position={[0, 0.66, 0]}><capsuleGeometry args={[0.19, 0.36, 4, 10]} /><meshStandardMaterial color="#eef3ff" roughness={0.5} /></mesh>
      <mesh position={[-0.27, 0.68, 0]} rotation={[0, 0, 0.25]}><capsuleGeometry args={[0.06, 0.3, 4, 8]} /><meshStandardMaterial color="#dbe6ff" /></mesh>
      <mesh position={[0.27, 0.68, 0]} rotation={[0, 0, -0.25]}><capsuleGeometry args={[0.06, 0.3, 4, 8]} /><meshStandardMaterial color="#dbe6ff" /></mesh>
      <mesh position={[0, 1.2, 0]}><sphereGeometry args={[0.21, 18, 16]} /><meshStandardMaterial color="#eef3ff" roughness={0.4} /></mesh>
      <mesh position={[0, 1.2, -0.1]} scale={[1, 0.75, 0.6]}><sphereGeometry args={[0.16, 16, 14]} /><meshStandardMaterial color="#071030" emissive="#1e40af" emissiveIntensity={0.7} roughness={0.2} /></mesh>
      <mesh position={[0, 0.72, 0.22]}><boxGeometry args={[0.28, 0.42, 0.14]} /><meshStandardMaterial color="#0e7490" emissive="#22d3ee" emissiveIntensity={1.1} /></mesh>
    </group>
  );
}

/** Floating holographic panel with an icon and a title. */
export function HoloPanel({ position, rotation = [0, 0, 0], title, kind, w = 2.1, phase = 0, face = false }: { position: V3; rotation?: V3; title: [string, string?]; kind: IconKind; w?: number; phase?: number; face?: boolean }) {
  const g = useRef<THREE.Group>(null);
  const tex = useTex(512, 256, (c, tw, th) => { c.clearRect(0, 0, tw, th); glass(c, tw, th, 34); icon(c, kind, 96, th / 2, 110); txt(c, title[0], 166, title[1] ? 110 : 140, 54, '#ffffff', 800, 330); if (title[1]) txt(c, title[1], 166, 172, 54, '#ffffff', 800, 330); });
  useFrame((s) => { const g0 = g.current; if (!g0) return; const t = s.clock.elapsedTime; g0.position.y = position[1] + Math.sin(t * 0.9 + phase) * 0.1; if (face) g0.quaternion.copy(s.camera.quaternion); });
  return <group ref={g} position={position} rotation={rotation}><mesh><planeGeometry args={[w, w / 2]} /><meshBasicMaterial map={tex} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} /></mesh></group>;
}

/** Disposes geometries/materials created imperatively inside a memo. */
export function useDispose(objs: { dispose: () => void }[]) { useEffect(() => () => objs.forEach((o) => o.dispose()), [objs]); }
