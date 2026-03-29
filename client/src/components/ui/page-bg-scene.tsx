import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";

function checkWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch { return false; }
}

const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function easeOut(t: number) { return 1 - (1 - t) * (1 - t); }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

/* ─── Phase helpers ─── */
function phase(progress: number, start: number, end: number) {
  return clamp((progress - start) / (end - start), 0, 1);
}

/* ─── Procedural wood texture ─── */
function makeWoodTexture(w = 128, h = 512): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d")!;
  const base = ctx.createLinearGradient(0, 0, w, 0);
  base.addColorStop(0.00, "#d6c4a4");
  base.addColorStop(0.25, "#c9b58e");
  base.addColorStop(0.55, "#d4c09a");
  base.addColorStop(0.80, "#bea87c");
  base.addColorStop(1.00, "#cdb98b");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * w;
    const alpha = 0.04 + Math.random() * 0.1;
    ctx.strokeStyle = `rgba(80,50,20,${alpha})`;
    ctx.lineWidth = 0.4 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x + (Math.random() - 0.5) * 4, 0);
    ctx.bezierCurveTo(
      x + (Math.random() - 0.5) * 6, h * 0.33,
      x + (Math.random() - 0.5) * 6, h * 0.66,
      x + (Math.random() - 0.5) * 4, h
    );
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  return tex;
}

/* ─── PBR material palette ─── */
function useMaterials() {
  return useMemo(() => {
    const woodTex = makeWoodTexture();
    return {
      lacquer: new THREE.MeshPhysicalMaterial({
        color: "#f4f1ec",
        roughness: 0.08,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      }),
      lacquerDeep: new THREE.MeshPhysicalMaterial({
        color: "#ede9e2",
        roughness: 0.10,
        metalness: 0.0,
        clearcoat: 0.85,
        clearcoatRoughness: 0.08,
      }),
      mirror: new THREE.MeshPhysicalMaterial({
        color: "#c8d4e0",
        roughness: 0.04,
        metalness: 0.85,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        reflectivity: 1.0,
      }),
      wood: new THREE.MeshStandardMaterial({
        map: woodTex,
        roughness: 0.72,
        metalness: 0.0,
      }),
      chrome: new THREE.MeshStandardMaterial({
        color: "#d6d6d6",
        roughness: 0.04,
        metalness: 1.0,
        envMapIntensity: 2.0,
      }),
      back: new THREE.MeshStandardMaterial({
        color: "#e8e3db",
        roughness: 0.55,
        metalness: 0.0,
      }),
      floor: new THREE.MeshStandardMaterial({
        color: "#1a1a2e",
        roughness: 0.85,
        metalness: 0.08,
        transparent: true,
        opacity: 0.0,
      }),
    };
  }, []);
}

/* ══════════════════════════════════════════════════════════════════
   REALISTIC PAX-STYLE WARDROBE
   Dimensions (Three.js units, 1 unit ≈ 1m):
     Width: 1.26 m  |  Depth: 0.60 m  |  Height: 2.40 m
   Assembled: progress 0  →  Dismantled: progress 1
══════════════════════════════════════════════════════════════════ */
function WardrobeUnit({ progress }: { progress: number }) {
  const m = useMaterials();

  /* ── Phase breakdown ──
     [0.00 – 0.20] doors swing open on hinges
     [0.20 – 0.48] shelves & divider fly out
     [0.48 – 1.00] body panels explode apart
  */
  const pDoor   = easeOut(phase(progress, 0.00, 0.22));
  const pShelf  = easeOut(phase(progress, 0.20, 0.50));
  const pExplode = easeInOut(phase(progress, 0.44, 1.00));
  const pPop    = easeOutCubic(phase(progress, 0.44, 1.00));

  const W  = 1.26;   // outer width
  const H  = 2.40;   // outer height
  const D  = 0.60;   // outer depth
  const T  = 0.022;  // panel thickness
  const iW = W - T * 2;   // inner width
  const iH = H - T * 2;
  const halfH = H / 2;

  return (
    <group position={[0, -halfH, 0]}>

      {/* ── BACK PANEL ── slides deep backward then flies */}
      <mesh
        position={[
          lerp(0, lerp(0, 3.5, pExplode), pExplode),
          lerp(halfH, halfH + lerp(0, 2.5, pExplode), pExplode),
          lerp(-D / 2 + T / 2, -D / 2 + T / 2 - lerp(0, 9, pPop), pExplode),
        ]}
        rotation={[lerp(0, 0.5, pExplode), lerp(0, 0.4, pExplode), lerp(0, 0.25, pExplode)]}
        material={m.back}
      >
        <boxGeometry args={[iW, iH, T * 0.7]} />
      </mesh>

      {/* ── LEFT SIDE PANEL ── slides left and spins */}
      <mesh
        position={[
          lerp(-W / 2 + T / 2, -W / 2 + T / 2 - lerp(0, 8.5, pPop), pExplode),
          lerp(halfH, halfH + lerp(0, 0.8, pExplode), pExplode),
          lerp(0, lerp(0, -1.8, pExplode), pExplode),
        ]}
        rotation={[lerp(0, 0.45, pExplode), lerp(0, -2.4, pPop), lerp(0, 0.7, pExplode)]}
        material={m.lacquer}
        castShadow
      >
        <boxGeometry args={[T, H, D]} />
      </mesh>

      {/* ── RIGHT SIDE PANEL ── mirror of left */}
      <mesh
        position={[
          lerp(W / 2 - T / 2, W / 2 - T / 2 + lerp(0, 8.5, pPop), pExplode),
          lerp(halfH, halfH + lerp(0, 0.8, pExplode), pExplode),
          lerp(0, lerp(0, -1.8, pExplode), pExplode),
        ]}
        rotation={[lerp(0, -0.45, pExplode), lerp(0, 2.4, pPop), lerp(0, -0.7, pExplode)]}
        material={m.lacquer}
        castShadow
      >
        <boxGeometry args={[T, H, D]} />
      </mesh>

      {/* ── TOP PANEL ── tumbles up */}
      <mesh
        position={[
          lerp(0, lerp(0, 1.8, pExplode), pExplode),
          lerp(H - T / 2, H - T / 2 + lerp(0, 8.8, pPop), pExplode),
          lerp(0, lerp(0, -2.5, pExplode), pExplode),
        ]}
        rotation={[lerp(0, -1.5, pPop), lerp(0, 1.3, pExplode), lerp(0, 0.5, pExplode)]}
        material={m.lacquer}
        castShadow
      >
        <boxGeometry args={[W, T, D]} />
      </mesh>

      {/* ── BOTTOM PANEL ── drops down */}
      <mesh
        position={[
          lerp(0, lerp(0, -2.0, pExplode), pExplode),
          lerp(T / 2, T / 2 - lerp(0, 7.5, pPop), pExplode),
          lerp(0, lerp(0, 4.2, pExplode), pExplode),
        ]}
        rotation={[lerp(0, 2.0, pPop), lerp(0, -1.0, pExplode), lerp(0, -0.4, pExplode)]}
        material={m.lacquer}
      >
        <boxGeometry args={[W, T, D]} />
      </mesh>

      {/* ── BASE PLINTH ── front trim piece */}
      <mesh
        position={[
          lerp(0, 2.8, pPop),
          lerp(0.055, 0.055 - lerp(0, 7, pPop), pExplode),
          lerp(D / 2 - 0.03, D / 2 + lerp(0, 3.5, pExplode), pExplode),
        ]}
        rotation={[lerp(0, 1.4, pPop), lerp(0, -1.8, pExplode), lerp(0, -0.3, pExplode)]}
        material={m.lacquerDeep}
      >
        <boxGeometry args={[W, 0.11, 0.04]} />
      </mesh>

      {/* ── CENTER DIVIDER ── pulls backward then up */}
      <mesh
        position={[
          lerp(0, lerp(0, 0.3, pShelf), pShelf),
          lerp(halfH, halfH + lerp(0, 7.5, pShelf * pShelf), pShelf),
          lerp(0, lerp(0, -6, easeOut(pShelf)), pShelf),
        ]}
        rotation={[lerp(0, 0.3, pShelf), lerp(0, Math.PI * 0.8, easeOut(pShelf)), lerp(0, 0.5, pShelf)]}
        material={m.lacquer}
        castShadow
      >
        <boxGeometry args={[T, iH - T, D - T * 2]} />
      </mesh>

      {/* ── SHELF 1 (top) ── rockets up-right */}
      <mesh
        position={[
          lerp(0, lerp(0, 6.5, pShelf), pShelf),
          lerp(H * 0.62, H * 0.62 + lerp(0, 6, pShelf * pShelf), pShelf),
          lerp(0, lerp(0, -4, easeOut(pShelf)), pShelf),
        ]}
        rotation={[lerp(0, 1.8, easeOut(pShelf)), lerp(0, 4.2, easeOut(pShelf)), lerp(0, 0.5, pShelf)]}
        material={m.wood}
        castShadow
      >
        <boxGeometry args={[(iW - T * 2) / 2, T, D - T * 2]} />
      </mesh>

      {/* ── SHELF 2 (mid) ── flies backward-left */}
      <mesh
        position={[
          lerp(0, lerp(0, -7, pShelf), pShelf),
          lerp(H * 0.40, H * 0.40 - lerp(0, 3.5, pShelf), pShelf),
          lerp(0, lerp(0, 6, easeOut(pShelf)), pShelf),
        ]}
        rotation={[lerp(0, -2.8, easeOut(pShelf)), lerp(0, -2.2, easeOut(pShelf)), lerp(0, 0.4, pShelf)]}
        material={m.wood}
        castShadow
      >
        <boxGeometry args={[(iW - T * 2) / 2, T, D - T * 2]} />
      </mesh>

      {/* ── SHELF 3 (lower) ── diagonal */}
      <mesh
        position={[
          lerp(0, lerp(0, 6, pShelf), pShelf),
          lerp(H * 0.22, H * 0.22 - lerp(0, 7.2, pShelf * pShelf), pShelf),
          lerp(0, lerp(0, 2.5, pShelf), pShelf),
        ]}
        rotation={[lerp(0, 3.1, easeOut(pShelf)), lerp(0, -3.8, easeOut(pShelf)), lerp(0, -0.6, pShelf)]}
        material={m.wood}
        castShadow
      >
        <boxGeometry args={[(iW - T * 2) / 2, T, D - T * 2]} />
      </mesh>

      {/* ── LEFT DOOR GROUP ── hinges from left edge, swings open CCW */}
      <group
        position={[
          lerp(-W / 2 + T + W / 4, -W / 2 + T + W / 4 - lerp(0, 8, pPop), pExplode),
          lerp(halfH, halfH - lerp(0, 0.5, pExplode), pExplode),
          lerp(D / 2 + 0.012, D / 2 + 0.012 + lerp(0, 4, pExplode), pExplode),
        ]}
        rotation={[
          lerp(0, 0.4, pExplode),
          lerp(0, -Math.PI * 0.72 - Math.PI * 1.8 * pExplode, pDoor),
          lerp(0, -0.85, pExplode),
        ]}
      >
        <mesh material={m.mirror} castShadow>
          <boxGeometry args={[iW / 2 - T / 2, iH, 0.024]} />
        </mesh>
        {/* H-bar handle */}
        <mesh
          position={[iW / 4 - 0.04, 0, 0.018]}
          rotation={[0, 0, 0]}
          material={m.chrome}
        >
          <boxGeometry args={[0.010, 0.26, 0.010]} />
        </mesh>
        <mesh position={[iW / 4 - 0.04, 0.10, 0.022]} material={m.chrome}>
          <boxGeometry args={[0.028, 0.010, 0.008]} />
        </mesh>
        <mesh position={[iW / 4 - 0.04, -0.10, 0.022]} material={m.chrome}>
          <boxGeometry args={[0.028, 0.010, 0.008]} />
        </mesh>
      </group>

      {/* ── RIGHT DOOR GROUP ── hinges from right edge, swings open CW */}
      <group
        position={[
          lerp(W / 2 - T - W / 4, W / 2 - T - W / 4 + lerp(0, 8, pPop), pExplode),
          lerp(halfH, halfH - lerp(0, 0.5, pExplode), pExplode),
          lerp(D / 2 + 0.012, D / 2 + 0.012 + lerp(0, 4, pExplode), pExplode),
        ]}
        rotation={[
          lerp(0, -0.4, pExplode),
          lerp(0, Math.PI * 0.72 + Math.PI * 1.8 * pExplode, pDoor),
          lerp(0, 0.85, pExplode),
        ]}
      >
        <mesh material={m.mirror} castShadow>
          <boxGeometry args={[iW / 2 - T / 2, iH, 0.024]} />
        </mesh>
        {/* H-bar handle */}
        <mesh
          position={[-(iW / 4 - 0.04), 0, 0.018]}
          material={m.chrome}
        >
          <boxGeometry args={[0.010, 0.26, 0.010]} />
        </mesh>
        <mesh position={[-(iW / 4 - 0.04), 0.10, 0.022]} material={m.chrome}>
          <boxGeometry args={[0.028, 0.010, 0.008]} />
        </mesh>
        <mesh position={[-(iW / 4 - 0.04), -0.10, 0.022]} material={m.chrome}>
          <boxGeometry args={[0.028, 0.010, 0.008]} />
        </mesh>
      </group>

    </group>
  );
}

/* ─── Subtle background furniture (depth cues) ─── */
function BGFurniture() {
  const m = useMaterials();
  return (
    <group>
      {/* Far-left desk */}
      <group position={[-5.5, -2.8, -10]} rotation={[0, Math.PI / 5, 0]}>
        <mesh position={[0, 0.77, 0]} material={m.wood} castShadow>
          <boxGeometry args={[1.5, 0.05, 0.72]} />
        </mesh>
        {([-0.7, -0.7, 0.7, 0.7] as number[]).map((x, i) => (
          <mesh key={i} position={[x, 0.35, i < 2 ? -0.3 : 0.3]} material={m.lacquerDeep}>
            <boxGeometry args={[0.05, 0.7, 0.05]} />
          </mesh>
        ))}
      </group>
      {/* Far-right desk */}
      <group position={[6.5, -2.8, -16]} rotation={[0, -Math.PI / 6, 0]}>
        <mesh position={[0, 0.77, 0]} material={m.wood} castShadow>
          <boxGeometry args={[1.6, 0.05, 0.75]} />
        </mesh>
        {([-0.72, -0.72, 0.72, 0.72] as number[]).map((x, i) => (
          <mesh key={i} position={[x, 0.35, i < 2 ? -0.32 : 0.32]} material={m.lacquerDeep}>
            <boxGeometry args={[0.05, 0.7, 0.05]} />
          </mesh>
        ))}
      </group>
      {/* Bed frame far-left */}
      <group position={[-7, -3.0, -18]} rotation={[0, Math.PI / 7, 0]}>
        <mesh position={[0, 0.24, 0]} material={m.lacquer} castShadow>
          <boxGeometry args={[1.62, 0.22, 2.1]} />
        </mesh>
        <mesh position={[0, 0.68, -1.0]} material={m.lacquer} castShadow>
          <boxGeometry args={[1.62, 0.68, 0.1]} />
        </mesh>
      </group>
    </group>
  );
}

/* ─── Amber debris particles (TMG brand color) ─── */
function Particles({ dismantleP }: { dismantleP: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 200;
  const data = useMemo(() => Array.from({ length: N }, (_, i) => ({
    ox: (Math.random() - 0.5) * 2.5,
    oy: Math.random() * 2.2,
    oz: (Math.random() - 0.5) * 1.2,
    vx: (Math.random() - 0.5) * 14,
    vy: -2 + Math.random() * 8,
    vz: (Math.random() - 0.5) * 10,
    spd: 0.2 + Math.random() * 0.5,
    off: (Math.random() * Math.PI * 2),
    sz: 0.008 + Math.random() * 0.025,
    type: i % 3,
  })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const matGold = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#f59e0b",
    emissive: "#b45309",
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.6,
    transparent: true,
    opacity: 0.85,
  }), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const burst = easeOut(clamp(dismantleP * 3.5 - 0.3, 0, 1));
    data.forEach((p, i) => {
      const wobble = Math.sin(t * p.spd + p.off) * 0.4;
      dummy.position.set(
        p.ox + p.vx * burst + wobble,
        p.oy + p.vy * burst + Math.abs(Math.sin(t * p.spd * 0.5 + p.off)) * 0.3,
        p.oz + p.vz * burst * 0.6,
      );
      const scale = p.sz * (1 + burst * 0.8);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    (ref.current.material as THREE.MeshStandardMaterial).opacity =
      clamp(dismantleP * 4 - 0.2, 0, 1) * clamp(2 - dismantleP * 2.5, 0, 1) * 0.75;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, matGold, N]}>
      <sphereGeometry args={[1, 5, 5]} />
    </instancedMesh>
  );
}

/* ─── Camera rig ─── */
function CameraRig({ dismantleP, mouseX, mouseY }: { dismantleP: number; mouseX: number; mouseY: number }) {
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(0, 0.8, 7.5));
  const tgt = useRef(new THREE.Vector3(0, 0.4, 0));

  useFrame(() => {
    const p = easeInOut(dismantleP);
    const angle  = lerp(0, Math.PI * 0.28, p);
    const dist   = lerp(7.5, 12, p);
    const height = lerp(0.8, 3.2, p);

    const tx = Math.sin(angle) * dist + mouseX * 0.6;
    const ty = height + mouseY * -0.35;
    const tz = Math.cos(angle) * dist;

    pos.current.lerp(new THREE.Vector3(tx, ty, tz), 0.045);
    tgt.current.lerp(new THREE.Vector3(lerp(0, 1.0, p), lerp(0.4, 0.9, p), 0), 0.045);

    camera.position.copy(pos.current);
    camera.lookAt(tgt.current);
  });
  return null;
}

/* ─── Full scene ─── */
function Scene({ dismantleP, mouseX, mouseY }: { dismantleP: number; mouseX: number; mouseY: number }) {
  return (
    <>
      {/* IBL environment for realistic reflections */}
      <Environment preset="apartment" />

      {/* Lighting setup */}
      <ambientLight intensity={0.4} color="#fff8f0" />

      {/* Key light — warm sun from upper-right-front */}
      <directionalLight
        position={[6, 12, 8]}
        intensity={4.5}
        color="#fff3e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.001}
      />
      {/* Fill light — cool from left */}
      <directionalLight position={[-8, 5, 2]} intensity={1.8} color="#c8d8f0" />
      {/* Rim light — behind, slightly above */}
      <directionalLight position={[0, 6, -10]} intensity={1.4} color="#e8f4ff" />
      {/* Under bounce */}
      <pointLight position={[0, -2, 4]} intensity={15} color="#fffbe8" distance={10} />
      {/* Scene fill */}
      <pointLight position={[-4, 4, -6]} intensity={12} color="#aac0e8" distance={18} />

      {/* Main wardrobe */}
      <WardrobeUnit progress={dismantleP} />

      {/* Contact shadow on floor */}
      <ContactShadows
        position={[0, -1.22, 0]}
        opacity={lerp(0.55, 0.15, dismantleP)}
        scale={5}
        blur={2.2}
        far={3}
        resolution={512}
        color="#000000"
      />

      {/* Background furniture for scene depth */}
      <BGFurniture />

      {/* Amber particles on dismantle */}
      <Particles dismantleP={dismantleP} />

      {/* Camera orbit */}
      <CameraRig dismantleP={dismantleP} mouseX={mouseX} mouseY={mouseY} />
    </>
  );
}

/* ─── Public export ─── */
export default function PageBgScene({
  scrollProgress,
  mouseX,
  mouseY,
}: {
  scrollProgress: number;
  mouseX: number;
  mouseY: number;
}) {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  useEffect(() => { setWebglOk(checkWebGL()); }, []);
  if (!webglOk) return null;

  const dismantleP = clamp(scrollProgress / 0.80, 0, 1);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}>
      <Canvas
        camera={{ position: [0, 0.8, 7.5], fov: 48, near: 0.1, far: 160 }}
        style={{ background: "transparent" }}
        shadows
        gl={{ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        dpr={[1, 1.75]}
      >
        <Scene dismantleP={dismantleP} mouseX={mouseX} mouseY={mouseY} />
      </Canvas>
    </div>
  );
}
