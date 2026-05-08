import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import { useRef, useMemo, Suspense } from "react";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";

/* Scroll-driven 3D scene tuned for an OFF-WHITE editorial background.
   Materials are darker/metallic so parts read on a light page.
   progress (0..1) is fed in via a ref so the scene reads scroll
   without re-rendering React. */

type PartSpec = {
  end: [number, number, number];
  endRot: [number, number, number];
  size: [number, number, number];
  startOffset: [number, number, number];
  startRot: [number, number, number];
  color?: string;
  metalness?: number;
  roughness?: number;
};

/* Workstation: top + 4 legs + 2 brackets + back panel + monitor stand + 4 bolts */
const PARTS: PartSpec[] = [
  // table top — dark walnut/charcoal, reads cleanly on paper bg
  { end: [0, 0.3, 0], endRot: [0, 0, 0], size: [4.4, 0.18, 2.0],
    startOffset: [-6, 7, 2], startRot: [1.4, 0.9, -0.6], color: "#1f1c1a", roughness: 0.45, metalness: 0.1 },
  // legs — black metal
  { end: [-1.9, -0.95, -0.85], endRot: [0, 0, 0], size: [0.18, 2.4, 0.18],
    startOffset: [-8, -4, -6], startRot: [1.0, 1.6, 0.7], color: "#0a0a0a", metalness: 0.7, roughness: 0.35 },
  { end: [ 1.9, -0.95, -0.85], endRot: [0, 0, 0], size: [0.18, 2.4, 0.18],
    startOffset: [ 8, -4, -6], startRot: [-1.2, 1.4, 0.9], color: "#0a0a0a", metalness: 0.7, roughness: 0.35 },
  { end: [-1.9, -0.95,  0.85], endRot: [0, 0, 0], size: [0.18, 2.4, 0.18],
    startOffset: [-8,  6,  6], startRot: [1.3, -1.6, 0.5], color: "#0a0a0a", metalness: 0.7, roughness: 0.35 },
  { end: [ 1.9, -0.95,  0.85], endRot: [0, 0, 0], size: [0.18, 2.4, 0.18],
    startOffset: [ 8,  6,  6], startRot: [-1.0, -1.4, 1.1], color: "#0a0a0a", metalness: 0.7, roughness: 0.35 },
  // brackets — brushed steel
  { end: [0, -1.7, -0.85], endRot: [0, 0, 0], size: [3.4, 0.1, 0.1],
    startOffset: [-5, -7, -4], startRot: [1.2, 0.9, 1.6], color: "#5a5a5a", metalness: 0.65, roughness: 0.4 },
  { end: [0, -1.7,  0.85], endRot: [0, 0, 0], size: [3.4, 0.1, 0.1],
    startOffset: [ 5, -7,  4], startRot: [-1.0, -1.2, -1.4], color: "#5a5a5a", metalness: 0.65, roughness: 0.4 },
  // back panel — charcoal
  { end: [0, -0.6, -0.92], endRot: [0, 0, 0], size: [3.6, 1.2, 0.05],
    startOffset: [0, 9, -7], startRot: [-1.6, 0.6, 0.3], color: "#2a2724", roughness: 0.55, metalness: 0.1 },
  // monitor stand
  { end: [0, 0.7, -0.4], endRot: [0, 0, 0], size: [1.4, 0.6, 0.06],
    startOffset: [6, 7, 4], startRot: [1.1, -1.2, 0.7], color: "#161616", metalness: 0.6, roughness: 0.4 },
  // bolts — gold (only color accent on the page)
  { end: [-1.85, 0.42, -0.8], endRot: [0, 0, 0], size: [0.12, 0.04, 0.12],
    startOffset: [-4, 3, 4], startRot: [2.4, 1.0, 1.6], color: "#b8893d", metalness: 0.85, roughness: 0.25 },
  { end: [ 1.85, 0.42, -0.8], endRot: [0, 0, 0], size: [0.12, 0.04, 0.12],
    startOffset: [ 4, 3, 4], startRot: [-2.0, 1.4, -1.2], color: "#b8893d", metalness: 0.85, roughness: 0.25 },
  { end: [-1.85, 0.42,  0.8], endRot: [0, 0, 0], size: [0.12, 0.04, 0.12],
    startOffset: [-4, 4, -4], startRot: [1.8, -1.0, 1.4], color: "#b8893d", metalness: 0.85, roughness: 0.25 },
  { end: [ 1.85, 0.42,  0.8], endRot: [0, 0, 0], size: [0.12, 0.04, 0.12],
    startOffset: [ 4, 4, -4], startRot: [-2.2, -0.8, -1.0], color: "#b8893d", metalness: 0.85, roughness: 0.25 },
];

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function Part({ spec, progress }: { spec: PartSpec; progress: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpRot = useMemo(() => new THREE.Euler(), []);

  useFrame((state) => {
    if (!ref.current) return;
    const p = THREE.MathUtils.clamp(progress.current, 0, 1);
    const e = easeOutCubic(p);
    const idle = p > 0.9 ? (p - 0.9) * 10 : 0;
    const breath = Math.sin(state.clock.elapsedTime * 0.5) * 0.02 * idle;

    tmpPos.set(
      spec.end[0] + spec.startOffset[0] * (1 - e),
      spec.end[1] + spec.startOffset[1] * (1 - e) + breath,
      spec.end[2] + spec.startOffset[2] * (1 - e),
    );
    tmpRot.set(
      spec.endRot[0] + spec.startRot[0] * (1 - e),
      spec.endRot[1] + spec.startRot[1] * (1 - e),
      spec.endRot[2] + spec.startRot[2] * (1 - e),
    );
    ref.current.position.lerp(tmpPos, 0.16);
    ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, tmpRot.x, 0.16);
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, tmpRot.y, 0.16);
    ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, tmpRot.z, 0.16);
  });

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={spec.size} />
      <meshStandardMaterial
        color={spec.color || "#1f1c1a"}
        roughness={spec.roughness ?? 0.5}
        metalness={spec.metalness ?? 0.2}
      />
    </mesh>
  );
}

function Rig({ progress }: { progress: React.MutableRefObject<number> }) {
  useFrame((state) => {
    const p = THREE.MathUtils.clamp(progress.current, 0, 1);
    const targetX = (1 - p) * 3.8 + Math.sin(state.clock.elapsedTime * 0.18) * (0.4 + (1 - p) * 0.6);
    const targetY = 2.6 - p * 1.2;
    const targetZ = 11 - p * 4.5;
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetX, 0.04);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, 0.04);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, 0.04);
    state.camera.lookAt(0, p > 0.5 ? -0.3 : 0.4, 0);
  });
  return null;
}

export default function ThreeFurnitureScene({
  progressRef,
  isMobile = false,
}: {
  progressRef: React.MutableRefObject<number>;
  isMobile?: boolean;
}) {
  const reduce = useReducedMotion();
  const localRef = useRef(reduce ? 1 : 0);
  const ref = reduce ? localRef : progressRef;

  const parts = isMobile ? PARTS.slice(0, 9) : PARTS;

  return (
    <Canvas
      shadows={!isMobile}
      dpr={isMobile ? [1, 1.25] : [1, 1.75]}
      gl={{ antialias: !isMobile, powerPreference: "high-performance", alpha: true }}
      camera={{ position: [3.8, 2.6, 11], fov: 36 }}
      style={{ background: "transparent" }}
      frameloop={reduce ? "demand" : "always"}
    >
      <Suspense fallback={null}>
        {/* Soft daylight studio for light-page reading */}
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[6, 9, 4]}
          intensity={1.1}
          color="#ffffff"
          castShadow={!isMobile}
          shadow-mapSize-width={isMobile ? 512 : 1024}
          shadow-mapSize-height={isMobile ? 512 : 1024}
        />
        <directionalLight position={[-7, 3, -4]} intensity={0.4} color="#ffffff" />
        {parts.map((p, i) => (
          <Part key={i} spec={p} progress={ref} />
        ))}
        {!isMobile && (
          <ContactShadows position={[0, -2.2, 0]} opacity={0.35} scale={14} blur={3.2} far={5} />
        )}
        <Environment preset="studio" />
        <Rig progress={ref} />
      </Suspense>
    </Canvas>
  );
}
