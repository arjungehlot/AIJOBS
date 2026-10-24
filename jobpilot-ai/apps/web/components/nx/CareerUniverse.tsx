'use client';
/** The single fixed 3D canvas. A scroll-driven camera flies through six zones; each zone is its own environment. */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { cosmos, GAP, ZONES, zoneZ } from '@/lib/cosmos';
import { Hero3D } from './three/Hero3D';
import { JobGlobe } from './three/JobGlobe';
import { Stars } from './three/parts';
import { AnalysisScene, CareerJourney, EmailScene, ResumeHologram } from './three/Scenes';

const PALETTE = ['#040818', '#03101f', '#0a0720', '#04141a', '#0b0820', '#030a1c'].map((c) => new THREE.Color(c));
const SIDE = [1, -1, 1, -1, 1, -1]; // which side of the screen each subject sits on (text takes the other side)
const ease = (f: number) => { const k = Math.min(1, Math.max(0, (f - 0.25) / 0.5)); return k * k * (3 - 2 * k); };

function Rig() {
  const { camera, scene } = useThree();
  const bg = useMemo(() => new THREE.Color(PALETTE[0]), []);
  const fog = useMemo(() => new THREE.Fog(PALETTE[0].getHex(), 24, 100), []);
  useEffect(() => { scene.background = bg; scene.fog = fog; (camera as THREE.PerspectiveCamera).far = 400; camera.updateProjectionMatrix(); return () => { scene.fog = null; }; }, [scene, camera, bg, fog]);
  useFrame((_, dt) => {
    cosmos.sz += (cosmos.zf - cosmos.sz) * Math.min(1, dt * 4);
    const u = Math.min(ZONES - 1, Math.max(0, cosmos.sz)); const i = Math.min(ZONES - 2, Math.floor(u)); const e = ease(u - i); const dir = i % 2 ? -1 : 1;
    const sway = Math.sin(e * Math.PI);
    const z = zoneZ(i) + (zoneZ(i + 1) - zoneZ(i)) * e + 11;
    camera.position.set(sway * 2.4 * dir + cosmos.mx * 0.7, 1.4 + cosmos.my * 0.4 + sway * 0.6, z);
    camera.lookAt(camera.position.x * 0.5, 1.2 + sway * 0.4, z - 12);
    camera.rotateZ(sway * 0.07 * dir);
    const cam = camera as THREE.PerspectiveCamera; const fov = 50 + sway * 14; if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); } // warp stretch between zones
    bg.copy(PALETTE[i]).lerp(PALETTE[i + 1], e); fog.color.copy(bg);
  });
  return null;
}

function Zone({ i, x, y, s, children }: { i: number; x: number; y: number; s: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => { if (g.current) g.current.visible = Math.abs(cosmos.sz - i) < 0.65; }); // draw only the zones near the camera
  return <group ref={g} position={[x, y, zoneZ(i)]} scale={s}>{children}</group>;
}

function World({ lite }: { lite: boolean }) {
  const aspect = useThree((s) => s.size.width / s.size.height);
  const wide = aspect > 1.2; const x = wide ? 3.5 : 0; const y = wide ? 0 : 1.7; const s = wide ? 1 : 0.78;
  const L1 = useRef<THREE.PointLight>(null); const L2 = useRef<THREE.PointLight>(null);
  useFrame(({ camera }) => { L1.current?.position.set(camera.position.x + 4, camera.position.y + 3, camera.position.z - 2); L2.current?.position.set(camera.position.x - 5, camera.position.y - 2, camera.position.z - 4); });
  return (
    <>
      <ambientLight intensity={0.9} /><directionalLight position={[3, 5, 4]} intensity={1.4} color="#cfe0ff" />
      <pointLight ref={L1} intensity={140} color="#22d3ee" distance={40} /><pointLight ref={L2} intensity={110} color="#8b5cf6" distance={40} />
      <Stars count={lite ? 700 : 1800} length={GAP * ZONES} />
      <Zone i={0} x={x * SIDE[0] * 1.15} y={y} s={s}><Hero3D lite={lite} /></Zone>
      <Zone i={1} x={x * SIDE[1]} y={y} s={s}><JobGlobe lite={lite} /></Zone>
      <Zone i={2} x={x * SIDE[2]} y={y} s={s}><ResumeHologram lite={lite} /></Zone>
      <Zone i={3} x={x * SIDE[3]} y={y} s={s * 0.95}><AnalysisScene lite={lite} /></Zone>
      <Zone i={4} x={x * SIDE[4]} y={y} s={s}><EmailScene lite={lite} /></Zone>
      <Zone i={5} x={x * SIDE[5]} y={y} s={s * 0.95}><CareerJourney lite={lite} /></Zone>
    </>
  );
}

export default function CareerUniverse({ active, lite, onReady, onFail }: { active: boolean; lite: boolean; onReady: () => void; onFail: () => void }) {
  const [dpr, setDpr] = useState(Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, lite ? 1.25 : 1.75));
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'} dpr={dpr} camera={{ position: [0, 1.4, 11], fov: 50, near: 0.1 }}
      gl={{ antialias: !lite, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onFail(); }); onReady(); }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)}><Rig /><World lite={lite} /></PerformanceMonitor>
    </Canvas>
  );
}
