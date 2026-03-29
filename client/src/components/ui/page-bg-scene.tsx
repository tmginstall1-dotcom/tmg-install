import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";

function checkWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

const lerp = THREE.MathUtils.lerp;

const CAM_KEYS = [
  { t: 0,   pos: [0, 1.8, 14] as const,  tgt: [0, 0, 0]   as const },
  { t: 0.2, pos: [-1, 0.8, 8] as const,  tgt: [0, 0, -4]  as const },
  { t: 0.4, pos: [2, 0, 2]    as const,  tgt: [-1, 0, -10] as const },
  { t: 0.6, pos: [-2, -0.5, -5] as const, tgt: [1, -1, -16] as const },
  { t: 0.8, pos: [1, -1, -12]  as const, tgt: [0, -1, -22] as const },
  { t: 1,   pos: [0, -1.5, -20] as const, tgt: [0, -1, -28] as const },
];

function sampleCamPath(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  let i = 0;
  for (let k = 0; k < CAM_KEYS.length - 1; k++) {
    if (p >= CAM_KEYS[k].t && p <= CAM_KEYS[k + 1].t) { i = k; break; }
  }
  const a = CAM_KEYS[i];
  const b = CAM_KEYS[i + 1] ?? a;
  const span = b.t - a.t;
  const local = span === 0 ? 0 : (p - a.t) / span;
  const ease = local < 0.5 ? 2 * local * local : -1 + (4 - 2 * local) * local;
  return {
    px: lerp(a.pos[0], b.pos[0], ease),
    py: lerp(a.pos[1], b.pos[1], ease),
    pz: lerp(a.pos[2], b.pos[2], ease),
    tx: lerp(a.tgt[0], b.tgt[0], ease),
    ty: lerp(a.tgt[1], b.tgt[1], ease),
    tz: lerp(a.tgt[2], b.tgt[2], ease),
  };
}

function Wardrobe({ position, scale = 1, color = "#0d0d0d" }: { position: [number, number, number]; scale?: number; color?: string }) {
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.15 }), [color]);
  const door = useMemo(() => new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.2, metalness: 0.25 }), []);
  const chrome = useMemo(() => new THREE.MeshStandardMaterial({ color: "#888", roughness: 0.05, metalness: 0.95 }), []);
  const trim = useMemo(() => new THREE.MeshStandardMaterial({ color: "#060606", roughness: 0.6 }), []);

  return (
    <group position={position} scale={scale}>
      <mesh material={body} castShadow receiveShadow>
        <boxGeometry args={[1.2, 2.3, 0.52]} />
      </mesh>
      <mesh position={[-0.305, 0, 0.29]} material={door} castShadow>
        <boxGeometry args={[0.575, 2.12, 0.05]} />
      </mesh>
      <mesh position={[0.305, 0, 0.29]} material={door} castShadow>
        <boxGeometry args={[0.575, 2.12, 0.05]} />
      </mesh>
      <mesh position={[0, 0, 0.315]} material={trim}>
        <boxGeometry args={[0.02, 2.12, 0.01]} />
      </mesh>
      <mesh position={[-0.07, 0, 0.34]} material={chrome}>
        <boxGeometry args={[0.035, 0.26, 0.035]} />
      </mesh>
      <mesh position={[0.07, 0, 0.34]} material={chrome}>
        <boxGeometry args={[0.035, 0.26, 0.035]} />
      </mesh>
      <mesh position={[0, 1.2, 0]} material={trim} castShadow>
        <boxGeometry args={[1.3, 0.1, 0.56]} />
      </mesh>
      <mesh position={[0, -1.22, 0]} material={trim}>
        <boxGeometry args={[1.24, 0.1, 0.54]} />
      </mesh>
      <mesh position={[0.614, 0, 0]} material={trim}>
        <boxGeometry args={[0.012, 2.3, 0.52]} />
      </mesh>
      <mesh position={[-0.614, 0, 0]} material={trim}>
        <boxGeometry args={[0.012, 2.3, 0.52]} />
      </mesh>
    </group>
  );
}

function Desk({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: "#111", roughness: 0.4, metalness: 0.1 }), []);
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.15, metalness: 0.8 }), []);

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.76, 0]} material={wood} castShadow>
        <boxGeometry args={[1.6, 0.05, 0.75]} />
      </mesh>
      {[[-0.72, 0, -0.32], [0.72, 0, -0.32], [-0.72, 0, 0.32], [0.72, 0, 0.32]].map((p, i) => (
        <mesh key={i} position={p as [number,number,number]} material={metal} castShadow>
          <boxGeometry args={[0.05, 0.76, 0.05]} />
        </mesh>
      ))}
      <mesh position={[0, 0.4, -0.32]} material={metal}>
        <boxGeometry args={[1.44, 0.04, 0.04]} />
      </mesh>
    </group>
  );
}

function BedFrame({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0d0d0d", roughness: 0.35, metalness: 0.12 }), []);
  const mattress = useMemo(() => new THREE.MeshStandardMaterial({ color: "#181818", roughness: 0.9, metalness: 0.0 }), []);

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.18, 0]} material={frame} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.2, 2.1]} />
      </mesh>
      <mesh position={[0, 0.35, 0]} material={mattress}>
        <boxGeometry args={[1.45, 0.18, 1.95]} />
      </mesh>
      <mesh position={[0, 0.55, -0.95]} material={frame} castShadow>
        <boxGeometry args={[1.6, 0.6, 0.1]} />
      </mesh>
      <mesh position={[0, 0.3, 0.95]} material={frame}>
        <boxGeometry args={[1.6, 0.2, 0.08]} />
      </mesh>
    </group>
  );
}

function GridFloor() {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#1a1a1a", wireframe: true, transparent: true, opacity: 0.25 }), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.8, -12]} material={mat}>
      <planeGeometry args={[60, 60, 40, 40]} />
    </mesh>
  );
}

function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 120;

  const data = useMemo(() => Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 24,
    y: (Math.random() - 0.5) * 14,
    z: Math.random() * -32,
    speed: 0.15 + Math.random() * 0.4,
    offset: Math.random() * Math.PI * 2,
    size: 0.008 + Math.random() * 0.022,
  })), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    data.forEach((p, i) => {
      dummy.position.set(
        p.x + Math.sin(t * p.speed * 0.4 + p.offset) * 0.4,
        p.y + Math.sin(t * p.speed + p.offset) * 0.6,
        p.z
      );
      dummy.scale.setScalar(p.size * (0.75 + Math.sin(t * p.speed + p.offset) * 0.25));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
    </instancedMesh>
  );
}

function SceneObjects() {
  const group = useRef<THREE.Group>(null);
  let yaw = 0;

  useFrame((_, delta) => {
    if (!group.current) return;
    yaw += delta * 0.08;
    group.current.children.forEach((child, i) => {
      if (child instanceof THREE.Group) {
        child.rotation.y = yaw * (i % 2 === 0 ? 1 : -1) * 0.18 + Math.PI / 6;
      }
    });
  });

  return (
    <group ref={group}>
      <Wardrobe position={[0, -0.6, 0]} scale={1} />
      <Wardrobe position={[-7, -0.6, -10]} scale={0.88} color="#0a0a0a" />
      <Wardrobe position={[8, -0.4, -17]} scale={0.76} color="#111" />
      <Desk     position={[5, -2.2, -7]} scale={1.1} />
      <Desk     position={[-6, -2.2, -20]} scale={0.9} />
      <BedFrame position={[-4, -2.5, -13]} scale={0.85} />
      <BedFrame position={[6, -2.5, -24]} scale={0.9} />
    </group>
  );
}

function CameraRig({
  scrollProgress,
  mouseX,
  mouseY,
}: {
  scrollProgress: number;
  mouseX: number;
  mouseY: number;
}) {
  const { camera } = useThree();
  const camPos = useRef(new THREE.Vector3(0, 1.8, 14));
  const camTgt = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const k = sampleCamPath(scrollProgress);
    const destPos = new THREE.Vector3(
      k.px + mouseX * 0.5,
      k.py + mouseY * -0.3,
      k.pz
    );
    const destTgt = new THREE.Vector3(k.tx, k.ty, k.tz);

    camPos.current.lerp(destPos, 0.045);
    camTgt.current.lerp(destTgt, 0.045);

    camera.position.copy(camPos.current);
    camera.lookAt(camTgt.current);
  });

  return null;
}

function Scene({
  scrollProgress,
  mouseX,
  mouseY,
}: {
  scrollProgress: number;
  mouseX: number;
  mouseY: number;
}) {
  return (
    <>
      <ambientLight intensity={0.45} color="#ffffff" />
      <directionalLight position={[5, 8, 5]} intensity={2.2} color="#e8eeff" castShadow />
      <directionalLight position={[-4, 3, -4]} intensity={0.5} color="#8899ff" />
      <pointLight position={[0, 4, 2]} intensity={18} color="#ffffff" distance={14} />
      <pointLight position={[-5, 3, -8]} intensity={8} color="#aabbff" distance={16} />
      <pointLight position={[6, 2, -15]} intensity={6} color="#ffffff" distance={14} />
      <Particles />
      <SceneObjects />
      <GridFloor />
      <CameraRig scrollProgress={scrollProgress} mouseX={mouseX} mouseY={mouseY} />
    </>
  );
}

interface PageBgSceneProps {
  scrollProgress: number;
  mouseX: number;
  mouseY: number;
}

export default function PageBgScene({ scrollProgress, mouseX, mouseY }: PageBgSceneProps) {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(checkWebGL());
  }, []);

  if (!webglOk) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
      }}
    >
      <Canvas
        camera={{ position: [0, 1.8, 14], fov: 48, near: 0.1, far: 120 }}
        style={{ background: "transparent" }}
        shadows
        gl={{ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false }}
        dpr={[1, 1.5]}
      >
        <fog attach="fog" args={["#030303", 18, 60]} />
        <Scene scrollProgress={scrollProgress} mouseX={mouseX} mouseY={mouseY} />
      </Canvas>
    </div>
  );
}
