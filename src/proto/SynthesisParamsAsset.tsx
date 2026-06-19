import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Synthesis Parameters. Three floating gauge dials — temperature,
 * pressure, atmosphere — whose needles drift as the knobs of a synthesis run.
 * Tick arcs fill to the current value; live readouts in a 2D overlay. Verb:
 * needles drift.
 */

const N_TICKS = 26;
const START_A = Math.PI * 1.25; // 225°
const END_A = -Math.PI * 0.25; // -45°  (270° clockwise sweep)
const R = 0.64;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function glyph(text: string, px = 30): { tex: THREE.Texture; aspect: number } {
  const cv = document.createElement("canvas");
  const tmp = cv.getContext("2d")!;
  tmp.font = `600 ${px}px ui-sans-serif, system-ui, sans-serif`;
  const w = Math.ceil(tmp.measureText(text).width) + 24;
  const h = px + 16;
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 6;
  ctx.font = `600 ${px}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(text, w / 2, h / 2 + 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return { tex, aspect: w / h };
}

interface GaugeDef {
  label: string;
  color: number;
  sp1: number;
  sp2: number;
  ph: number;
}

function Gauge({
  def,
  idx,
  x,
  values,
}: {
  def: GaugeDef;
  idx: number;
  x: number;
  values: React.MutableRefObject<number[]>;
}) {
  const ticks = useRef<THREE.InstancedMesh>(null);
  const needle = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scratch = useMemo(() => new THREE.Color(), []);
  const colObj = useMemo(() => new THREE.Color(def.color), [def.color]);
  const label = useMemo(() => glyph(def.label, 30), [def.label]);

  useEffect(() => {
    if (!ticks.current) return;
    for (let i = 0; i < N_TICKS; i++) {
      const a = THREE.MathUtils.lerp(START_A, END_A, i / (N_TICKS - 1));
      dummy.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      dummy.rotation.set(0, 0, a - Math.PI / 2);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ticks.current.setMatrixAt(i, dummy.matrix);
    }
    ticks.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const v = clamp01(0.5 + 0.3 * Math.sin(t * def.sp1 + def.ph) + 0.13 * Math.sin(t * def.sp2 + def.ph * 2));
    values.current[idx] = v;

    if (ticks.current) {
      for (let i = 0; i < N_TICKS; i++) {
        const tv = i / (N_TICKS - 1);
        const lit = tv <= v;
        scratch.copy(colObj).multiplyScalar(lit ? 1.0 : 0.13);
        ticks.current.setColorAt(i, scratch);
      }
      if (ticks.current.instanceColor) ticks.current.instanceColor.needsUpdate = true;
    }
    if (needle.current) needle.current.rotation.z = THREE.MathUtils.lerp(START_A, END_A, v);
  });

  return (
    <group position={[x, 0, 0]}>
      {/* dial face */}
      <mesh position={[0, 0, -0.04]}>
        <circleGeometry args={[0.82, 48]} />
        <meshStandardMaterial color={0x0e1320} roughness={0.7} metalness={0.3} />
      </mesh>
      {/* outer ring */}
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[0.82, 0.025, 14, 64]} />
        <meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
      {/* tick arc */}
      <instancedMesh ref={ticks} args={[new THREE.BoxGeometry(0.03, 0.1, 0.02), new THREE.MeshBasicMaterial({ vertexColors: true }), N_TICKS]} />
      {/* needle */}
      <group ref={needle}>
        <mesh position={[R * 0.42, 0, 0.01]}>
          <boxGeometry args={[R * 0.84, 0.035, 0.02]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>
      </group>
      {/* hub */}
      <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.06, 18]} />
        <meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={0.8} roughness={0.3} />
      </mesh>
      {/* label */}
      <sprite position={[0, -1.02, 0]} scale={[label.aspect * 0.26, 0.26, 1]}>
        <spriteMaterial map={label.tex} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

const GAUGES: GaugeDef[] = [
  { label: "TEMPERATURE", color: 0xff8a4a, sp1: 0.5, sp2: 1.3, ph: 0.0 },
  { label: "PRESSURE", color: 0x5fd0ff, sp1: 0.37, sp2: 0.9, ph: 2.1 },
  { label: "ATMOSPHERE", color: 0x5fe089, sp1: 0.28, sp2: 0.7, ph: 4.0 },
];
const ATMOS = ["vacuum", "Ar", "N\u2082", "air", "O\u2082"];

function Rig({ values }: { values: React.MutableRefObject<number[]> }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.18;
  });
  return (
    <group ref={group}>
      {GAUGES.map((g, i) => (
        <Gauge key={g.label} def={g} idx={i} x={(i - 1) * 2.1} values={values} />
      ))}
    </group>
  );
}

function Readout({ values }: { values: React.MutableRefObject<number[]> }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = values.current;
      if (refs.current[0]) refs.current[0].textContent = `${Math.round(200 + v[0] * 1200)} °C`;
      if (refs.current[1]) refs.current[1].textContent = `${(v[1] * 10).toFixed(1)} atm`;
      if (refs.current[2]) refs.current[2].textContent = ATMOS[Math.min(ATMOS.length - 1, Math.floor(v[2] * ATMOS.length))];
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [values]);
  const items = [
    { l: "temperature", c: "#ffb27a" },
    { l: "pressure", c: "#9fe0ff" },
    { l: "atmosphere", c: "#9affb5" },
  ];
  return (
    <div className="pointer-events-none absolute right-5 top-5 flex gap-2">
      {items.map((it, i) => (
        <div key={it.l} className="rounded-xl border border-white/10 bg-[rgba(8,10,18,0.74)] px-4 py-3 backdrop-blur-md">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{it.l}</div>
          <div ref={(el) => { refs.current[i] = el; }} className="text-lg font-semibold tabular-nums" style={{ color: it.c }}>
            —
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SynthesisParamsAsset() {
  const values = useRef<number[]>([0.5, 0.5, 0.5]);

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0.3, 6.2], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={0.7} />
        <pointLight position={[-3, 2, 3]} intensity={0.4} color={0x88aaff} />
        <Rig values={values} />
        <OrbitControls enablePan={false} enableZoom minDistance={4} maxDistance={12} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 text-sm text-slate-300">Synthesis parameters — temperature · pressure · atmosphere</div>
      </div>
      <Readout values={values} />
    </>
  );
}
