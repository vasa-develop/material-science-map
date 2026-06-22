import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Structure Solution. The inverse problem — a spread-out diffraction
 * spot pattern collapses inward and assembles into a solved real-space atomic
 * lattice (bonds knitting together as atoms converge), then disperses back to
 * the pattern. Verb: reconstruct the atomic arrangement from the data.
 */

const MAGENTA = "#e879f9";
const HOT = "#fce7ff";

const G = 5;
const N = G * G;
const SPOT_SP = 0.66; // reciprocal-space spot spacing (spread out)
const LAT_SP = 0.27; // real-space lattice spacing (tight)
const PERIOD = 6;

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

function Reconstruction({ billboard }: { billboard: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const inst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const magenta = useMemo(() => new THREE.Color(MAGENTA), []);
  const hot = useMemo(() => new THREE.Color(HOT), []);

  const nodes = useMemo(() => {
    const half = ((G - 1) / 2) * SPOT_SP;
    const lhalf = ((G - 1) / 2) * LAT_SP;
    const arr: { spot: THREE.Vector3; lat: THREE.Vector3; intensity: number }[] = [];
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const spot = new THREE.Vector3(gx * SPOT_SP - half, gy * SPOT_SP - half, 0);
        const lat = new THREE.Vector3(gx * LAT_SP - lhalf, gy * LAT_SP - lhalf, 0);
        const r2 = spot.x * spot.x + spot.y * spot.y;
        arr.push({ spot, lat, intensity: Math.exp(-r2 / 1.1) });
      }
    }
    return arr;
  }, []);

  const bonds = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++)
        if (nodes[i].lat.distanceTo(nodes[j].lat) < LAT_SP * 1.1) out.push([i, j]);
    return out;
  }, [nodes]);

  const bondGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bonds.length * 2 * 3), 3));
    return g;
  }, [bonds]);
  const bondMat = useRef<THREE.LineBasicMaterial>(null);
  const cur = useMemo(() => nodes.map(() => new THREE.Vector3()), [nodes]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (billboard && group.current) group.current.quaternion.copy(camera.quaternion);

    // assemble (spots -> lattice), hold, then disperse
    const p = (t / PERIOD) % 1;
    let m: number;
    if (p < 0.4) m = smooth(p / 0.4);
    else if (p < 0.7) m = 1;
    else m = 1 - smooth((p - 0.7) / 0.3);

    const mesh = inst.current;
    if (mesh) {
      for (let i = 0; i < nodes.length; i++) {
        cur[i].lerpVectors(nodes[i].spot, nodes[i].lat, m);
        dummy.position.copy(cur[i]);
        // dispersed: small intensity-graded spots; solved: uniform bright atoms
        const spotScale = 0.022 + 0.06 * nodes[i].intensity;
        const sc = spotScale + (0.078 - spotScale) * m;
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        // spots tinted by intensity; solved atoms brighten toward white
        col.copy(magenta).multiplyScalar(0.3 + 0.7 * nodes[i].intensity);
        col.lerp(hot, m * 0.7);
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    const bpos = bondGeo.attributes.position.array as Float32Array;
    for (let k = 0; k < bonds.length; k++) {
      const [i, j] = bonds[k];
      bpos[k * 6] = cur[i].x; bpos[k * 6 + 1] = cur[i].y; bpos[k * 6 + 2] = cur[i].z;
      bpos[k * 6 + 3] = cur[j].x; bpos[k * 6 + 4] = cur[j].y; bpos[k * 6 + 5] = cur[j].z;
    }
    bondGeo.attributes.position.needsUpdate = true;
    if (bondMat.current) bondMat.current.opacity = 0.7 * smooth((m - 0.45) / 0.55);
  });

  return (
    <group ref={group}>
      {/* bonds of the solved structure (fade in as it assembles) */}
      <lineSegments geometry={bondGeo}>
        <lineBasicMaterial ref={bondMat} color={MAGENTA} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      <instancedMesh ref={inst} args={[undefined, undefined, N]}>
        <sphereGeometry args={[1, 14, 14]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Content only (no lights/camera), for embedding as a node in the shared map. */
export function StructureSolutionMapScene() {
  return <Reconstruction billboard />;
}

export default function StructureSolutionAsset() {
  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0, 4.2], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.6} />
        <Reconstruction billboard={false} />
        <OrbitControls enablePan={false} enableZoom minDistance={2.5} maxDistance={11} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 text-sm text-slate-300">
          Structure Solution — from pattern to atoms
        </div>
      </div>
    </>
  );
}
