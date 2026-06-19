import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Predictive Synthesis (the bridge). Tuning the synthesis conditions
 * reshapes the reaction energy landscape — as temperature ramps, the barrier
 * (the "pass") lowers and the product well deepens — and a bright bead then
 * finds the route over the pass into the target phase. All text lives in a
 * crisp 2D overlay (conditions + live reaction profile) so the 3D surface and
 * the moving particle stay readable. Verb: tune conditions, open the route.
 */

const PRE_X = -1.3;
const PROD_X = 1.3;
const DOM = 2.3;
const YS = 0.7; // energy -> height

// reaction surface; k in [0,1] = how far the conditions have been tuned.
// higher k -> lower barrier ridge + deeper product well (route opens up).
function energy(x: number, z: number, k: number) {
  const prodA = 1.3 + 0.9 * k;
  const barr = 0.95 * (1 - 0.62 * k);
  return (
    0.1 * (x * x + 0.6 * z * z) -
    1.1 * Math.exp(-(((x - PRE_X) ** 2) + z * z) / 0.5) -
    prodA * Math.exp(-(((x - PROD_X) ** 2) + z * z) / 0.6) +
    barr * Math.exp(-(x * x) / 0.28)
  );
}

const smoother = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * c * (c * (c * 6 - 15) + 10);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const STOPS = [0x2b3aff, 0x18c0e0, 0x37e06a, 0xffe14a, 0xff5a5a].map((c) => new THREE.Color(c));
const ramp = (t: number, out: THREE.Color) => {
  const u = clamp01(t) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(u));
  return out.copy(STOPS[i]).lerp(STOPS[i + 1], u - i);
};

interface Sync {
  phase: number;
  k: number;
  px: number;
}

function Landscape({ speed, sync }: { speed: number; sync: React.MutableRefObject<Sync> }) {
  const group = useRef<THREE.Group>(null);
  const surf = useRef<THREE.Mesh>(null);
  const bead = useRef<THREE.Group>(null);
  const preOrb = useRef<THREE.Mesh>(null);
  const prodOrb = useRef<THREE.Mesh>(null);
  const pathRef = useRef<THREE.Line>(null);

  const N = 60;
  const { geo, baseXZ, ybounds } = useMemo(() => {
    const positions = new Float32Array(N * N * 3);
    const colors = new Float32Array(N * N * 3);
    const baseXZ: { x: number; z: number }[] = [];
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const x = -DOM + (2 * DOM * i) / (N - 1);
        const z = -DOM + (2 * DOM * j) / (N - 1);
        baseXZ.push({ x, z });
        const k = (i * N + j) * 3;
        positions[k] = x;
        positions[k + 2] = z;
      }
    const indices: number[] = [];
    for (let i = 0; i < N - 1; i++)
      for (let j = 0; j < N - 1; j++) {
        const a = i * N + j;
        const b = i * N + j + 1;
        const c = (i + 1) * N + j;
        const d = (i + 1) * N + j + 1;
        indices.push(a, c, b, b, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setIndex(indices);
    return { geo: g, baseXZ, ybounds: { min: -2.1, max: 0.9 } };
  }, []);

  const pathGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(61 * 3), 3));
    return g;
  }, []);

  const lastK = useRef(-1);
  const col = useMemo(() => new THREE.Color(), []);

  const rebuild = (k: number) => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colAttr = geo.attributes.color as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const carr = colAttr.array as Float32Array;
    for (let n = 0; n < N * N; n++) {
      const { x, z } = baseXZ[n];
      const y = energy(x, z, k) * YS;
      arr[n * 3 + 1] = y;
      ramp((y / YS - ybounds.min) / (ybounds.max - ybounds.min), col);
      carr[n * 3] = col.r;
      carr[n * 3 + 1] = col.g;
      carr[n * 3 + 2] = col.b;
    }
    pos.needsUpdate = true;
    colAttr.needsUpdate = true;
    geo.computeVertexNormals();

    // minimum-energy path along z=0
    const parr = pathGeo.attributes.position.array as Float32Array;
    for (let i = 0; i <= 60; i++) {
      const x = THREE.MathUtils.lerp(-1.7, 1.7, i / 60);
      parr[i * 3] = x;
      parr[i * 3 + 1] = energy(x, 0, k) * YS + 0.05;
      parr[i * 3 + 2] = 0;
    }
    pathGeo.attributes.position.needsUpdate = true;
  };

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const phase = (t * speed * 0.08) % 1;

    let k: number;
    let px: number;
    if (phase < 0.28) {
      k = smoother(phase / 0.28);
      px = PRE_X;
    } else if (phase < 0.9) {
      k = 1;
      const tr = smoother((phase - 0.28) / 0.62);
      const q = 2 * tr - 1;
      px = PROD_X * Math.sign(q) * Math.pow(Math.abs(q), 1.7);
    } else {
      k = 1;
      px = PROD_X;
    }

    sync.current.phase = phase;
    sync.current.k = k;
    sync.current.px = px;

    if (Math.abs(k - lastK.current) > 0.002) {
      rebuild(k);
      lastK.current = k;
    }

    if (bead.current) bead.current.position.set(px, energy(px, 0, k) * YS + 0.12, 0);
    if (preOrb.current) preOrb.current.position.y = energy(PRE_X, 0, k) * YS + 0.04;
    if (prodOrb.current) prodOrb.current.position.y = energy(PROD_X, 0, k) * YS + 0.05;
  });

  return (
    <group ref={group}>
      <mesh ref={surf} geometry={geo}>
        <meshStandardMaterial vertexColors roughness={0.55} metalness={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo}>
        <meshBasicMaterial color={0x9fd6ff} wireframe transparent opacity={0.05} depthWrite={false} />
      </mesh>

      {/* @ts-expect-error -- line primitive with geometry */}
      <line ref={pathRef} geometry={pathGeo}>
        <lineBasicMaterial color={0xffe07a} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>

      <group ref={bead}>
        <mesh>
          <sphereGeometry args={[0.1, 18, 18]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshBasicMaterial color={0xffe07a} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      <mesh ref={preOrb} position={[PRE_X, 0, 0]}>
        <sphereGeometry args={[0.08, 14, 14]} />
        <meshBasicMaterial color={0x9ad0ff} />
      </mesh>
      <mesh ref={prodOrb} position={[PROD_X, 0, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={0x9affc8} />
      </mesh>
    </group>
  );
}

const RECIPE_STEPS = [
  { t: 0.02, label: "Na\u2082CO\u2083 + TiO\u2082  (precursors)" },
  { t: 0.12, label: "grind & mix" },
  { t: 0.2, label: "heat \u2192 900 \u00b0C" },
  { t: 0.45, label: "hold in air \u00b7 12 h" },
  { t: 0.88, label: "\u2192 target phase" },
];

function Overlay({ sync }: { sync: React.MutableRefObject<Sync> }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const tempRef = useRef<HTMLSpanElement>(null);
  const atmosRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const W = 280;
    const H = 150;
    const EMIN = -2.2;
    const EMAX = 1.0;
    const mx = 14;
    const top = 12;
    const bot = 24;
    const sx = (x: number) => mx + ((x + 1.7) / 3.4) * (W - 2 * mx);
    const sy = (e: number) => top + ((EMAX - e) / (EMAX - EMIN)) * (H - top - bot);

    const draw = () => {
      const cv = cvRef.current;
      const { k, px } = sync.current;
      if (cv) {
        const ctx = cv.getContext("2d")!;
        ctx.clearRect(0, 0, W, H);
        // baseline grid
        ctx.strokeStyle = "rgba(148,163,184,0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx, H - bot);
        ctx.lineTo(W - mx, H - bot);
        ctx.stroke();

        // energy curve
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
          const x = -1.7 + (3.4 * i) / 80;
          const e = energy(x, 0, k);
          const X = sx(x);
          const Y = sy(e);
          if (i === 0) ctx.moveTo(X, Y);
          else ctx.lineTo(X, Y);
        }
        const grad = ctx.createLinearGradient(0, top, 0, H - bot);
        grad.addColorStop(0, "#ff6a7a");
        grad.addColorStop(0.5, "#37e06a");
        grad.addColorStop(1, "#2b6bff");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.4;
        ctx.stroke();

        // particle on the curve
        const PX = sx(px);
        const PY = sy(energy(px, 0, k));
        ctx.shadowColor = "#ffe07a";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#fff7d6";
        ctx.beginPath();
        ctx.arc(PX, PY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // endpoint labels
        ctx.fillStyle = "rgba(159,208,255,0.9)";
        ctx.font = "9px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.fillText("precursors", sx(PRE_X), sy(energy(PRE_X, 0, k)) + 14);
        ctx.fillStyle = "rgba(154,255,200,0.95)";
        ctx.fillText("target", sx(PROD_X), sy(energy(PROD_X, 0, k)) + 14);
      }

      const phase = sync.current.phase;
      const k2 = sync.current.k;
      if (tempRef.current) tempRef.current.textContent = `${Math.round(25 + 875 * k2)} °C`;
      if (atmosRef.current) atmosRef.current.textContent = k2 > 0.18 ? "air" : "—";
      if (barRef.current) barRef.current.style.width = `${Math.round(clamp01(phase / 0.9) * 100)}%`;
      RECIPE_STEPS.forEach((s, i) => {
        const el = stepRefs.current[i];
        if (el) {
          const on = phase >= s.t;
          el.style.opacity = on ? "1" : "0.32";
          el.style.color = on ? (i === RECIPE_STEPS.length - 1 ? "#a6ffcf" : "#e8f1ff") : "#64748b";
        }
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sync]);

  return (
    <>
      {/* conditions + reaction profile */}
      <div className="pointer-events-none absolute right-5 top-5 w-[300px] rounded-xl border border-white/10 bg-[rgba(8,10,18,0.74)] p-4 backdrop-blur-md">
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-sky-300/80">conditions</div>
        <div className="mb-1 flex justify-between text-xs text-slate-300">
          <span>temperature</span>
          <span ref={tempRef} className="tabular-nums text-amber-300">25 °C</span>
        </div>
        <div className="mb-3 flex justify-between text-xs text-slate-300">
          <span>atmosphere</span>
          <span ref={atmosRef} className="text-sky-200">—</span>
        </div>
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] text-sky-300/80">reaction profile</div>
        <canvas ref={cvRef} width={280} height={150} className="block w-full" />
        <div className="mt-1 text-[10px] text-slate-500">barrier lowers as conditions are tuned → route opens</div>
      </div>

      {/* recipe */}
      <div className="pointer-events-none absolute bottom-5 right-5 w-[260px] rounded-xl border border-white/10 bg-[rgba(8,10,18,0.74)] p-4 backdrop-blur-md">
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-amber-300/80">recipe</div>
        <ol className="space-y-1 text-xs">
          {RECIPE_STEPS.map((s, i) => (
            <li
              key={i}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              style={{ opacity: 0.32, color: "#64748b" }}
              className="transition-colors"
            >
              {s.label}
            </li>
          ))}
        </ol>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div ref={barRef} className="h-full rounded-full bg-sky-400" style={{ width: "0%" }} />
        </div>
      </div>
    </>
  );
}

export default function PredictiveAsset() {
  const [speed, setSpeed] = useState(1);
  const [orbit, setOrbit] = useState(false);
  const sync = useRef<Sync>({ phase: 0, k: 0, px: PRE_X });

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 2.9, 4.9], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 6, 3]} intensity={0.7} />
        <pointLight position={[-3, 3, -2]} intensity={0.4} color={0x88aaff} />
        <Landscape speed={speed} sync={sync} />
        <OrbitControls enablePan={false} enableZoom autoRotate={orbit} autoRotateSpeed={0.6} minDistance={3} maxDistance={14} target={[0, -0.3, 0]} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Predictive synthesis — tune conditions, open the route</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-400">rate</span>
              <input type="range" min={0.2} max={3} step={0.05} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-36 accent-sky-400" />
              <span className="text-[11px] tabular-nums text-slate-500">{speed.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-400">orbit</span>
              <button className={btn(orbit)} onClick={() => setOrbit((s) => !s)}>
                {orbit ? "on" : "off"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Overlay sync={sync} />
    </>
  );
}
