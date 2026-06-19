import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: MD lattice where each atom is a fuzzy electron-cloud point sphere
 * (dense core + soft falloff), instead of a solid sphere. Atoms thermally
 * jitter; coloring is either per-species or phase-driven (blue→green→red).
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
const PER_ATOM = 260; // points per electron cloud
const RADIUS = 0.2; // bounded cloud radius (lattice spacing ~0.77)
const CORE = 0.55; // <1 packs points toward center (bright core); 1/3 = uniform ball

function MdOrbitalAtoms({
  temp,
  spin,
  pointSize,
  brightness,
  coloring,
}: {
  temp: number;
  spin: boolean;
  pointSize: number;
  brightness: number;
  coloring: "species" | "phase";
}) {
  const group = useRef<THREE.Group>(null);
  const posAttr = useRef<THREE.BufferAttribute>(null);
  const colAttr = useRef<THREE.BufferAttribute>(null);
  const mat = useRef<THREE.PointsMaterial>(null);

  const { bases, phases, freqs, species, offsets, positions, colors, count, total } = useMemo(() => {
    const sp = L / (GRID - 1);
    const count = GRID * GRID * GRID;
    const total = count * PER_ATOM;
    const bases: THREE.Vector3[] = [];
    const phases: THREE.Vector3[] = [];
    const freqs: THREE.Vector3[] = [];
    const species: number[] = [];
    const offsets = new Float32Array(total * 3);
    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
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
          // spherically-symmetric cloud: uniform direction + bounded radius
          for (let k = 0; k < PER_ATOM; k++) {
            const idx = (a * PER_ATOM + k) * 3;
            const u = Math.random() * 2 - 1;
            const phi = Math.random() * Math.PI * 2;
            const s = Math.sqrt(1 - u * u);
            const r = RADIUS * Math.pow(Math.random(), CORE);
            offsets[idx] = r * s * Math.cos(phi);
            offsets[idx + 1] = r * s * Math.sin(phi);
            offsets[idx + 2] = r * u;
          }
          a++;
        }
    return { bases, phases, freqs, species, offsets, positions, colors, count, total };
  }, []);

  // (re)assign per-point colors when coloring mode or temperature changes
  useLayoutEffect(() => {
    const c = new THREE.Color();
    for (let a = 0; a < count; a++) {
      if (coloring === "species") c.set(SPECIES[species[a]]);
      else {
        const p = tempColor(temp);
        c.setRGB(p[0], p[1], p[2]);
      }
      for (let k = 0; k < PER_ATOM; k++) {
        const idx = (a * PER_ATOM + k) * 3;
        colors[idx] = c.r;
        colors[idx + 1] = c.g;
        colors[idx + 2] = c.b;
      }
    }
    if (colAttr.current) colAttr.current.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coloring, temp, count]);

  useFrame((state) => {
    if (!posAttr.current) return;
    const t = state.clock.elapsedTime;
    const amp = 0.04 + temp * 0.55;
    for (let a = 0; a < count; a++) {
      const b = bases[a];
      const ph = phases[a];
      const f = freqs[a];
      const cx = b.x + Math.sin(t * f.x + ph.x) * amp;
      const cy = b.y + Math.sin(t * f.y + ph.y) * amp;
      const cz = b.z + Math.sin(t * f.z + ph.z) * amp;
      const o = a * PER_ATOM;
      for (let k = 0; k < PER_ATOM; k++) {
        const idx = (o + k) * 3;
        positions[idx] = cx + offsets[idx];
        positions[idx + 1] = cy + offsets[idx + 1];
        positions[idx + 2] = cz + offsets[idx + 2];
      }
    }
    posAttr.current.needsUpdate = true;
    if (mat.current) mat.current.opacity = brightness;
    if (group.current && spin) group.current.rotation.y = t * 0.15;
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute ref={posAttr} attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute ref={colAttr} attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={mat}
          vertexColors
          size={pointSize}
          sizeAttenuation
          transparent
          opacity={brightness}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(2.75, 2.75, 2.75)]} />
        <lineBasicMaterial color={0x33405c} transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}

export default function MdOrbitalAsset() {
  const [temp, setTemp] = useState(0.18);
  const [spin, setSpin] = useState(true);
  const [pointSize, setPointSize] = useState(0.05);
  const [brightness, setBrightness] = useState(0.7);
  const [coloring, setColoring] = useState<"species" | "phase">("species");

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0, 6.5], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <MdOrbitalAtoms
          temp={temp}
          spin={spin}
          pointSize={pointSize}
          brightness={brightness}
          coloring={coloring}
        />
        <OrbitControls enablePan={false} enableZoom minDistance={3.5} maxDistance={14} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">MD lattice — fuzzy electron-cloud atoms</div>
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
                min={0.02}
                max={0.12}
                step={0.005}
                value={pointSize}
                onChange={(e) => setPointSize(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{pointSize.toFixed(3)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-400">brightness</span>
              <input
                type="range"
                min={0.2}
                max={1}
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
