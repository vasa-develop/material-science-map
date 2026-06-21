import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: DFT electron-density orbital — vibrant, icon-like, additive point cloud.
 * Verb: spin + breathe.
 */

const LOBES: Record<string, THREE.Vector3[]> = {
  p: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)],
  d: [
    new THREE.Vector3(1, 1, 0).normalize(),
    new THREE.Vector3(-1, 1, 0).normalize(),
    new THREE.Vector3(1, -1, 0).normalize(),
    new THREE.Vector3(-1, -1, 0).normalize(),
  ],
  flower: (() => {
    const v: THREE.Vector3[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      v.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    }
    v.push(new THREE.Vector3(0, 1, 0));
    v.push(new THREE.Vector3(0, -1, 0));
    return v;
  })(),
};

type Stop = [number, [number, number, number]];
const PALETTES: Record<string, Stop[]> = {
  spectrum: [
    [0.0, [1.0, 0.13, 0.1]],
    [0.18, [1.0, 0.55, 0.0]],
    [0.36, [1.0, 0.9, 0.15]],
    [0.54, [0.3, 0.85, 0.3]],
    [0.72, [0.1, 0.75, 0.95]],
    [0.88, [0.2, 0.35, 1.0]],
    [1.0, [0.45, 0.1, 0.7]],
  ],
  plasma: [
    [0.0, [1.0, 0.23, 0.19]],
    [0.25, [1.0, 0.54, 0.0]],
    [0.5, [1.0, 0.18, 0.58]],
    [0.75, [0.49, 0.23, 0.93]],
    [1.0, [0.18, 0.42, 1.0]],
  ],
  viridis: [
    [0.0, [0.99, 0.91, 0.14]],
    [0.33, [0.13, 0.8, 0.55]],
    [0.66, [0.2, 0.49, 0.72]],
    [1.0, [0.27, 0.0, 0.33]],
  ],
  ember: [
    [0.0, [1.0, 0.95, 0.6]],
    [0.4, [1.0, 0.5, 0.1]],
    [0.7, [0.85, 0.12, 0.25]],
    [1.0, [0.3, 0.05, 0.2]],
  ],
};

function sampleColor(t: number, stops: Stop[]): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    if (x >= p0 && x <= p1) {
      const f = (x - p0) / (p1 - p0 || 1);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return stops[stops.length - 1][1];
}

function gauss(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function buildOrbital(preset: string, palette: string, count: number) {
  const lobes = LOBES[preset] ?? LOBES.flower;
  const stops = PALETTES[palette] ?? PALETTES.plasma;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const lobeLen = 2.0;
  const lobeWid = 0.5;
  const maxR = lobeLen * 1.12;

  const tmp = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const altUp = new THREE.Vector3(1, 0, 0);

  for (let i = 0; i < count; i++) {
    const axis = lobes[(Math.random() * lobes.length) | 0];
    e1.copy(Math.abs(axis.y) > 0.9 ? altUp : up).cross(axis).normalize();
    e2.copy(axis).cross(e1).normalize();

    const tt = Math.random();
    const along = (0.22 + tt * 0.9) * lobeLen;
    const taper = lobeWid * (1 - tt * 0.65);
    const g1 = gauss() * taper;
    const g2 = gauss() * taper;

    tmp.copy(axis).multiplyScalar(along).addScaledVector(e1, g1).addScaledVector(e2, g2);
    positions[i * 3] = tmp.x;
    positions[i * 3 + 1] = tmp.y;
    positions[i * 3 + 2] = tmp.z;

    const r = tmp.length();
    const c = sampleColor(r / maxR, stops);
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  return { positions, colors };
}

function DensityCloud({
  preset,
  palette,
  spin,
  pointSize,
}: {
  preset: string;
  palette: string;
  spin: boolean;
  pointSize: number;
}) {
  const group = useRef<THREE.Group>(null);
  const { positions, colors } = useMemo(() => buildOrbital(preset, palette, 14000), [preset, palette]);
  const nucleus = useMemo(() => {
    const n = 120;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = gauss() * 0.07;
      a[i * 3 + 1] = gauss() * 0.07;
      a[i * 3 + 2] = gauss() * 0.07;
    }
    return a;
  }, []);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    if (spin) group.current.rotation.y = t * 0.25;
    group.current.rotation.x = Math.sin(t * 0.3) * 0.15;
    const s = 1 + Math.sin(t * 1.1) * 0.04;
    group.current.scale.setScalar(s);
  });

  return (
    <group ref={group}>
      <points key={`${preset}-${palette}`}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          size={pointSize}
          sizeAttenuation
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nucleus, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={0xffffff}
          size={0.12}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/** Lights + content only, for embedding as a node in the shared-canvas map. */
export function DensityMapScene() {
  return <DensityCloud preset="flower" palette="spectrum" spin pointSize={0.02} />;
}

export default function DensityAsset() {
  const [preset, setPreset] = useState("flower");
  const [palette, setPalette] = useState("spectrum");
  const [spin, setSpin] = useState(true);
  const [pointSize, setPointSize] = useState(0.04);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0, 6], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <DensityCloud preset={preset} palette={palette} spin={spin} pointSize={pointSize} />
        <OrbitControls enablePan={false} enableZoom minDistance={3} maxDistance={12} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">DFT — predict properties without making it</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-14 text-xs text-slate-400">orbital</span>
              {["p", "d", "flower"].map((p) => (
                <button key={p} className={btn(preset === p)} onClick={() => setPreset(p)}>
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 text-xs text-slate-400">palette</span>
              {Object.keys(PALETTES).map((p) => (
                <button key={p} className={btn(palette === p)} onClick={() => setPalette(p)}>
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 text-xs text-slate-400">size</span>
              <input
                type="range"
                min={0.015}
                max={0.11}
                step={0.005}
                value={pointSize}
                onChange={(e) => setPointSize(parseFloat(e.target.value))}
                className="w-32 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{pointSize.toFixed(3)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 text-xs text-slate-400">spin</span>
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
