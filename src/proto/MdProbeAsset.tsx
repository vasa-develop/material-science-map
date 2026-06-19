import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: MD lattice where each atom is a glowing probe (bright core + additive
 * halo) — the same look as the MLIP energy-landscape probes. Atoms thermally
 * jitter; coloring is per-species or phase-driven (blue→green→red).
 */

const SPECIES = [0xff4d4d, 0x4d9bff, 0x4dff88, 0xffd24d];

type Stop = [number, [number, number, number]];
const PHASE_STOPS: Stop[] = [
  [0.0, [0.23, 0.51, 0.96]],
  [0.355, [0.13, 0.77, 0.37]],
  [0.75, [0.94, 0.27, 0.27]],
  [1.0, [0.94, 0.27, 0.27]],
];
function tempColor(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 0; i < PHASE_STOPS.length - 1; i++) {
    const [p0, c0] = PHASE_STOPS[i];
    const [p1, c1] = PHASE_STOPS[i + 1];
    if (x >= p0 && x <= p1) {
      const f = (x - p0) / (p1 - p0 || 1);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return PHASE_STOPS[PHASE_STOPS.length - 1][1];
}

const GRID = 4;
const L = 2.3;

function whiteColorAttr(g: THREE.BufferGeometry) {
  const n = g.attributes.position.count;
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return g;
}

function MdProbeAtoms({
  temp,
  spin,
  size,
  brightness,
  coloring,
}: {
  temp: number;
  spin: boolean;
  size: number;
  brightness: number;
  coloring: "species" | "phase";
}) {
  const group = useRef<THREE.Group>(null);
  const meshCore = useRef<THREE.InstancedMesh>(null);
  const meshHalo = useRef<THREE.InstancedMesh>(null);

  const { bases, phases, freqs, species, count } = useMemo(() => {
    const sp = L / (GRID - 1);
    const count = GRID * GRID * GRID;
    const bases: THREE.Vector3[] = [];
    const phases: THREE.Vector3[] = [];
    const freqs: THREE.Vector3[] = [];
    const species: number[] = [];
    let a = 0;
    for (let x = 0; x < GRID; x++)
      for (let y = 0; y < GRID; y++)
        for (let z = 0; z < GRID; z++) {
          bases.push(new THREE.Vector3(x * sp - L / 2, y * sp - L / 2, z * sp - L / 2));
          phases.push(new THREE.Vector3(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28));
          freqs.push(
            new THREE.Vector3(0.7 + Math.random() * 0.8, 0.7 + Math.random() * 0.8, 0.7 + Math.random() * 0.8)
          );
          species.push(a % SPECIES.length);
          a++;
        }
    return { bases, phases, freqs, species, count };
  }, []);

  const coreGeo = useMemo(() => whiteColorAttr(new THREE.SphereGeometry(0.1, 16, 16)), []);
  const haloGeo = useMemo(() => whiteColorAttr(new THREE.SphereGeometry(0.26, 16, 16)), []);
  const matCore = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true }), []);
  const matHalo = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const phaseCol = useMemo(() => new THREE.Color(), []);

  // species colors set once (phase mode overrides per-frame)
  useLayoutEffect(() => {
    if (coloring !== "species") return;
    const c = new THREE.Color();
    for (const m of [meshCore.current, meshHalo.current]) {
      if (!m) continue;
      for (let i = 0; i < count; i++) {
        c.set(SPECIES[species[i]]);
        m.setColorAt(i, c);
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coloring, count]);

  useFrame((state) => {
    if (!meshCore.current || !meshHalo.current) return;
    const t = state.clock.elapsedTime;
    const amp = 0.04 + temp * 0.55;
    for (let i = 0; i < count; i++) {
      const b = bases[i];
      const ph = phases[i];
      const f = freqs[i];
      dummy.position.set(
        b.x + Math.sin(t * f.x + ph.x) * amp,
        b.y + Math.sin(t * f.y + ph.y) * amp,
        b.z + Math.sin(t * f.z + ph.z) * amp
      );
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      meshCore.current.setMatrixAt(i, dummy.matrix);
      meshHalo.current.setMatrixAt(i, dummy.matrix);
    }
    meshCore.current.instanceMatrix.needsUpdate = true;
    meshHalo.current.instanceMatrix.needsUpdate = true;

    if (coloring === "phase") {
      const c = tempColor(temp);
      phaseCol.setRGB(c[0], c[1], c[2]);
      for (let i = 0; i < count; i++) {
        meshCore.current.setColorAt(i, phaseCol);
        meshHalo.current.setColorAt(i, phaseCol);
      }
      if (meshCore.current.instanceColor) meshCore.current.instanceColor.needsUpdate = true;
      if (meshHalo.current.instanceColor) meshHalo.current.instanceColor.needsUpdate = true;
    }

    matHalo.opacity = brightness;
    if (group.current && spin) group.current.rotation.y = t * 0.15;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={meshCore} args={[coreGeo, matCore, count]} />
      <instancedMesh ref={meshHalo} args={[haloGeo, matHalo, count]} />
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(2.75, 2.75, 2.75)]} />
        <lineBasicMaterial color={0x33405c} transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}

export default function MdProbeAsset() {
  const [temp, setTemp] = useState(0.18);
  const [spin, setSpin] = useState(true);
  const [size, setSize] = useState(1);
  const [brightness, setBrightness] = useState(0.45);
  const [coloring, setColoring] = useState<"species" | "phase">("species");

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0, 6.5], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <MdProbeAtoms temp={temp} spin={spin} size={size} brightness={brightness} coloring={coloring} />
        <OrbitControls enablePan={false} enableZoom minDistance={3.5} maxDistance={14} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">MD lattice — glowing probe atoms</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-400">temperature</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={temp}
                onChange={(e) => setTemp(parseFloat(e.target.value))}
                className="w-36 accent-orange-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{temp.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-400">size</span>
              <input
                type="range"
                min={0.5}
                max={1.8}
                step={0.05}
                value={size}
                onChange={(e) => setSize(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{size.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-400">glow</span>
              <input
                type="range"
                min={0}
                max={0.9}
                step={0.05}
                value={brightness}
                onChange={(e) => setBrightness(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{brightness.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-400">color</span>
              <button className={btn(coloring === "species")} onClick={() => setColoring("species")}>
                species
              </button>
              <button className={btn(coloring === "phase")} onClick={() => setColoring("phase")}>
                phase
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-400">spin</span>
              <button className={btn(spin)} onClick={() => setSpin((s) => !s)}>
                {spin ? "on" : "off"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
