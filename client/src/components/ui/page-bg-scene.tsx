import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";

/* ─── WebGL check ─── */
function checkWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch { return false; }
}

const lerp = THREE.MathUtils.lerp;

/* ─── Easing ─── */
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function easeOut(t: number) { return 1 - (1 - t) * (1 - t); }

/* ─── Shared materials (silver/metallic palette) ─── */
function useMaterials() {
  return useMemo(() => ({
    body:   new THREE.MeshStandardMaterial({ color: "#9a9a9a", roughness: 0.22, metalness: 0.88 }),
    door:   new THREE.MeshStandardMaterial({ color: "#b8b8b8", roughness: 0.12, metalness: 0.92 }),
    chrome: new THREE.MeshStandardMaterial({ color: "#e0e0e0", roughness: 0.02, metalness: 1.0, emissive: "#555" }),
    trim:   new THREE.MeshStandardMaterial({ color: "#686868", roughness: 0.40, metalness: 0.55 }),
    shelf:  new THREE.MeshStandardMaterial({ color: "#909090", roughness: 0.48, metalness: 0.40 }),
    desk:   new THREE.MeshStandardMaterial({ color: "#7a7a7a", roughness: 0.38, metalness: 0.62 }),
    wood:   new THREE.MeshStandardMaterial({ color: "#8a7560", roughness: 0.72, metalness: 0.08 }),
    frame:  new THREE.MeshStandardMaterial({ color: "#505050", roughness: 0.30, metalness: 0.78 }),
    accent: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.05, metalness: 1.0, emissive: "#888" }),
  }), []);
}

/* ══════════════════════════════════════════════════════
   DISMANTLING WARDROBE
   progress 0 → assembled  |  progress 1 → fully dismantled
   Scroll back = reassembles in reverse
══════════════════════════════════════════════════════ */
function DismantleWardrobe({ progress }: { progress: number }) {
  const m = useMaterials();
  const p = easeInOut(Math.max(0, Math.min(1, progress)));
  const po = easeOut(Math.max(0, Math.min(1, progress)));   // faster pop out

  return (
    <group position={[0, -0.2, 0]}>

      {/* ── LEFT SIDE PANEL ── slides left + spin */}
      <mesh
        position={[lerp(-0.625, -7.5, po), lerp(0, 0.8, p), lerp(0, -1.5, p)]}
        rotation={[lerp(0, 0.4, p), lerp(0, -2.2, po), lerp(0, 0.7, p)]}
        material={m.body} castShadow>
        <boxGeometry args={[0.058, 2.38, 0.54]} />
      </mesh>

      {/* ── RIGHT SIDE PANEL ── slides right + spin */}
      <mesh
        position={[lerp(0.625, 7.5, po), lerp(0, 0.8, p), lerp(0, -1.5, p)]}
        rotation={[lerp(0, -0.4, p), lerp(0, 2.2, po), lerp(0, -0.7, p)]}
        material={m.body} castShadow>
        <boxGeometry args={[0.058, 2.38, 0.54]} />
      </mesh>

      {/* ── TOP PANEL ── flies upward + tumbles */}
      <mesh
        position={[lerp(0, 1.5, p), lerp(1.23, 9, po), lerp(0, -3, p)]}
        rotation={[lerp(0, -1.4, po), lerp(0, 1.2, p), lerp(0, 0.5, p)]}
        material={m.trim} castShadow>
        <boxGeometry args={[1.32, 0.072, 0.58]} />
      </mesh>

      {/* ── BOTTOM PANEL ── falls down + slides forward */}
      <mesh
        position={[lerp(0, -1.8, p), lerp(-1.23, -7, po), lerp(0, 4, p)]}
        rotation={[lerp(0, 1.8, po), lerp(0, -0.9, p), lerp(0, -0.4, p)]}
        material={m.trim}>
        <boxGeometry args={[1.32, 0.072, 0.58]} />
      </mesh>

      {/* ── BACK PANEL ── pulls away backwards */}
      <mesh
        position={[lerp(0, 2, p), lerp(0, 2.5, p), lerp(-0.27, -8.5, po)]}
        rotation={[lerp(0, 0.6, p), lerp(0, 0.3, p), lerp(0, 0.2, p)]}
        material={m.shelf} castShadow>
        <boxGeometry args={[1.2, 2.34, 0.024]} />
      </mesh>

      {/* ── LEFT DOOR ── swings open then launches left */}
      <mesh
        position={[
          lerp(-0.31, -8, po),
          lerp(0, -0.5, p),
          lerp(0.29, 3.5, p),
        ]}
        rotation={[
          lerp(0, 0.5, p),
          lerp(0, -Math.PI * 2.2, po),
          lerp(0, -0.9, p),
        ]}
        material={m.door} castShadow>
        <boxGeometry args={[0.575, 2.22, 0.052]} />
      </mesh>
      {/* Left handle */}
      <mesh
        position={[
          lerp(-0.31 + 0.08, -8 + 0.08, po),
          lerp(0, -0.5, p),
          lerp(0.32, 3.55, p),
        ]}
        rotation={[lerp(0, 0.5, p), lerp(0, -Math.PI * 2.2, po), lerp(0, -0.9, p)]}
        material={m.chrome}>
        <boxGeometry args={[0.036, 0.27, 0.036]} />
      </mesh>

      {/* ── RIGHT DOOR ── swings open then launches right */}
      <mesh
        position={[
          lerp(0.31, 8, po),
          lerp(0, -0.5, p),
          lerp(0.29, 3.5, p),
        ]}
        rotation={[
          lerp(0, -0.5, p),
          lerp(0, Math.PI * 2.2, po),
          lerp(0, 0.9, p),
        ]}
        material={m.door} castShadow>
        <boxGeometry args={[0.575, 2.22, 0.052]} />
      </mesh>
      {/* Right handle */}
      <mesh
        position={[
          lerp(0.31 - 0.08, 8 - 0.08, po),
          lerp(0, -0.5, p),
          lerp(0.32, 3.55, p),
        ]}
        rotation={[lerp(0, -0.5, p), lerp(0, Math.PI * 2.2, po), lerp(0, 0.9, p)]}
        material={m.chrome}>
        <boxGeometry args={[0.036, 0.27, 0.036]} />
      </mesh>

      {/* ── SHELF TOP ── spins up and to the right */}
      <mesh
        position={[lerp(0, 6, po), lerp(0.35, 6, po), lerp(0, -3.5, p)]}
        rotation={[lerp(0, 1.6, po), lerp(0, 3.8, po), lerp(0, 0.4, p)]}
        material={m.shelf}>
        <boxGeometry args={[1.18, 0.020, 0.47]} />
      </mesh>

      {/* ── SHELF MID ── launches backwards-left */}
      <mesh
        position={[lerp(0, -6.5, po), lerp(-0.45, -3, p), lerp(0, 5.5, po)]}
        rotation={[lerp(0, -2.5, po), lerp(0, -2.0, po), lerp(0, 0.5, p)]}
        material={m.shelf}>
        <boxGeometry args={[1.18, 0.020, 0.47]} />
      </mesh>

      {/* ── SHELF BOTTOM ── rockets diagonally */}
      <mesh
        position={[lerp(0, 5.5, po), lerp(-0.8, -7, po), lerp(0, 2, p)]}
        rotation={[lerp(0, 2.8, po), lerp(0, -3.4, po), lerp(0, -0.6, p)]}
        material={m.shelf}>
        <boxGeometry args={[1.18, 0.020, 0.47]} />
      </mesh>

      {/* ── CROWN TRIM (top rail) ── */}
      <mesh
        position={[lerp(0, -2, p), lerp(1.28, 9.5, po), lerp(0, -2.5, p)]}
        rotation={[lerp(0, -1.0, po), lerp(0, 1.5, po), lerp(0, 0.3, p)]}
        material={m.accent}>
        <boxGeometry args={[1.34, 0.11, 0.60]} />
      </mesh>

      {/* ── BASE TRIM ── */}
      <mesh
        position={[lerp(0, 2.5, p), lerp(-1.28, -8.5, po), lerp(0, 3, p)]}
        rotation={[lerp(0, 1.2, po), lerp(0, -1.6, p), lerp(0, -0.3, p)]}
        material={m.accent}>
        <boxGeometry args={[1.28, 0.11, 0.58]} />
      </mesh>

      {/* ── CENTER DIVIDER (vertical mid-panel) ── */}
      <mesh
        position={[lerp(0, 0, p), lerp(0, 0, p), lerp(-0.26, -7, po)]}
        rotation={[lerp(0, 0.3, p), lerp(0, Math.PI, po), lerp(0, 0.5, p)]}
        material={m.body}>
        <boxGeometry args={[0.04, 2.3, 0.44]} />
      </mesh>
    </group>
  );
}

/* ─── Background desk (stable, for depth) ─── */
function BackgroundDesk({ pos, rot }: { pos: [number,number,number]; rot: number }) {
  const m = useMaterials();
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.77, 0]} material={m.wood} castShadow>
        <boxGeometry args={[1.65, 0.055, 0.78]} />
      </mesh>
      {([[-0.74,0,-0.34],[0.74,0,-0.34],[-0.74,0,0.34],[0.74,0,0.34]] as [number,number,number][]).map((p,i)=>(
        <mesh key={i} position={p} material={m.frame} castShadow>
          <boxGeometry args={[0.055, 0.77, 0.055]} />
        </mesh>
      ))}
      <mesh position={[0, 0.36, -0.34]} material={m.frame}>
        <boxGeometry args={[1.48, 0.04, 0.04]} />
      </mesh>
    </group>
  );
}

/* ─── Background bed frame ─── */
function BackgroundBed({ pos, rot }: { pos: [number,number,number]; rot: number }) {
  const m = useMaterials();
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.2, 0]} material={m.frame} castShadow receiveShadow>
        <boxGeometry args={[1.65, 0.22, 2.15]} />
      </mesh>
      <mesh position={[0, 0.38, 0]} material={m.body}>
        <boxGeometry args={[1.5, 0.19, 2.0]} />
      </mesh>
      <mesh position={[0, 0.72, -1.04]} material={m.frame} castShadow>
        <boxGeometry args={[1.65, 0.72, 0.1]} />
      </mesh>
      <mesh position={[0, 0.32, 1.04]} material={m.frame}>
        <boxGeometry args={[1.65, 0.2, 0.08]} />
      </mesh>
    </group>
  );
}

/* ─── Floating wireframe geometry (architectural depth cues) ─── */
function FloatBox({ pos, size, rotSeed }: { pos: [number,number,number]; size: [number,number,number]; rotSeed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#666", wireframe: true, transparent: true, opacity: 0.22 }), []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 0.18;
    ref.current.rotation.x = t * rotSeed;
    ref.current.rotation.y = t * rotSeed * 0.7;
  });
  return <mesh ref={ref} position={pos} material={mat}><boxGeometry args={size} /></mesh>;
}

/* ─── Particles ─── */
function Particles({ dismantleP }: { dismantleP: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 180;
  const data = useMemo(() => Array.from({ length: N }, () => ({
    x: (Math.random() - 0.5) * 24,
    y: (Math.random() - 0.5) * 14,
    z: Math.random() * -32,
    vx: (Math.random() - 0.5) * 12,
    vy: (Math.random() - 0.5) * 12,
    vz: (Math.random() - 0.5) * 8,
    spd: 0.15 + Math.random() * 0.6,
    off: Math.random() * Math.PI * 2,
    sz:  0.015 + Math.random() * 0.04,
  })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    data.forEach((p, i) => {
      const burst = dismantleP * 4.5;
      dummy.position.set(
        p.x + Math.sin(t * p.spd * 0.5 + p.off) * 0.6 + p.vx * dismantleP,
        p.y + Math.sin(t * p.spd + p.off) * 0.8 + p.vy * dismantleP,
        p.z + p.vz * dismantleP * 0.4
      );
      dummy.scale.setScalar(p.sz * (1 + burst * 0.25));
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshBasicMaterial color="#aaaaff" transparent opacity={0.3} />
    </instancedMesh>
  );
}

/* ─── Grid floor ─── */
function GridFloor() {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#3a3a5a", wireframe: true, transparent: true, opacity: 0.18 }), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.5, -15]} material={mat}>
      <planeGeometry args={[80, 60, 50, 36]} />
    </mesh>
  );
}

/* ─── Camera rig — orbits around wardrobe while it dismantles ─── */
function CameraRig({
  dismantleP, mouseX, mouseY,
}: { dismantleP: number; mouseX: number; mouseY: number }) {
  const { camera } = useThree();
  const camPos = useRef(new THREE.Vector3(0, 1.2, 7));
  const camTgt = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const p = easeInOut(dismantleP);
    // Orbit: starts front-center, swings 45° right and pulls back as dismantle progresses
    const angle = lerp(0, Math.PI * 0.32, p);
    const dist  = lerp(7, 11, p);
    const height= lerp(1.2, 3.5, p);

    const targetCamX = Math.sin(angle) * dist + mouseX * 0.7;
    const targetCamY = height + mouseY * -0.4;
    const targetCamZ = Math.cos(angle) * dist;

    const targetLookX = lerp(0, 1.2, p);
    const targetLookY = lerp(0, 0.8, p);

    camPos.current.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.04);
    camTgt.current.lerp(new THREE.Vector3(targetLookX, targetLookY, 0), 0.04);

    camera.position.copy(camPos.current);
    camera.lookAt(camTgt.current);
  });
  return null;
}

/* ─── Scene ─── */
function Scene({
  dismantleP, mouseX, mouseY,
}: { dismantleP: number; mouseX: number; mouseY: number }) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} color="#99aaff" />
      <directionalLight position={[8, 16, 10]}  intensity={5.0} color="#fff5e8" castShadow
        shadow-mapSize={[1024, 1024]} shadow-camera-far={80} />
      <directionalLight position={[-10, 6, -4]} intensity={2.2} color="#7799ff" />
      <directionalLight position={[0, -3, -12]} intensity={1.8} color="#ffffff" />
      <pointLight position={[0, 8, 5]}   intensity={40} color="#ffffff" distance={24} />
      <pointLight position={[-5, 4, -6]} intensity={22} color="#aabbff" distance={20} />
      <pointLight position={[6, 3, -14]} intensity={16} color="#ffeedd" distance={22} />
      <pointLight position={[0, 2, -22]} intensity={12} color="#ffffff"  distance={20} />

      {/* HERO: the main dismantling wardrobe */}
      <DismantleWardrobe progress={dismantleP} />

      {/* Background furniture for depth */}
      <BackgroundDesk pos={[-8, -2.5, -12]} rot={-Math.PI / 5} />
      <BackgroundDesk pos={[9, -2.5, -20]}  rot={Math.PI / 6} />
      <BackgroundBed  pos={[-6, -3.2, -18]} rot={Math.PI / 7} />
      <BackgroundBed  pos={[7, -3.2, -28]}  rot={-Math.PI / 6} />

      {/* Wireframe accent geometry */}
      <FloatBox pos={[5,  3.5,  -6]}  size={[2.5, 2.5, 2.5]} rotSeed={0.4} />
      <FloatBox pos={[-6, 4.5, -14]}  size={[3.0, 1.8, 3.0]} rotSeed={0.6} />
      <FloatBox pos={[9,  2.5, -22]}  size={[2.0, 3.5, 2.0]} rotSeed={0.9} />
      <FloatBox pos={[-10,2.0, -30]}  size={[4.0, 4.0, 4.0]} rotSeed={0.2} />

      <GridFloor />
      <Particles dismantleP={dismantleP} />

      <CameraRig dismantleP={dismantleP} mouseX={mouseX} mouseY={mouseY} />
    </>
  );
}

/* ─── Public component ─── */
export default function PageBgScene({
  scrollProgress, mouseX, mouseY,
}: {
  scrollProgress: number;
  mouseX: number;
  mouseY: number;
}) {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  useEffect(() => { setWebglOk(checkWebGL()); }, []);
  if (!webglOk) return null;

  // Map full page scroll to dismantle progress (0 = assembled, 1 = fully apart)
  const dismantleP = Math.max(0, Math.min(1, scrollProgress / 0.75));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}>
      <Canvas
        camera={{ position: [0, 1.2, 7], fov: 50, near: 0.1, far: 140 }}
        style={{ background: "transparent" }}
        shadows
        gl={{ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false }}
        dpr={[1, 1.5]}
      >
        <fog attach="fog" args={["#080814", 30, 90]} />
        <Scene dismantleP={dismantleP} mouseX={mouseX} mouseY={mouseY} />
      </Canvas>
    </div>
  );
}
