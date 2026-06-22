import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: In-Situ / Operando. A small structure is watched live as it transforms
 * — atoms morph between two configurations (a reaction / phase change) inside a
 * recording ring whose time-arc fills while a REC dot blinks. Verb: capture the
 * pathway, not just the quenched end state.
 */

const PINK = "#fda4af";
const HOT = "#ffe4ea";

const PERIOD = 5;
const REC_R = 1.05;
const ARC_SEG = 96;

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

// configuration A: cube corners + centre
const A: THREE.Vector3[] = (() => {
  const s = 0.42;
  const pts = [new THREE.Vector3(0, 0, 0)];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push(new THREE.Vector3(sx * s, sy * s, sz * s));
  return pts;
})();

// configuration B: the same atoms twisted + expanded (a transformed phase)
const B: THREE.Vector3[] = (() => {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0.9, 0.2));
  return A.map((p, i) => {
    const v = p.clone().applyQuaternion(q).multiplyScalar(1.3);
    if (i === 0) v.set(0, 0, 0);
    return v;
  });
})();

const BONDS: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let i = 0; i < A.length; i++)
    for (let j = i + 1; j < A.length; j++) if (A[i].distanceTo(A[j]) < 0.86) out.push([i, j]);
  return out;
})();

function Operando({ billboard }: { billboard: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const inst = useRef<THREE.InstancedMesh>(null);
  const bondGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BONDS.length * 2 * 3), 3));
    return g;
  }, []);
  const arcGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array((ARC_SEG + 1) * 3);
    for (let i = 0; i <= ARC_SEG; i++) {
      const a = -Math.PI / 2 + (i / ARC_SEG) * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * REC_R;
      arr[i * 3 + 1] = Math.sin(a) * REC_R;
      arr[i * 3 + 2] = 0;
    }
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  const ringGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * REC_R, Math.sin(a) * REC_R, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cur = useMemo(() => A.map((p) => p.clone()), []);
  const recRef = useRef<THREE.Mesh>(null);
  const arcRef = useRef<THREE.Line>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (billboard && group.current) group.current.quaternion.copy(camera.quaternion);

    // morph between the two phases (triangle wave), with a slow tumble
    const p = (t / PERIOD) % 1;
    const m = smooth(p < 0.5 ? p / 0.5 : 1 - (p - 0.5) / 0.5);
    for (let i = 0; i < A.length; i++) cur[i].lerpVectors(A[i], B[i], m);

    const mesh = inst.current;
    if (mesh) {
      for (let i = 0; i < cur.length; i++) {
        dummy.position.copy(cur[i]);
        dummy.scale.setScalar(i === 0 ? 0.11 : 0.085);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    const bpos = bondGeo.attributes.position.array as Float32Array;
    for (let k = 0; k < BONDS.length; k++) {
      const [i, j] = BONDS[k];
      bpos[k * 6] = cur[i].x; bpos[k * 6 + 1] = cur[i].y; bpos[k * 6 + 2] = cur[i].z;
      bpos[k * 6 + 3] = cur[j].x; bpos[k * 6 + 4] = cur[j].y; bpos[k * 6 + 5] = cur[j].z;
    }
    bondGeo.attributes.position.needsUpdate = true;

    // recording time-arc fills over the cycle
    const count = Math.max(2, Math.floor(p * ARC_SEG) + 1);
    arcGeo.setDrawRange(0, count);

    // blinking REC dot
    if (recRef.current) {
      (recRef.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(t * 5) > 0 ? 1 : 0.12;
    }
  });

  return (
    <group ref={group}>
      {/* recording ring + filling time-arc */}
      <line geometry={ringGeo}>
        <lineBasicMaterial color={PINK} transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
      </line>
      <line ref={arcRef} geometry={arcGeo}>
        <lineBasicMaterial color={HOT} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
      </line>
      {/* REC dot */}
      <mesh ref={recRef} position={[REC_R * 0.72, REC_R * 0.72, 0]}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshBasicMaterial color={"#ff4d6d"} toneMapped={false} transparent />
      </mesh>

      {/* transforming structure */}
      <lineSegments geometry={bondGeo}>
        <lineBasicMaterial color={PINK} transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <instancedMesh ref={inst} args={[undefined, undefined, A.length]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color={HOT} emissive={PINK} emissiveIntensity={0.8} roughness={0.3} metalness={0.3} />
      </instancedMesh>
    </group>
  );
}

/** Content only (no lights/camera), for embedding as a node in the shared map. */
export function InsituMapScene() {
  return <Operando billboard />;
}

export default function InsituAsset() {
  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0, 4.6], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 5]} intensity={0.7} />
        <pointLight position={[-3, -2, 2]} intensity={0.4} color={0xfda4af} />
        <Operando billboard={false} />
        <OrbitControls enablePan={false} enableZoom minDistance={2.5} maxDistance={11} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 text-sm text-slate-300">
          In-Situ / Operando — watch the structure transform live
        </div>
      </div>
    </>
  );
}
