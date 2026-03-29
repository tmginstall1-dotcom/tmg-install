import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";

function checkWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch { return false; }
}

const lerp = THREE.MathUtils.lerp;

// Camera keyframes — dramatic fly-through a furniture showroom
const CAM_KEYS = [
  { t: 0,    pos: [0, 2.5, 20]  as const, tgt: [0,  0.5, 0]    as const },
  { t: 0.18, pos: [-2, 1.5, 12] as const, tgt: [0,  0,   -2]   as const },
  { t: 0.35, pos: [3, 0.5, 5]   as const, tgt: [-1, 0,   -8]   as const },
  { t: 0.55, pos: [-3, 0, -2]   as const, tgt: [1, -0.5, -14]  as const },
  { t: 0.75, pos: [2, -1, -10]  as const, tgt: [0, -1,   -20]  as const },
  { t: 1,    pos: [0, -2, -20]  as const, tgt: [0, -1.5, -30]  as const },
];

function samplePath(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  let i = 0;
  for (let k = 0; k < CAM_KEYS.length - 1; k++) {
    if (p >= CAM_KEYS[k].t && p <= CAM_KEYS[k + 1].t) { i = k; break; }
  }
  const a = CAM_KEYS[i];
  const b = CAM_KEYS[Math.min(i + 1, CAM_KEYS.length - 1)];
  const span = b.t - a.t || 1;
  const local = (p - a.t) / span;
  const ease = local < 0.5 ? 2 * local * local : -1 + (4 - 2 * local) * local;
  return {
    px: lerp(a.pos[0], b.pos[0], ease), py: lerp(a.pos[1], b.pos[1], ease), pz: lerp(a.pos[2], b.pos[2], ease),
    tx: lerp(a.tgt[0], b.tgt[0], ease), ty: lerp(a.tgt[1], b.tgt[1], ease), tz: lerp(a.tgt[2], b.tgt[2], ease),
  };
}

// Shared visible materials — silver/metal tones so they pop against dark bg
function useMaterials() {
  return useMemo(() => ({
    body:   new THREE.MeshStandardMaterial({ color: "#9a9a9a", roughness: 0.25, metalness: 0.85 }),
    door:   new THREE.MeshStandardMaterial({ color: "#b0b0b0", roughness: 0.15, metalness: 0.90 }),
    chrome: new THREE.MeshStandardMaterial({ color: "#d8d8d8", roughness: 0.03, metalness: 1.0, emissive: "#444" }),
    trim:   new THREE.MeshStandardMaterial({ color: "#606060", roughness: 0.45, metalness: 0.5 }),
    shelf:  new THREE.MeshStandardMaterial({ color: "#888888", roughness: 0.5, metalness: 0.35 }),
    desk:   new THREE.MeshStandardMaterial({ color: "#787878", roughness: 0.4, metalness: 0.6 }),
    wood:   new THREE.MeshStandardMaterial({ color: "#8a7560", roughness: 0.75, metalness: 0.05 }),
    frame:  new THREE.MeshStandardMaterial({ color: "#505050", roughness: 0.3, metalness: 0.75 }),
    wire:   new THREE.MeshBasicMaterial({ color: "#555", wireframe: true }),
  }), []);
}

function Wardrobe({ pos, rot = 0, scale = 1 }: { pos: [number,number,number]; rot?: number; scale?: number }) {
  const m = useMaterials();
  return (
    <group position={pos} rotation={[0, rot, 0]} scale={scale}>
      <mesh material={m.body} castShadow receiveShadow>
        <boxGeometry args={[1.2, 2.4, 0.54]} />
      </mesh>
      <mesh position={[-0.305, 0, 0.29]} material={m.door} castShadow>
        <boxGeometry args={[0.57, 2.2, 0.05]} />
      </mesh>
      <mesh position={[0.305, 0, 0.29]} material={m.door} castShadow>
        <boxGeometry args={[0.57, 2.2, 0.05]} />
      </mesh>
      <mesh position={[0, 0, 0.32]} material={m.trim}>
        <boxGeometry args={[0.02, 2.2, 0.01]} />
      </mesh>
      {/* Handles */}
      {([-0.08, 0.08] as number[]).map((x, i) => (
        <group key={i} position={[x, 0, 0.35]}>
          <mesh material={m.chrome}>
            <boxGeometry args={[0.035, 0.26, 0.035]} />
          </mesh>
          <mesh position={[0, 0.14, 0]} material={m.chrome}><boxGeometry args={[0.048, 0.04, 0.04]} /></mesh>
          <mesh position={[0, -0.14, 0]} material={m.chrome}><boxGeometry args={[0.048, 0.04, 0.04]} /></mesh>
        </group>
      ))}
      {/* Crown + base */}
      <mesh position={[0, 1.27, 0]} material={m.trim} castShadow>
        <boxGeometry args={[1.32, 0.1, 0.58]} />
      </mesh>
      <mesh position={[0, -1.27, 0]} material={m.trim}>
        <boxGeometry args={[1.26, 0.1, 0.56]} />
      </mesh>
      {/* Shelves */}
      <mesh position={[0, 0.35, 0]} material={m.shelf}><boxGeometry args={[1.16, 0.018, 0.46]} /></mesh>
      <mesh position={[0, -0.45, 0]} material={m.shelf}><boxGeometry args={[1.16, 0.018, 0.46]} /></mesh>
    </group>
  );
}

function Desk({ pos, rot = 0, scale = 1 }: { pos: [number,number,number]; rot?: number; scale?: number }) {
  const m = useMaterials();
  return (
    <group position={pos} rotation={[0, rot, 0]} scale={scale}>
      {/* Top surface */}
      <mesh position={[0, 0.77, 0]} material={m.wood} castShadow>
        <boxGeometry args={[1.65, 0.055, 0.78]} />
      </mesh>
      {/* Legs */}
      {([[-0.74, 0, -0.34], [0.74, 0, -0.34], [-0.74, 0, 0.34], [0.74, 0, 0.34]] as [number,number,number][]).map((p, i) => (
        <mesh key={i} position={p} material={m.frame} castShadow>
          <boxGeometry args={[0.055, 0.77, 0.055]} />
        </mesh>
      ))}
      {/* Cross rail */}
      <mesh position={[0, 0.36, -0.34]} material={m.frame}><boxGeometry args={[1.48, 0.04, 0.04]} /></mesh>
      {/* Monitor (simplified) */}
      <mesh position={[0, 1.38, -0.28]} material={m.body} castShadow>
        <boxGeometry args={[0.62, 0.38, 0.04]} />
      </mesh>
      <mesh position={[0, 1.14, -0.28]} material={m.frame}>
        <boxGeometry args={[0.06, 0.28, 0.06]} />
      </mesh>
    </group>
  );
}

function BedFrame({ pos, rot = 0, scale = 1 }: { pos: [number,number,number]; rot?: number; scale?: number }) {
  const m = useMaterials();
  return (
    <group position={pos} rotation={[0, rot, 0]} scale={scale}>
      <mesh position={[0, 0.2, 0]} material={m.frame} castShadow receiveShadow>
        <boxGeometry args={[1.65, 0.22, 2.15]} />
      </mesh>
      <mesh position={[0, 0.38, 0]} material={m.body}>
        <boxGeometry args={[1.5, 0.19, 2.0]} />
      </mesh>
      {/* Headboard */}
      <mesh position={[0, 0.72, -1.04]} material={m.frame} castShadow>
        <boxGeometry args={[1.65, 0.72, 0.1]} />
      </mesh>
      <mesh position={[0, 0.32, 1.04]} material={m.frame}>
        <boxGeometry args={[1.65, 0.2, 0.08]} />
      </mesh>
    </group>
  );
}

function FloatingFrame({ pos, size, rot = 0 }: { pos: [number,number,number]; size: [number,number,number]; rot?: number }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#555", wireframe: true, transparent: true, opacity: 0.3 }), []);
  return (
    <mesh position={pos} rotation={[rot, rot * 0.7, 0]} material={mat}>
      <boxGeometry args={size} />
    </mesh>
  );
}

function GridFloor() {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#333", wireframe: true, transparent: true, opacity: 0.2 }), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.2, -15]} material={mat}>
      <planeGeometry args={[80, 60, 50, 36]} />
    </mesh>
  );
}

function Particles() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 150;
  const data = useMemo(() => Array.from({ length: N }, () => ({
    x: (Math.random() - 0.5) * 28,
    y: (Math.random() - 0.5) * 18,
    z: Math.random() * -36,
    spd: 0.1 + Math.random() * 0.5,
    off: Math.random() * Math.PI * 2,
    sz:  0.012 + Math.random() * 0.035,
  })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    data.forEach((p, i) => {
      dummy.position.set(
        p.x + Math.sin(t * p.spd * 0.5 + p.off) * 0.5,
        p.y + Math.sin(t * p.spd + p.off) * 0.8,
        p.z
      );
      dummy.scale.setScalar(p.sz * (0.8 + Math.sin(t * p.spd + p.off) * 0.2));
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshBasicMaterial color="#aaaaff" transparent opacity={0.35} />
    </instancedMesh>
  );
}

function SceneObjects({ scrollProgress }: { scrollProgress: number }) {
  const ref = useRef<THREE.Group>(null);
  let elapsed = 0;

  useFrame((_, delta) => {
    elapsed += delta;
    if (!ref.current) return;
    // Slow continuous rotation of the whole scene for life
    ref.current.rotation.y = elapsed * 0.025;
  });

  return (
    <group ref={ref}>
      {/* Hero wardrobe — front center */}
      <Wardrobe pos={[0, -0.5, 0]} rot={Math.PI / 8} scale={1.05} />
      {/* Second wardrobe — left mid */}
      <Wardrobe pos={[-8, -0.5, -10]} rot={-Math.PI / 5} scale={0.9} />
      {/* Third wardrobe — right deep */}
      <Wardrobe pos={[9, -0.5, -18]} rot={Math.PI / 4} scale={0.8} />

      {/* Desks */}
      <Desk pos={[6, -2.5, -7]} rot={-Math.PI / 6} scale={1.0} />
      <Desk pos={[-7, -2.5, -22]} rot={Math.PI / 5} scale={0.85} />

      {/* Bed frames */}
      <BedFrame pos={[-5, -3.0, -14]} rot={Math.PI / 7} scale={0.9} />
      <BedFrame pos={[7, -3.0, -26]} rot={-Math.PI / 6} scale={0.85} />

      {/* Floating wireframe boxes — design accents */}
      <FloatingFrame pos={[4, 3, -5]} size={[2.5, 2.5, 2.5]} rot={0.4} />
      <FloatingFrame pos={[-5, 4, -12]} size={[3, 1.5, 3]} rot={0.7} />
      <FloatingFrame pos={[8, 2, -20]} size={[2, 3, 2]} rot={1.1} />
      <FloatingFrame pos={[-9, 1, -28]} size={[4, 4, 4]} rot={0.2} />

      <GridFloor />
      <Particles />
    </group>
  );
}

function CameraRig({ scrollProgress, mouseX, mouseY }: { scrollProgress: number; mouseX: number; mouseY: number }) {
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(0, 2.5, 20));
  const tgt = useRef(new THREE.Vector3(0, 0.5, 0));

  useFrame(() => {
    const k = samplePath(scrollProgress);
    const dPos = new THREE.Vector3(
      k.px + mouseX * 0.8,
      k.py + mouseY * -0.5,
      k.pz
    );
    const dTgt = new THREE.Vector3(k.tx, k.ty, k.tz);
    pos.current.lerp(dPos, 0.038);
    tgt.current.lerp(dTgt, 0.038);
    camera.position.copy(pos.current);
    camera.lookAt(tgt.current);
  });
  return null;
}

function Scene({ scrollProgress, mouseX, mouseY }: { scrollProgress: number; mouseX: number; mouseY: number }) {
  return (
    <>
      {/* Ambient — low, dramatic */}
      <ambientLight intensity={0.35} color="#aabbff" />

      {/* Key light — warm, from top-front-right */}
      <directionalLight position={[8, 14, 10]} intensity={4.5} color="#fff5e0" castShadow
        shadow-mapSize={[1024, 1024]} shadow-camera-far={80} />

      {/* Fill light — cool blue from left */}
      <directionalLight position={[-10, 6, -4]} intensity={1.8} color="#8899ff" />

      {/* Rim / back light — separates models from background */}
      <directionalLight position={[0, -4, -14]} intensity={1.5} color="#ffffff" />

      {/* Accent point lights */}
      <pointLight position={[0, 6, 4]}   intensity={35} color="#ffffff" distance={22} />
      <pointLight position={[-6, 4, -8]} intensity={18} color="#aabbff" distance={20} />
      <pointLight position={[8, 3, -16]} intensity={14} color="#ffeedd" distance={22} />
      <pointLight position={[0, 2, -24]} intensity={10} color="#ffffff"  distance={18} />

      <SceneObjects scrollProgress={scrollProgress} />
      <CameraRig scrollProgress={scrollProgress} mouseX={mouseX} mouseY={mouseY} />
    </>
  );
}

export default function PageBgScene({
  scrollProgress, mouseX, mouseY,
}: { scrollProgress: number; mouseX: number; mouseY: number }) {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  useEffect(() => { setWebglOk(checkWebGL()); }, []);
  if (!webglOk) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}>
      <Canvas
        camera={{ position: [0, 2.5, 20], fov: 50, near: 0.1, far: 140 }}
        style={{ background: "transparent" }}
        shadows
        gl={{ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false }}
        dpr={[1, 1.5]}
      >
        <fog attach="fog" args={["#080814", 28, 80]} />
        <Scene scrollProgress={scrollProgress} mouseX={mouseX} mouseY={mouseY} />
      </Canvas>
    </div>
  );
}
