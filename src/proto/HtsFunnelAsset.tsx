import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: HTS (funnel variant). Compound-formula names pour into a glowing
 * funnel that pulses as it ingests them; the few that pass are spat out of
 * the spout below, the rest dissolve inside. Verb: filter many names -> few.
 */

const COUNT = 60;
const PASS_RATE = 0.3;

const Y_SPAWN = 3.9;
const NECK_Y = -0.8;
const NECK_SCALE = 0.42;
const EXIT_Y = -3.4;
const R_TOP = 1.5;
const R_NECK = 0.22;

const NEUTRAL: [number, number, number] = [0.72, 0.8, 0.94];
const PASS: [number, number, number] = [0.45, 1.0, 0.7];

const FORMULAS = [
  "NaCl", "Fe2O3", "LiCoO2", "TiO2", "GaN", "BaTiO3", "MgO", "ZnO", "SiC", "Al2O3",
  "LiFePO4", "CsPbI3", "KNbO3", "SrTiO3", "ZrO2", "WO3", "MoS2", "WSe2", "Bi2Te3",
  "PbTe", "CdTe", "GaAs", "InP", "Cu2O", "NiO", "MnO2", "V2O5", "Y2O3", "CaTiO3",
  "LaMnO3", "YBa2Cu3O7", "CaCO3", "KCl", "CsCl", "FeS2", "Na2CO3",
];

const smoother = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * c * (c * (c * 6 - 15) + 10);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const lerp3 = (
  a: [number, number, number],
  b: [number, number, number],
  f: number
): [number, number, number] => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

const GLYPH_W = 256;
const GLYPH_H = 96;
const GLYPH_ASPECT = GLYPH_W / GLYPH_H;

function glyphTexture(text: string): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = GLYPH_W;
  cv.height = GLYPH_H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 12;
  let fs = 58;
  ctx.font = `bold ${fs}px ui-sans-serif, system-ui, sans-serif`;
  while (ctx.measureText(text).width > GLYPH_W - 24 && fs > 16) {
    fs -= 2;
    ctx.font = `bold ${fs}px ui-sans-serif, system-ui, sans-serif`;
  }
  ctx.fillText(text, GLYPH_W / 2, GLYPH_H / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

function FunnelBody({ spin, pulseRef }: { spin: boolean; pulseRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);

  const TOP_GEO_Y = 1.4;
  const BOT_GEO_Y = -1.35;
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = [
      new THREE.Vector2(R_TOP, TOP_GEO_Y),
      new THREE.Vector2(1.28, 1.05),
      new THREE.Vector2(1.0, 0.65),
      new THREE.Vector2(0.72, 0.18),
      new THREE.Vector2(0.46, -0.32),
      new THREE.Vector2(0.3, -0.66),
      new THREE.Vector2(R_NECK, NECK_Y),
      new THREE.Vector2(R_NECK, BOT_GEO_Y),
    ];
    const g = new THREE.LatheGeometry(pts, 64);
    // vertical light-blue -> violet gradient baked into vertex colors
    const violet = new THREE.Color(0x9a6bff);
    const lightBlue = new THREE.Color(0x7fd6ff);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const f = clamp01((pos.getY(i) - BOT_GEO_Y) / (TOP_GEO_Y - BOT_GEO_Y));
      c.copy(lightBlue).lerp(violet, f);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        emissive: 0x3a55c8,
        emissiveIntensity: 0.4,
        roughness: 0.32,
        metalness: 0.45,
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  // rim rings at top mouth and neck to read as a built object
  const topRing = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * R_TOP, 1.4, Math.sin(a) * R_TOP));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  const neckRing = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * R_NECK, NECK_Y, Math.sin(a) * R_NECK));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = pulseRef.current;
    mat.emissiveIntensity = 0.32 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.6)) + pulse * 1.4;
    mat.opacity = 0.58 + 0.18 * pulse;
    if (group.current && spin) group.current.rotation.y = t * 0.4;
    if (group.current && !spin) group.current.rotation.y = 0;
  });

  return (
    <group ref={group}>
      <mesh geometry={geo} material={mat} />
      <lineLoop geometry={topRing}>
        <lineBasicMaterial color={0x9af4ff} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineLoop>
      <lineLoop geometry={neckRing}>
        <lineBasicMaterial color={0x6cf0ff} transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineLoop>
    </group>
  );
}

function FormulaStream({
  speed,
  size,
  pulseRef,
}: {
  speed: number;
  size: number;
  pulseRef: React.MutableRefObject<number>;
}) {
  const sharedTex = useMemo(() => FORMULAS.map((f) => glyphTexture(f)), []);
  const cand = useMemo(() => {
    const arr: { theta: number; offset: number; pass: boolean; fi: number; wob: number; wph: number }[] = [];
    for (let i = 0; i < COUNT; i++) {
      arr.push({
        theta: Math.random() * Math.PI * 2,
        offset: Math.random(),
        pass: Math.random() < PASS_RATE,
        fi: (Math.random() * FORMULAS.length) | 0,
        wob: 2 + Math.random() * 3,
        wph: Math.random() * 6.28,
      });
    }
    return arr;
  }, []);

  const sprites = useMemo(
    () =>
      cand.map((c) => {
        const m = new THREE.SpriteMaterial({ map: sharedTex[c.fi], transparent: true, depthWrite: false });
        return new THREE.Sprite(m);
      }),
    [cand, sharedTex]
  );

  const tintCol = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    let pulse = 0;
    for (let i = 0; i < COUNT; i++) {
      const c = cand[i];
      let u = (t * speed + c.offset) % 1;
      if (u < 0) u += 1;
      const passed = c.pass;
      const sp = sprites[i];

      // pulse the funnel as items cross the neck (u ~ 0.5)
      const d = u - 0.5;
      pulse += Math.exp(-(d * d) / 0.0009) * (passed ? 1 : 0.7);

      let x: number, y: number, z: number;
      let alpha = 1;
      let szf = 1;
      let col = NEUTRAL;
      let visible = true;

      if (u <= 0.5) {
        // descend into the funnel mouth, swirling toward the neck (shrinking)
        const f = u / 0.5;
        const R = lerp(R_TOP * 0.78, R_NECK, smoother(f));
        const th = c.theta + t * 0.7 + f * 4.5;
        const wob = Math.sin(t * c.wob + c.wph) * 0.04 * (1 - f);
        x = Math.cos(th) * (R + wob);
        z = Math.sin(th) * (R + wob);
        y = lerp(Y_SPAWN, NECK_Y, f);
        alpha = u < 0.05 ? u / 0.05 : 1;
        szf = lerp(1, NECK_SCALE, smoother(f));
      } else if (passed) {
        // spat out of the spout, drifting down and apart (growing back)
        const f = (u - 0.5) / 0.5;
        const R = R_NECK + f * 0.7;
        const th = c.theta + t * 0.5 + 4.5;
        x = Math.cos(th) * R;
        z = Math.sin(th) * R;
        y = lerp(NECK_Y - 0.55, EXIT_Y, f);
        col = lerp3(NEUTRAL, PASS, clamp01(f * 2.5));
        alpha = f > 0.8 ? 1 - (f - 0.8) / 0.2 : 1;
        szf = lerp(NECK_SCALE, 1, smoother(clamp01(f * 1.4)));
      } else {
        // dissolves inside the neck
        const f = clamp01((u - 0.5) / 0.16);
        const R = R_NECK * (1 - f);
        const th = c.theta + t * 0.9;
        x = Math.cos(th) * R;
        z = Math.sin(th) * R;
        y = NECK_Y - f * 0.15;
        alpha = 1 - f;
        szf = NECK_SCALE * (1 - f);
        if (u > 0.66) visible = false;
      }

      sp.visible = visible && alpha > 0.01;
      if (sp.visible) {
        const fs = size * 0.5 * szf;
        sp.position.set(x, y, z);
        sp.scale.set(fs * GLYPH_ASPECT, fs, 1);
        tintCol.setRGB(col[0], col[1], col[2]);
        sp.material.color.copy(tintCol);
        sp.material.opacity = clamp01(alpha);
      }
    }
    pulseRef.current = Math.min(1, pulse);
  });

  return (
    <group>
      {sprites.map((sp, i) => (
        <primitive key={i} object={sp} />
      ))}
    </group>
  );
}

export default function HtsFunnelAsset() {
  const [speed, setSpeed] = useState(0.16);
  const [size, setSize] = useState(1);
  const [spin, setSpin] = useState(true);
  const pulseRef = useRef(0);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0.2, 7], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 3]} intensity={0.85} />
        <pointLight position={[-4, -2, -3]} intensity={0.4} color={0x88aaff} />
        <FunnelBody spin={spin} pulseRef={pulseRef} />
        <FormulaStream speed={speed} size={size} pulseRef={pulseRef} />
        <OrbitControls enablePan={false} enableZoom minDistance={3.5} maxDistance={16} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">HTS — funnel filters formulas</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-400">flow</span>
              <input
                type="range"
                min={0.05}
                max={0.45}
                step={0.01}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{speed.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-400">size</span>
              <input
                type="range"
                min={0.6}
                max={1.8}
                step={0.05}
                value={size}
                onChange={(e) => setSize(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{size.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-400">spin</span>
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
