import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: High-Throughput Experimentation. A combinatorial library plate — a
 * grid of sample wells glowing in a composition gradient (varied warm hues),
 * with a measurement sweep flashing across them so many are made and read in
 * parallel. Verb: synthesize + screen a whole library at once.
 */

const AMBER = "#f59e0b";

const GX = 8;
const GZ = 8;
const N = GX * GZ;
const SPACING = 0.19;
const HALF_X = ((GX - 1) * SPACING) / 2;
const HALF_Z = ((GZ - 1) * SPACING) / 2;
const TILE = 0.12;
const BASE_Y = -0.4;
const SWEEP_PERIOD = 4.5;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function Library() {
  const inst = useRef<THREE.InstancedMesh>(null);
  const scanRef = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);

  // per-cell base hue: a 2-axis composition gradient in the warm band
  const cells = useMemo(() => {
    const arr: { x: number; z: number; base: THREE.Color; phase: number }[] = [];
    for (let gx = 0; gx < GX; gx++) {
      for (let gz = 0; gz < GZ; gz++) {
        const fx = gx / (GX - 1);
        const fz = gz / (GZ - 1);
        const hue = 0.03 + fx * 0.13 + fz * 0.02; // ~red-orange -> yellow
        const sat = 0.82 - fz * 0.15;
        const light = 0.45 + fz * 0.12;
        const base = new THREE.Color().setHSL(hue, sat, light);
        arr.push({ x: gx * SPACING - HALF_X, z: gz * SPACING - HALF_Z, base, phase: Math.random() * 6.28 });
      }
    }
    return arr;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const mesh = inst.current;
    if (!mesh) return;

    // measurement sweep position across x (with a brief dwell at each end)
    const p = (t / SWEEP_PERIOD) % 1;
    const tri = p < 0.5 ? p / 0.5 : 1 - (p - 0.5) / 0.5;
    const sweepX = -HALF_X - 0.1 + tri * (2 * HALF_X + 0.2);
    if (scanRef.current) {
      scanRef.current.position.x = sweepX;
      (scanRef.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.15 * Math.sin(t * 8);
    }

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const d = c.x - sweepX;
      const flash = Math.exp(-(d * d) / 0.012); // bright as the sweep passes
      const idle = 0.5 + 0.5 * Math.sin(t * 1.6 + c.phase);

      col.copy(c.base).multiplyScalar(0.55 + 0.25 * idle);
      col.lerp(new THREE.Color("#fff4e0"), flash * 0.85);

      const lift = flash * 0.07;
      const sc = 1 + flash * 0.25;
      dummy.position.set(c.x, BASE_Y + 0.03 + lift, c.z);
      dummy.scale.set(TILE * sc, 0.05 + flash * 0.05, TILE * sc);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* plate base */}
      <mesh position={[0, BASE_Y - 0.04, 0]}>
        <boxGeometry args={[HALF_X * 2 + 0.34, 0.09, HALF_Z * 2 + 0.34]} />
        <meshStandardMaterial color={"#1c1206"} emissive={AMBER} emissiveIntensity={0.12} roughness={0.6} metalness={0.3} />
      </mesh>
      <lineSegments position={[0, BASE_Y, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(HALF_X * 2 + 0.34, 0.09, HALF_Z * 2 + 0.34)]} />
        <lineBasicMaterial color={AMBER} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      {/* sample wells */}
      <instancedMesh ref={inst} args={[undefined, undefined, N]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* measurement sweep bar */}
      <mesh ref={scanRef} position={[0, BASE_Y + 0.12, 0]}>
        <boxGeometry args={[0.03, 0.22, HALF_Z * 2 + 0.4]} />
        <meshBasicMaterial color={"#fff1cf"} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Content only (no lights/camera), for embedding as a node in the shared map. */
export function HteLibraryMapScene() {
  return <Library />;
}

export default function HteLibraryAsset() {
  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 1.0, 3.4], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 6, 4]} intensity={0.8} />
        <Library />
        <OrbitControls enablePan={false} enableZoom minDistance={2} maxDistance={9} target={[0, -0.2, 0]} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 text-sm text-slate-300">
          High-Throughput Experimentation — a library measured in parallel
        </div>
      </div>
    </>
  );
}
