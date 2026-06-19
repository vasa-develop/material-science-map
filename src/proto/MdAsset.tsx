import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Molecular Dynamics — soft, hazy, multi-colored atoms thermally jittering in a cell.
 * Verb: thermal jitter (amplitude = temperature). Paired with a live 2D phase diagram.
 */

const SPECIES = [0xff4d4d, 0x4d9bff, 0x4dff88, 0xffd24d];

// phase colormap — used only to tint the phase-diagram state point
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

const css = (c: [number, number, number]) =>
  `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;

function MdAtoms({
  temp,
  spin,
  size,
  brightness,
  mode,
}: {
  temp: number;
  spin: boolean;
  size: number;
  brightness: number;
  mode: "species" | "phase";
}) {
  const meshStd = useRef<THREE.InstancedMesh>(null);
  const meshGlow = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);

  const { bases, phases, freqs, colors, count } = useMemo(() => {
    const grid = 4;
    const L = 2.3;
    const sp = L / (grid - 1);
    const count = grid * grid * grid;
    const bases: THREE.Vector3[] = [];
    const phases: THREE.Vector3[] = [];
    const freqs: THREE.Vector3[] = [];
    const colors: THREE.Color[] = [];
    let i = 0;
    for (let x = 0; x < grid; x++)
      for (let y = 0; y < grid; y++)
        for (let z = 0; z < grid; z++) {
          bases.push(new THREE.Vector3(x * sp - L / 2, y * sp - L / 2, z * sp - L / 2));
          phases.push(new THREE.Vector3(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28));
          freqs.push(
            new THREE.Vector3(0.7 + Math.random() * 0.8, 0.7 + Math.random() * 0.8, 0.7 + Math.random() * 0.8)
          );
          colors.push(new THREE.Color(SPECIES[i % SPECIES.length]));
          i++;
        }
    return { bases, phases, freqs, colors, count };
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.17, 24, 24);
    // vertexColors needs a per-vertex `color` attribute; seed it white so the
    // per-instance color (setColorAt) shows through instead of multiplying by 0.
    const n = g.attributes.position.count;
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    return g;
  }, []);
  const matStd = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.1 }),
    []
  );
  const matGlow = useMemo(
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

  // Initialize per-instance colors before first paint so the shader compiles
  // with the instance-color attribute (avoids atoms rendering as flat black).
  useLayoutEffect(() => {
    const tmp = new THREE.Color();
    const p = tempColor(temp);
    for (const m of [meshStd.current, meshGlow.current]) {
      if (!m) continue;
      for (let i = 0; i < count; i++) {
        if (mode === "phase") {
          tmp.setRGB(p[0], p[1], p[2]);
          m.setColorAt(i, tmp);
        } else {
          m.setColorAt(i, colors[i]);
        }
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    matStd.needsUpdate = true;
    matGlow.needsUpdate = true;
    // temp intentionally omitted: phase recolor is handled per-frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, mode, count]);

  useFrame((state) => {
    if (!meshStd.current || !meshGlow.current) return;
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
      meshStd.current.setMatrixAt(i, dummy.matrix);
      meshGlow.current.setMatrixAt(i, dummy.matrix);
    }
    meshStd.current.instanceMatrix.needsUpdate = true;
    meshGlow.current.instanceMatrix.needsUpdate = true;

    if (mode === "phase") {
      const c = tempColor(temp);
      phaseCol.setRGB(c[0], c[1], c[2]);
      for (let i = 0; i < count; i++) {
        meshStd.current.setColorAt(i, phaseCol);
        meshGlow.current.setColorAt(i, phaseCol);
      }
      if (meshStd.current.instanceColor) meshStd.current.instanceColor.needsUpdate = true;
      if (meshGlow.current.instanceColor) meshGlow.current.instanceColor.needsUpdate = true;
    }

    matGlow.opacity = brightness;
    if (group.current && spin) group.current.rotation.y = t * 0.15;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={meshStd} args={[geo, matStd, count]} />
      <instancedMesh ref={meshGlow} args={[geo, matGlow, count]} />
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(2.75, 2.75, 2.75)]} />
        <lineBasicMaterial color={0x33405c} transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}

function PhaseDiagram({ temp }: { temp: number }) {
  // viewBox 240x170; plot area x:30..220, y:20..140
  const dotX = 35 + temp * 180;
  const phase = dotX < 74 ? "solid" : dotX < 124 ? "liquid" : "gas";
  const dotCss = css(tempColor(temp));
  return (
    <svg width={240} height={170} className="block">
      <polygon points="30,20 85,20 70,110 30,140" fill="#3b82f6" opacity={0.55} />
      <polygon points="85,20 220,20 190,55 70,110" fill="#22c55e" opacity={0.5} />
      <polygon points="30,140 70,110 190,55 220,140" fill="#ef4444" opacity={0.5} />
      <polyline points="85,20 70,110 190,55" fill="none" stroke="#cbd5e1" strokeWidth={1.2} opacity={0.7} />
      <polyline points="30,140 70,110" fill="none" stroke="#cbd5e1" strokeWidth={1.2} opacity={0.7} />
      <line x1={30} y1={20} x2={30} y2={140} stroke="#64748b" strokeWidth={1} />
      <line x1={30} y1={140} x2={220} y2={140} stroke="#64748b" strokeWidth={1} />
      <text x={26} y={16} fill="#94a3b8" fontSize={9} textAnchor="end">
        P
      </text>
      <text x={224} y={150} fill="#94a3b8" fontSize={9}>
        T
      </text>
      <text x={45} y={80} fill="#dbeafe" fontSize={9}>
        solid
      </text>
      <text x={120} y={40} fill="#dcfce7" fontSize={9}>
        liquid
      </text>
      <text x={150} y={120} fill="#fee2e2" fontSize={9}>
        gas
      </text>
      <line x1={30} y1={85} x2={220} y2={85} stroke="#475569" strokeWidth={0.75} strokeDasharray="3 3" />
      <circle cx={dotX} cy={85} r={9} fill={dotCss} opacity={0.3} />
      <circle cx={dotX} cy={85} r={5} fill={dotCss} />
      <text x={dotX} y={104} fill="#fff" fontSize={9} textAnchor="middle">
        {phase}
      </text>
    </svg>
  );
}

export default function MdAsset({ mode = "species" }: { mode?: "species" | "phase" }) {
  const [temp, setTemp] = useState(0.18);
  const [spin, setSpin] = useState(true);
  const [showPhase, setShowPhase] = useState(true);
  const [size, setSize] = useState(1.25);
  const [brightness, setBrightness] = useState(0.45);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0, 6.5], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 3]} intensity={1.4} />
        <pointLight position={[-4, -2, -3]} intensity={0.5} color={0x88aaff} />
        <MdAtoms temp={temp} spin={spin} size={size} brightness={brightness} mode={mode} />
        <OrbitControls enablePan={false} enableZoom minDistance={3.5} maxDistance={14} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">
            Molecular Dynamics — {mode === "phase" ? "phase-colored atoms" : "atoms in motion"}, phases
          </div>
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
                min={0.6}
                max={2.2}
                step={0.05}
                value={size}
                onChange={(e) => setSize(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{size.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-400">brightness</span>
              <input
                type="range"
                min={0}
                max={0.85}
                step={0.05}
                value={brightness}
                onChange={(e) => setBrightness(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{brightness.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-400">spin</span>
              <button className={btn(spin)} onClick={() => setSpin((s) => !s)}>
                {spin ? "on" : "off"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-400">phase diagram</span>
              <button className={btn(showPhase)} onClick={() => setShowPhase((s) => !s)}>
                {showPhase ? "deep-dive" : "main-page"}
              </button>
            </div>
          </div>
        </div>

        {showPhase && (
          <div className="absolute bottom-5 right-5 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-3 backdrop-blur-md">
            <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">phase diagram</div>
            <PhaseDiagram temp={temp} />
          </div>
        )}
      </div>
    </>
  );
}
