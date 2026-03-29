import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";

function checkWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const ctx =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!ctx;
  } catch {
    return false;
  }
}

function WardrobeModel({ scrollY, mouseX, mouseY }: { scrollY: number; mouseX: number; mouseY: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const idleRotY = useRef(Math.PI / 5);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    idleRotY.current += 0.004;
    const scrollRot = scrollY * 0.0012;
    const targetY = idleRotY.current + scrollRot;
    const targetX = mouseY * 0.18 + Math.sin(t * 0.3) * 0.04;
    const targetZ = mouseX * -0.1;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetY, 0.04);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetX, 0.06);
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetZ, 0.06);
    groupRef.current.position.y = Math.sin(t * 0.6) * 0.07 - scrollY * 0.0003;
    groupRef.current.position.x = Math.cos(t * 0.4) * 0.02;
  });

  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.25, metalness: 0.12 }), []);
  const door = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1e1e1e", roughness: 0.18, metalness: 0.2 }), []);
  const chrome = useMemo(() => new THREE.MeshStandardMaterial({ color: "#b0b0b0", roughness: 0.04, metalness: 0.97 }), []);
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.5, metalness: 0.05 }), []);
  const shelf = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.35, metalness: 0.08 }), []);

  return (
    <group ref={groupRef}>
      <mesh material={dark} castShadow receiveShadow>
        <boxGeometry args={[1.2, 2.3, 0.52]} />
      </mesh>
      <mesh position={[-0.305, 0, 0.29]} material={door} castShadow>
        <boxGeometry args={[0.575, 2.12, 0.045]} />
      </mesh>
      <mesh position={[0.305, 0, 0.29]} material={door} castShadow>
        <boxGeometry args={[0.575, 2.12, 0.045]} />
      </mesh>
      <mesh position={[0, 0, 0.315]} material={edge}>
        <boxGeometry args={[0.018, 2.12, 0.01]} />
      </mesh>
      <mesh position={[-0.07, 0, 0.34]} material={chrome} castShadow>
        <boxGeometry args={[0.038, 0.28, 0.038]} />
      </mesh>
      <mesh position={[-0.07, 0.15, 0.34]} material={chrome}>
        <boxGeometry args={[0.05, 0.042, 0.042]} />
      </mesh>
      <mesh position={[-0.07, -0.15, 0.34]} material={chrome}>
        <boxGeometry args={[0.05, 0.042, 0.042]} />
      </mesh>
      <mesh position={[0.07, 0, 0.34]} material={chrome} castShadow>
        <boxGeometry args={[0.038, 0.28, 0.038]} />
      </mesh>
      <mesh position={[0.07, 0.15, 0.34]} material={chrome}>
        <boxGeometry args={[0.05, 0.042, 0.042]} />
      </mesh>
      <mesh position={[0.07, -0.15, 0.34]} material={chrome}>
        <boxGeometry args={[0.05, 0.042, 0.042]} />
      </mesh>
      <mesh position={[0, 1.2, 0]} material={edge} castShadow>
        <boxGeometry args={[1.3, 0.1, 0.56]} />
      </mesh>
      <mesh position={[0, 1.28, 0.02]} material={dark}>
        <boxGeometry args={[1.26, 0.06, 0.52]} />
      </mesh>
      <mesh position={[0, -1.22, 0]} material={edge} castShadow>
        <boxGeometry args={[1.24, 0.1, 0.54]} />
      </mesh>
      <mesh position={[0, 0.3, 0.01]} material={shelf}>
        <boxGeometry args={[1.14, 0.018, 0.44]} />
      </mesh>
      <mesh position={[0, -0.4, 0.01]} material={shelf}>
        <boxGeometry args={[1.14, 0.018, 0.44]} />
      </mesh>
      <mesh position={[0.614, 0, 0]} material={edge}>
        <boxGeometry args={[0.012, 2.3, 0.52]} />
      </mesh>
      <mesh position={[-0.614, 0, 0]} material={edge}>
        <boxGeometry args={[0.012, 2.3, 0.52]} />
      </mesh>
    </group>
  );
}

function FloatingParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 60;
  const positions = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 14,
      y: (Math.random() - 0.5) * 10,
      z: (Math.random() - 0.5) * 6 - 2,
      speed: 0.2 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2,
      size: 0.01 + Math.random() * 0.03,
    }));
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    positions.forEach((p, i) => {
      dummy.position.set(
        p.x + Math.sin(t * p.speed * 0.5 + p.offset) * 0.3,
        p.y + Math.sin(t * p.speed + p.offset) * 0.4,
        p.z
      );
      dummy.scale.setScalar(p.size * (0.8 + Math.sin(t * p.speed + p.offset) * 0.2));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
    </instancedMesh>
  );
}

function StaticFallback({ height }: { height: number }) {
  return (
    <div
      style={{ width: "100%", height }}
      className="flex flex-col items-center justify-center gap-8"
      data-testid="3d-static-fallback"
    >
      <div className="flex flex-col items-center gap-2 opacity-15">
        <div className="flex gap-1 items-end">
          <div className="w-3 bg-white/40 rounded-sm" style={{ height: 24 }} />
          <div className="w-16 bg-white/50 rounded-sm" style={{ height: 80 }} />
          <div className="w-3 bg-white/40 rounded-sm" style={{ height: 24 }} />
        </div>
        <div className="w-16 h-0.5 bg-white/20" />
        <div className="flex gap-2">
          <div className="w-6 h-1 bg-white/20 rounded-full" />
          <div className="w-4 h-1 bg-white/15 rounded-full" />
        </div>
      </div>
      <p className="text-[10px] font-semibold text-white/15 tracking-widest uppercase">3D Preview</p>
    </div>
  );
}

interface FurnitureSceneProps {
  scrollY: number;
  mouseX: number;
  mouseY: number;
  height?: number;
}

export default function FurnitureScene({ scrollY, mouseX, mouseY, height = 560 }: FurnitureSceneProps) {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(checkWebGL());
  }, []);

  if (webglOk === null) {
    return <div style={{ width: "100%", height }} />;
  }

  if (!webglOk) {
    return <StaticFallback height={height} />;
  }

  return (
    <div style={{ width: "100%", height }} className="relative">
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 42 }}
        style={{ background: "transparent" }}
        shadows
        gl={{ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false }}
      >
        <ambientLight intensity={0.7} color="#ffffff" />
        <directionalLight position={[4, 6, 4]} intensity={2.5} color="#ffffff" castShadow />
        <directionalLight position={[-3, 2, -2]} intensity={0.6} color="#8888ff" />
        <pointLight position={[0, 0, 4]} intensity={25} color="#ffffff" distance={10} />
        <pointLight position={[-4, 3, 2]} intensity={8} color="#ffffff" distance={12} />
        <pointLight position={[3, -2, 3]} intensity={5} color="#ccddff" distance={8} />
        <FloatingParticles />
        <WardrobeModel scrollY={scrollY} mouseX={mouseX} mouseY={mouseY} />
      </Canvas>
    </div>
  );
}
