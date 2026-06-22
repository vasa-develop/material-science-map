import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Spectroscopy. A probe beam hits a sample and its response is read out
 * as a glowing spectrum — emission peaks rising from a baseline with a readout
 * marker sweeping across them. Verb: probe bonding / oxidation state / local
 * chemistry from how a material absorbs, emits or scatters energy.
 */

const PURPLE = "#c084fc";
const VIOLET = "#a855f7";
const HOT = "#f3e8ff";

const X0 = -1.45;
const X1 = 1.45;
const BASE_Y = -0.55;
const NPTS = 150;

// fixed spectral peaks: [center, baseHeight, width, wobble]
const PEAKS: [number, number, number, number][] = [
  [-1.05, 0.42, 0.010, 0.9],
  [-0.5, 0.85, 0.006, 1.4],
  [0.05, 0.55, 0.012, 0.7],
  [0.62, 1.05, 0.007, 1.1],
  [1.15, 0.5, 0.009, 1.7],
];

function curveValue(x: number, t: number): number {
  let v = 0;
  for (const [c, h, w, wob] of PEAKS) {
    const hh = h * (0.85 + 0.15 * Math.sin(t * wob + c * 3));
    v += hh * Math.exp(-((x - c) * (x - c)) / w);
  }
  return v;
}

function Spectrum({ billboard }: { billboard: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const barsRef = useRef<THREE.LineSegments>(null);
  const markerRef = useRef<THREE.Mesh>(null);
  const sampleMat = useRef<THREE.MeshStandardMaterial>(null);

  const xs = useMemo(() => {
    const a: number[] = [];
    for (let i = 0; i < NPTS; i++) a.push(X0 + (i / (NPTS - 1)) * (X1 - X0));
    return a;
  }, []);

  const curveGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NPTS * 3), 3));
    return g;
  }, []);

  const barsGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PEAKS.length * 2 * 3), 3));
    return g;
  }, []);

  const axisGeo = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(X0 - 0.05, BASE_Y, 0),
      new THREE.Vector3(X1 + 0.05, BASE_Y, 0),
    ]);
  }, []);

  // THREE.Line objects built imperatively — the <line> JSX intrinsic collides with
  // SVG's <line> in the typings, so we render these line-strips via <primitive>.
  const axisLine = useMemo(
    () => new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })),
    [axisGeo],
  );
  const curveLine = useMemo(
    () => new THREE.Line(curveGeo, new THREE.LineBasicMaterial({ color: HOT, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })),
    [curveGeo],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (billboard && group.current) group.current.quaternion.copy(camera.quaternion);

    // spectral curve
    const cpos = curveGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < NPTS; i++) {
      const x = xs[i];
      cpos[i * 3] = x;
      cpos[i * 3 + 1] = BASE_Y + curveValue(x, t);
      cpos[i * 3 + 2] = 0;
    }
    curveGeo.attributes.position.needsUpdate = true;

    // emission bars at peak centers
    const bpos = barsGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < PEAKS.length; i++) {
      const c = PEAKS[i][0];
      const top = BASE_Y + curveValue(c, t);
      bpos[i * 6] = c;
      bpos[i * 6 + 1] = BASE_Y;
      bpos[i * 6 + 2] = 0;
      bpos[i * 6 + 3] = c;
      bpos[i * 6 + 4] = top;
      bpos[i * 6 + 5] = 0;
    }
    barsGeo.attributes.position.needsUpdate = true;

    // readout marker sweeping across the spectrum
    const p = (t * 0.18) % 1;
    const tri = p < 0.5 ? p / 0.5 : 1 - (p - 0.5) / 0.5;
    const mx = X0 + tri * (X1 - X0);
    if (markerRef.current) {
      markerRef.current.position.set(mx, BASE_Y + curveValue(mx, t) + 0.02, 0);
    }
    if (sampleMat.current) sampleMat.current.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 2);
  });

  return (
    <group ref={group}>
      {/* sample emitting the signal */}
      <mesh position={[X0 - 0.45, BASE_Y + 0.25, 0]}>
        <icosahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial ref={sampleMat} color={HOT} emissive={PURPLE} emissiveIntensity={0.8} roughness={0.3} metalness={0.4} flatShading />
      </mesh>

      {/* baseline axis (THREE.Line via primitive — see above) */}
      <primitive object={axisLine} />

      {/* emission bars */}
      <lineSegments ref={barsRef} geometry={barsGeo}>
        <lineBasicMaterial color={PURPLE} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      {/* spectral curve (THREE.Line via primitive — see above) */}
      <primitive object={curveLine} />

      {/* readout marker */}
      <mesh ref={markerRef}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshBasicMaterial color={HOT} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Content only (no lights/camera), for embedding as a node in the shared map. */
export function SpectroscopyMapScene() {
  return <Spectrum billboard />;
}

export default function SpectroscopyAsset() {
  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0.1, 4.6], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={0.6} />
        <Spectrum billboard={false} />
        <OrbitControls enablePan={false} enableZoom minDistance={2.5} maxDistance={11} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 text-sm text-slate-300">
          Spectroscopy — read the spectral fingerprint
        </div>
      </div>
    </>
  );
}
