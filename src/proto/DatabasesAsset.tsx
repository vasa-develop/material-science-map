import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Materials databases — a structured catalog you query and retrieve
 * from. A glowing grid of entries (a "data crystal"); a query scan-wave sweeps
 * through, and matching entries light up and pop out (retrieved), then settle.
 * Verb: scan / query / retrieve.
 */

const GRID = 6;
const SP = 0.44;
const SLATE: [number, number, number] = [0.3, 0.36, 0.52];
const CYAN: [number, number, number] = [0.3, 0.85, 1.0];
const GOLD: [number, number, number] = [1.0, 0.78, 0.25];

const fract = (x: number) => x - Math.floor(x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp3 = (
  a: [number, number, number],
  b: [number, number, number],
  f: number
): [number, number, number] => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

function DataCrystal({
  scan,
  activity,
  glow,
  spin,
}: {
  scan: number;
  activity: number;
  glow: number;
  spin: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const meshStd = useRef<THREE.InstancedMesh>(null);
  const meshGlow = useRef<THREE.InstancedMesh>(null);

  const { bases, dirs, offs, count, extent } = useMemo(() => {
    const count = GRID * GRID * GRID;
    const off = (GRID - 1) / 2;
    const bases: THREE.Vector3[] = [];
    const dirs: THREE.Vector3[] = [];
    const offs: number[] = [];
    for (let x = 0; x < GRID; x++)
      for (let y = 0; y < GRID; y++)
        for (let z = 0; z < GRID; z++) {
          const p = new THREE.Vector3((x - off) * SP, (y - off) * SP, (z - off) * SP);
          bases.push(p);
          dirs.push(p.clone().normalize());
          offs.push(Math.random());
        }
    return { bases, dirs, offs, count, extent: off * SP };
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const n = g.attributes.position.count;
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    return g;
  }, []);
  const matStd = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.15 }),
    []
  );
  const matGlow = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cStd = useMemo(() => new THREE.Color(), []);
  const cGlow = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!meshStd.current || !meshGlow.current) return;
    const t = state.clock.elapsedTime;
    const band = SP * 0.85;
    const scanPos = (extent + band) * Math.sin(t * scan * 0.8); // sweep along y

    for (let i = 0; i < count; i++) {
      const b = bases[i];

      // query scan highlight (entries near the sweeping plane)
      const hs = Math.max(0, 1 - Math.abs(b.y - scanPos) / band);

      // retrieval: each entry occasionally pops out on its own staggered cycle
      const r = fract(t * activity * 0.12 + offs[i]);
      const win = 0.16;
      const rp = r < win ? r / win : 0;
      const pop = Math.sin(rp * Math.PI); // 0..1..0

      const d = dirs[i];
      const lift = pop * 0.55;
      dummy.position.set(b.x + d.x * lift, b.y + d.y * lift, b.z + d.z * lift);
      dummy.rotation.set(t * 0.2 + i, t * 0.15 + i, 0);
      dummy.scale.setScalar(1 + 0.35 * hs + 0.8 * pop);
      dummy.updateMatrix();
      meshStd.current.setMatrixAt(i, dummy.matrix);
      meshGlow.current.setMatrixAt(i, dummy.matrix);

      let col = SLATE;
      col = lerp3(col, CYAN, hs * 0.9);
      if (pop > 0) col = lerp3(col, GOLD, pop);
      cStd.setRGB(col[0], col[1], col[2]);
      meshStd.current.setColorAt(i, cStd);

      const g = clamp01(hs * 0.6 + pop) * glow;
      cGlow.setRGB(col[0] * g, col[1] * g, col[2] * g);
      meshGlow.current.setColorAt(i, cGlow);
    }
    meshStd.current.instanceMatrix.needsUpdate = true;
    meshGlow.current.instanceMatrix.needsUpdate = true;
    if (meshStd.current.instanceColor) meshStd.current.instanceColor.needsUpdate = true;
    if (meshGlow.current.instanceColor) meshGlow.current.instanceColor.needsUpdate = true;
    if (group.current && spin) group.current.rotation.y = t * 0.16;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={meshStd} args={[geo, matStd, count]} />
      <instancedMesh ref={meshGlow} args={[geo, matGlow, count]} />
    </group>
  );
}

export default function DatabasesAsset() {
  const [scan, setScan] = useState(1);
  const [activity, setActivity] = useState(1);
  const [glow, setGlow] = useState(0.8);
  const [spin, setSpin] = useState(true);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0, 6], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 3]} intensity={0.8} />
        <pointLight position={[-4, -2, -3]} intensity={0.4} color={0x88aaff} />
        <DataCrystal scan={scan} activity={activity} glow={glow} spin={spin} />
        <OrbitControls enablePan={false} enableZoom minDistance={3.5} maxDistance={14} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Materials databases — query the catalog, retrieve entries</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">scan</span>
              <input
                type="range"
                min={0.2}
                max={2.5}
                step={0.05}
                value={scan}
                onChange={(e) => setScan(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{scan.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">retrieval</span>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.05}
                value={activity}
                onChange={(e) => setActivity(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{activity.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">glow</span>
              <input
                type="range"
                min={0}
                max={1.2}
                step={0.05}
                value={glow}
                onChange={(e) => setGlow(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{glow.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">spin</span>
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
