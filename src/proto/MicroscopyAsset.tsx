import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Microscopy. An electron beam rasters across a sample and resolves its
 * atomic lattice — atoms snap into focus (bright, crisp) behind the scan line
 * while staying blurred ahead of it; a vacancy and a bright dopant sit in the
 * grid. Framed by a magnification reticle. Verb: see morphology and defects
 * down to the atom.
 */

const ROSE = "#fb7185";
const HOT = "#ffe4ea";

const G = 9;
const N = G * G;
const SPACING = 0.26;
const HALF = ((G - 1) * SPACING) / 2;
const ATOM_R = 0.072;

const VACANCY = 4 * G + 5; // a missing atom
const DOPANT = 3 * G + 2; // a bright foreign atom

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

function Lattice({ billboard }: { billboard: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const inst = useRef<THREE.InstancedMesh>(null);
  const scanRef = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const baseRose = useMemo(() => new THREE.Color(ROSE), []);
  const hot = useMemo(() => new THREE.Color(HOT), []);

  const atoms = useMemo(() => {
    const arr: { x: number; y: number; jx: number; jy: number }[] = [];
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        arr.push({
          x: gx * SPACING - HALF,
          y: gy * SPACING - HALF,
          jx: (Math.random() - 0.5) * 0.012,
          jy: (Math.random() - 0.5) * 0.012,
        });
      }
    }
    return arr;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (billboard && group.current) group.current.quaternion.copy(camera.quaternion);

    const mesh = inst.current;
    if (!mesh) return;

    // raster scan sweeps downward, looping
    const p = (t * 0.22) % 1;
    const scanY = HALF + 0.15 - p * (2 * HALF + 0.3);
    if (scanRef.current) {
      scanRef.current.position.y = scanY;
      (scanRef.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.2 * Math.sin(t * 10);
    }

    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      if (i === VACANCY) {
        dummy.position.set(a.x, a.y, 0);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, col.setRGB(0, 0, 0));
        continue;
      }
      // revealed once the scan beam has passed (atom sits above the beam)
      const rev = smooth((a.y - scanY + 0.25) / 0.25); // 0 ahead of beam, 1 behind
      const focus = 0.4 + 0.6 * rev; // blurred(small/dim) -> crisp(full/bright)
      const beam = Math.exp(-((a.y - scanY) * (a.y - scanY)) / 0.004); // flash at the beam

      if (i === DOPANT) col.copy(hot);
      else col.copy(baseRose);
      col.multiplyScalar(0.35 + 0.55 * focus + 0.5 * beam);

      const sc = ATOM_R * (0.55 + 0.45 * focus + 0.3 * beam);
      dummy.position.set(a.x + a.jx, a.y + a.jy, beam * 0.05);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  // magnification reticle: four corner brackets + a scale bar
  const reticle = useMemo(() => {
    const R = HALF + 0.18;
    const L = 0.18;
    const seg: number[] = [];
    const corners = [
      [-R, R, 1, -1],
      [R, R, -1, -1],
      [-R, -R, 1, 1],
      [R, -R, -1, 1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      seg.push(cx, cy, 0, cx + sx * L, cy, 0);
      seg.push(cx, cy, 0, cx, cy + sy * L, 0);
    }
    // scale bar bottom-left
    seg.push(-R + 0.05, -R - 0.12, 0, -R + 0.05 + 0.4, -R - 0.12, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seg), 3));
    return g;
  }, []);

  return (
    <group ref={group}>
      <lineSegments geometry={reticle}>
        <lineBasicMaterial color={ROSE} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      <instancedMesh ref={inst} args={[undefined, undefined, N]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* scan beam line */}
      <mesh ref={scanRef}>
        <boxGeometry args={[HALF * 2 + 0.3, 0.02, 0.01]} />
        <meshBasicMaterial color={HOT} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Content only (no lights/camera), for embedding as a node in the shared map. */
export function MicroscopyMapScene() {
  return <Lattice billboard />;
}

export default function MicroscopyAsset() {
  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0, 4.4], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.6} />
        <Lattice billboard={false} />
        <OrbitControls enablePan={false} enableZoom minDistance={2.5} maxDistance={11} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 text-sm text-slate-300">
          Microscopy — resolve the lattice atom by atom
        </div>
      </div>
    </>
  );
}
