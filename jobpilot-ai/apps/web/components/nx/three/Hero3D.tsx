'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import { Astronaut, Dust, HoloPanel, Island, Planet, Portal, useDispose } from './parts';

/** Opening scene: portal, floating islands, a path with an astronaut, planets, holo panels and job cards. */
export function Hero3D({ lite }: { lite: boolean }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(0.4, -2, 3.5), new THREE.Vector3(-0.6, -2, 0.5), new THREE.Vector3(0.5, -2, -2.8), new THREE.Vector3(0, -2, -6)]), []);
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 60, 0.05, 6, false), [curve]);
  const glow = useMemo(() => new THREE.TubeGeometry(curve, 60, 0.18, 8, false), [curve]);
  useDispose([tube, glow]);
  const slabs = useMemo(() => [0.1, 0.28, 0.46, 0.64, 0.82].map((t) => ({ p: curve.getPointAt(t), a: curve.getTangentAt(t) })), [curve]);
  const start = curve.getPointAt(0.1);
  return (
    <group>
      <Portal position={[0, 2.4, -7.5]} radius={2.2} />
      <mesh geometry={tube}><meshBasicMaterial color="#22d3ee" /></mesh>
      <mesh geometry={glow}><meshBasicMaterial color="#3b82f6" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
      {slabs.map((s, i) => (<mesh key={i} position={[s.p.x, s.p.y - 0.1, s.p.z]} rotation={[0, Math.atan2(s.a.x, s.a.z), 0]}><boxGeometry args={[1.5, 0.2, 0.95]} /><meshStandardMaterial color="#1c2347" roughness={0.9} flatShading emissive="#0c1a4a" emissiveIntensity={0.6} /></mesh>))}
      <Astronaut position={[start.x, start.y + 0.02, start.z]} />
      {/* two islands anchor the scene; four panels sit in two tidy columns either side of the portal */}
      <Island position={[-4.6, -0.9, -6.5]} r={0.95} seed={2} lite={lite} />
      <Island position={[4.8, -1.1, -6.8]} r={1.05} seed={3} speed={0.4} lite={lite} />
      <HoloPanel position={[-4.1, 3.6, -5.2]} rotation={[0, 0.28, 0]} title={['Analyze', 'Job Posts']} kind="doc" phase={0.4} w={2.3} />
      <HoloPanel position={[-4.1, 1.3, -5.2]} rotation={[0, 0.28, 0]} title={['Match', 'Your Skills']} kind="search" phase={2.4} w={2.3} />
      <HoloPanel position={[4.1, 3.6, -5.2]} rotation={[0, -0.28, 0]} title={['Create', 'Perfect Resume']} kind="spark" phase={1.6} w={2.3} />
      <HoloPanel position={[4.1, 1.3, -5.2]} rotation={[0, -0.28, 0]} title={['Generate', 'HR Emails']} kind="mail" phase={3.1} w={2.3} />
      <Planet position={[34, 14, -40]} radius={6} a="#3b0f6b" b="#7c3aed" rim="#c084fc" ring spin={0.02} />
            <Dust count={lite ? 100 : 240} box={[22, 12, 16]} position={[0, 1.5, -4]} />
    </group>
  );
}
