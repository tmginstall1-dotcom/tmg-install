import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import { useRef, useMemo, Suspense } from "react";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";

/* A scroll-driven 3D scene of abstract furniture parts that assemble
   into a simple workstation as the user scrolls. progress: 0..1 */

type PartSpec = {
  // assembled (final) position + rotation
  end: [number, number, number];
  endRot: [number, number, number];
  // size of the box (w, h, d)
  size: [number, number, number];
  // start offset (added to end). parts begin scattered/rotated and align to end.
  startOffset: [number, number, number];
  startRot: [number, number, number];
  color?: string;
};

/* Build a desk: top + 4 legs + 2 brackets + 2 panel boards + 2 screws */
const PARTS: PartSpec[] = [
  // table top
  { end: [0, 0.3, 0], endRot: [0, 0, 0], size: [4.4, 0.18, 2.0], startOffset: [-3, 4, 1], startRot: [0.7, 0.4, -0.3], color: "#e9e7e2" },
  // legs
  { end: [-1.9, -0.95, -0.85], endRot: [0, 0, 0], size: [0.18, 2.4, 0.18], startOffset: [-4, -2, -3], startRot: [0.4, 0.8, 0.3], color: "#1a1a1a" },
  { end: [ 1.9, -0.95, -0.85], endRot: [0, 0, 0], size: [0.18, 2.4, 0.18], startOffset: [ 4, -2, -3], startRot: [-0.5, 0.6, 0.4], color: "#1a1a1a" },
  { end: [-1.9, -0.95,  0.85], endRot: [0, 0, 0], size: [0.18, 2.4, 0.18], startOffset: [-4,  3,  3], startRot: [0.6, -0.8, 0.2], color: "#1a1a1a" },
  { end: [ 1.9, -0.95,  0.85], endRot: [0, 0, 0], size: [0.18, 2.4, 0.18], startOffset: [ 4,  3,  3], startRot: [-0.4, -0.6, 0.5], color: "#1a1a1a" },
  // cross brackets
  { end: [0, -1.7, -0.85], endRot: [0, 0, 0], size: [3.4, 0.1, 0.1], startOffset: [-2, -4, -2], startRot: [0.6, 0.4, 0.8], color: "#888" },
  { end: [0, -1.7,  0.85], endRot: [0, 0, 0], size: [3.4, 0.1, 0.1], startOffset: [ 2, -4,  2], startRot: [-0.4, -0.6, -0.7], color: "#888" },
  // back panel
  { end: [0, -0.6, -0.92], endRot: [0, 0, 0], size: [3.6, 1.2, 0.05], startOffset: [0, 5, -4], startRot: [-0.8, 0.3, 0.1], color: "#d0cdc4" },
  // monitor stand
  { end: [0, 0.7, -0.4], endRot: [0, 0, 0], size: [1.4, 0.6, 0.06], startOffset: [3, 4, 2], startRot: [0.5, -0.6, 0.3], color: "#2a2a2a" },
  // small parts (screws/bolts as cylinders are cheaper than spheres count-wise — keep box)
  { end: [-1.85, 0.42, -0.8], endRot: [0, 0, 0], size: [0.12, 0.04, 0.12], startOffset: [-2, 1.5, 2], startRot: [1.2, 0.5, 0.8], color: "#c8a14a" },
  { end: [ 1.85, 0.42, -0.8], endRot: [0, 0, 0], size: [0.12, 0.04, 0.12], startOffset: [ 2, 1.5, 2], startRot: [-1.0, 0.7, -0.6], color: "#c8a14a" },
  { end: [-1.85, 0.42,  0.8], endRot: [0, 0, 0], size: [0.12, 0.04, 0.12], startOffset: [-2, 2.0, -2], startRot: [0.9, -0.5, 0.7], color: "#c8a14a" },
  { end: [ 1.85, 0.42,  0.8], endRot: [0, 0, 0], size: [0.12, 0.04, 0.12], startOffset: [ 2, 2.0, -2], startRot: [-1.1, -0.4, -0.5], color: "#c8a14a" },
];

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function Part({ spec, progress }: { spec: PartSpec; progress: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpRot = useMemo(() => new THREE.Euler(), []);

  useFrame(() => {
    if (!ref.current) return;
    const p = THREE.MathUtils.clamp(progress.current, 0, 1);
    const e = easeOutCubic(p);
    tmpPos.set(
      spec.end[0] + spec.startOffset[0] * (1 - e),
      spec.end[1] + spec.startOffset[1] * (1 - e),
      spec.end[2] + spec.startOffset[2] * (1 - e),
    );
    tmpRot.set(
      spec.endRot[0] + spec.startRot[0] * (1 - e),
      spec.endRot[1] + spec.startRot[1] * (1 - e),
      spec.endRot[2] + spec.startRot[2] * (1 - e),
    );
    ref.current.position.lerp(tmpPos, 0.18);
    ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, tmpRot.x, 0.18);
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, tmpRot.y, 0.18);
    ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, tmpRot.z, 0.18);
  });

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={spec.size} />
      <meshStandardMaterial color={spec.color || "#e9e7e2"} roughness={0.55} metalness={0.15} />
    </mesh>
  );
}

function Rig({ progress }: { progress: React.MutableRefObject<number> }) {
  useFrame((state) => {
    const p = progress.current;
    // slow camera dolly + slight rotation as parts assemble
    const targetX = Math.sin(state.clock.elapsedTime * 0.15) * 0.6 + (1 - p) * 1.5;
    const targetY = 1.4 - p * 0.3;
    const targetZ = 7 - p * 1.5;
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetX, 0.04);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, 0.04);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, 0.04);
    state.camera.lookAt(0, 0, 0);
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
  // In reduced-motion mode, lock progress at fully assembled
  const localRef = useRef(reduce ? 1 : 0);
  const ref = reduce ? localRef : progressRef;

  const parts = isMobile ? PARTS.slice(0, 9) : PARTS;

  return (
    <Canvas
      shadows={!isMobile}
      dpr={isMobile ? [1, 1.25] : [1, 1.75]}
      gl={{ antialias: !isMobile, powerPreference: "high-performance", alpha: true }}
      camera={{ position: [2, 1.4, 7], fov: 38 }}
      style={{ background: "transparent" }}
      frameloop={reduce ? "demand" : "always"}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[6, 8, 4]}
          intensity={1.4}
          castShadow={!isMobile}
          shadow-mapSize-width={isMobile ? 512 : 1024}
          shadow-mapSize-height={isMobile ? 512 : 1024}
        />
        <directionalLight position={[-6, 3, -4]} intensity={0.45} color="#d4a04a" />
        {parts.map((p, i) => (
          <Part key={i} spec={p} progress={ref} />
        ))}
        {!isMobile && (
          <ContactShadows position={[0, -2.2, 0]} opacity={0.5} scale={12} blur={2.5} far={4} />
        )}
        <Environment preset="studio" />
        <Rig progress={ref} />
      </Suspense>
    </Canvas>
  );
}
