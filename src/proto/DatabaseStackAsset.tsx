import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Materials database (classic cylinder/stacked-disk icon). Crystals
 * stream in from above and get absorbed into the top; the database pulses and
 * glows brighter each time data lands, the pulse rippling down the stack.
 * Verb: ingest / accumulate data.
 */

const R = 1.0;
const SEG_H = 0.6;
const SEGS = [
  { y: SEG_H, color: 0x5bb8f5 },
  { y: 0, color: 0x4f93e6 },
  { y: -SEG_H, color: 0x3f73d6 },
];
const TOP_Y = SEG_H * 1.5; // top surface of the stack
const TEAL = 0x67e0cf;

const ITEMS = 26;
const ITEM_COLORS = [0x9bf6ff, 0xfff1a8, 0xff9ee0, 0xbafca0];

const FILL_CAP = 4500; // records per visual "fill" cycle

const smoother = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * c * (c * (c * 6 - 15) + 10);
};
const fract = (x: number) => x - Math.floor(x);

const DBS = [
  { name: "Materials Project", color: 0xff5a3c },
  { name: "OQMD", color: 0x3b82f6 },
  { name: "AFLOW", color: 0x22c55e },
];
const LOGOS_PER_BAND = 8;

function logoTexture(name: string, hex: number): THREE.Texture {
  const w = 256;
  const h = 96;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  const col = new THREE.Color(hex);
  const rgb = `rgb(${col.r * 255},${col.g * 255},${col.b * 255})`;
  // rounded badge
  const pad = 8;
  const rr = 18;
  ctx.fillStyle = rgb;
  ctx.beginPath();
  ctx.roundRect(pad, pad, w - 2 * pad, h - 2 * pad, rr);
  ctx.fill();
  // text (auto-fit)
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fs = 44;
  ctx.font = `bold ${fs}px ui-sans-serif, system-ui, sans-serif`;
  while (ctx.measureText(name).width > w - 4 * pad && fs > 14) {
    fs -= 2;
    ctx.font = `bold ${fs}px ui-sans-serif, system-ui, sans-serif`;
  }
  ctx.fillText(name, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

const FORMULAS = [
  "NaCl",
  "Fe2O3",
  "LiCoO2",
  "TiO2",
  "GaN",
  "BaTiO3",
  "MgO",
  "ZnO",
  "SiC",
  "Al2O3",
  "LiFePO4",
  "CsPbI3",
  "KNbO3",
  "SrTiO3",
  "ZrO2",
  "WO3",
  "MoS2",
  "WSe2",
  "Bi2Te3",
  "PbTe",
  "CdTe",
  "GaAs",
  "InP",
  "Si",
  "Cu2O",
  "NiO",
  "MnO2",
  "V2O5",
  "Nb2O5",
  "Ta2O5",
  "Y2O3",
  "CaTiO3",
  "LaMnO3",
  "YBa2Cu3O7",
  "Li7La3Zr2O12",
  "Na2CO3",
  "CaCO3",
  "KCl",
  "CsCl",
  "FeS2",
];
const GLYPH_W = 256;
const GLYPH_H = 96;
const GLYPH_ASPECT = GLYPH_W / GLYPH_H;

function textGlyphTexture(text: string, hex: number): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = GLYPH_W;
  cv.height = GLYPH_H;
  const ctx = cv.getContext("2d")!;
  const col = new THREE.Color(hex);
  ctx.fillStyle = `rgb(${col.r * 255},${col.g * 255},${col.b * 255})`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 14;
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

function digitTexture(d: string, hex: number): THREE.Texture {
  const s = 64;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d")!;
  const col = new THREE.Color(hex);
  ctx.fillStyle = `rgb(${col.r * 255},${col.g * 255},${col.b * 255})`;
  ctx.font = "bold 52px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 12;
  ctx.fillText(d, s / 2, s / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

function DatabaseStack({
  rate,
  glow,
  spin,
  itemType,
  pulseTint,
  showFill,
  showLogos,
  countEl,
}: {
  rate: number;
  glow: number;
  spin: boolean;
  itemType: "crystals" | "atoms" | "bits" | "formulas";
  pulseTint: boolean;
  showFill: boolean;
  showLogos: boolean;
  countEl: React.RefObject<HTMLSpanElement | null>;
}) {
  const group = useRef<THREE.Group>(null);
  const segMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const meshCore = useRef<THREE.InstancedMesh>(null);
  const meshGlow = useRef<THREE.InstancedMesh>(null);
  const fillMesh = useRef<THREE.Mesh>(null);
  const instGeoKey = itemType === "atoms" ? "atoms" : "cryst";

  const items = useMemo(() => {
    const arr: {
      ang: number;
      rs: number;
      ys: number;
      offset: number;
      col: THREE.Color;
      prevU: number;
    }[] = [];
    for (let i = 0; i < ITEMS; i++) {
      arr.push({
        ang: Math.random() * Math.PI * 2,
        rs: 1.5 + Math.random() * 0.9,
        ys: 1.9 + Math.random() * 1.2,
        offset: Math.random(),
        col: new THREE.Color(ITEM_COLORS[i % ITEM_COLORS.length]),
        prevU: 0,
      });
    }
    return arr;
  }, []);

  const itemGeo = useMemo(() => {
    const g =
      itemType === "atoms"
        ? new THREE.SphereGeometry(0.11, 16, 16)
        : new THREE.IcosahedronGeometry(0.1, 0);
    const n = g.attributes.position.count;
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    return g;
  }, [itemType]);

  // bit glyph sprites (used when itemType === "bits")
  const bits = useMemo(() => {
    return items.map((it, i) => {
      const tex = digitTexture(i % 2 === 0 ? "1" : "0", it.col.getHex());
      const m = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      return new THREE.Sprite(m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // compound-formula glyph sprites (used when itemType === "formulas")
  const formulas = useMemo(() => {
    return items.map((it, i) => {
      const tex = textGlyphTexture(FORMULAS[i % FORMULAS.length], it.col.getHex());
      const m = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      return new THREE.Sprite(m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  const matCore = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true }), []);
  const matGlow = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );
  // database name badges wrapped around each band
  const logoMats = useMemo(
    () =>
      SEGS.map((_, k) => {
        const db = DBS[k % DBS.length];
        return new THREE.MeshBasicMaterial({
          map: logoTexture(db.name, db.color),
          transparent: true,
          depthWrite: false,
        });
      }),
    []
  );
  const logoPlacements = useMemo(() => {
    const out: { x: number; y: number; z: number; ry: number; mat: number }[] = [];
    for (let k = 0; k < SEGS.length; k++) {
      for (let j = 0; j < LOGOS_PER_BAND; j++) {
        const a = (j / LOGOS_PER_BAND) * Math.PI * 2;
        out.push({
          x: Math.cos(a) * (R + 0.012),
          y: SEGS[k].y,
          z: Math.sin(a) * (R + 0.012),
          ry: Math.PI / 2 - a,
          mat: k,
        });
      }
    }
    return out;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const segBase = useMemo(() => SEGS.map((s) => new THREE.Color(s.color)), []);
  const emiss = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    for (let i = 0; i < ITEMS; i++) {
      meshCore.current?.setColorAt(i, items[i].col);
      meshGlow.current?.setColorAt(i, items[i].col);
    }
    if (meshCore.current?.instanceColor) meshCore.current.instanceColor.needsUpdate = true;
    if (meshGlow.current?.instanceColor) meshGlow.current.instanceColor.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, instGeoKey]);

  const pulse = useRef([0, 0, 0]);
  const pulseCol = useRef(new THREE.Color(0xffffff));
  const countRef = useRef(0);

  useFrame((state) => {
    if (!meshCore.current || !meshGlow.current) return;
    const t = state.clock.elapsedTime;
    const target = new THREE.Vector3(0, TOP_Y, 0);
    let absorbedThisFrame = 0;

    for (let i = 0; i < ITEMS; i++) {
      const it = items[i];
      const u = fract(t * rate * 0.12 + it.offset);
      // absorption event when crossing the top
      if (it.prevU < 0.96 && u >= 0.96) {
        absorbedThisFrame++;
        countRef.current += Math.round(40 + Math.random() * 120);
        pulseCol.current.copy(it.col);
      }
      it.prevU = u;

      const e = smoother(u);
      const ang = it.ang + u * 2.5; // gentle spiral inward
      const r = it.rs * (1 - e);
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      const y = it.ys + (target.y - it.ys) * e;
      const s = Math.max(0, 1 - 0.85 * e);

      dummy.position.set(x, y, z);
      dummy.rotation.set(t * 0.9 + i, t * 0.7 + i, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshCore.current.setMatrixAt(i, dummy.matrix);
      meshGlow.current.setMatrixAt(i, dummy.matrix);

      // bit-glyph sprites follow the same path
      const sp = bits[i];
      sp.position.set(x, y, z);
      const ss = s * 0.42;
      sp.scale.set(ss, ss, ss);

      // formula-glyph sprites (wider, aspect-correct)
      const fp = formulas[i];
      fp.position.set(x, y, z);
      const fs = s * 0.5;
      fp.scale.set(fs * GLYPH_ASPECT, fs, 1);
    }
    meshCore.current.instanceMatrix.needsUpdate = true;
    meshGlow.current.instanceMatrix.needsUpdate = true;

    // pulse ripple: top segment lights first, then cascades down
    const p = pulse.current;
    if (absorbedThisFrame > 0) p[0] = Math.min(2, p[0] + 0.8 * absorbedThisFrame);
    // cascade + decay
    p[2] += (p[1] - p[2]) * 0.12;
    p[1] += (p[0] - p[1]) * 0.12;
    for (let k = 0; k < 3; k++) p[k] *= 0.93;
    const breathe = 0.04 * (0.5 + 0.5 * Math.sin(t * 1.5));
    for (let k = 0; k < 3; k++) {
      const m = segMats.current[k];
      if (!m) continue;
      m.emissiveIntensity = 0.16 + breathe + p[k] * glow;
      // optionally tint the pulse with the color of the last-landed crystal
      if (pulseTint) {
        emiss.copy(segBase[k]).lerp(pulseCol.current, Math.min(1, p[k] * 0.8));
        m.emissive.copy(emiss);
      } else {
        m.emissive.copy(segBase[k]);
      }
    }

    // fill level rising inside the cylinder as records accumulate
    if (fillMesh.current) {
      const frac = showFill ? fract(countRef.current / FILL_CAP) : 0;
      const H = SEG_H * 3;
      const h = Math.max(0.0001, H * frac);
      fillMesh.current.visible = showFill && frac > 0.01;
      fillMesh.current.scale.set(1, h, 1);
      fillMesh.current.position.y = -SEG_H * 1.5 + h / 2;
    }

    if (countEl.current) countEl.current.textContent = countRef.current.toLocaleString();

    if (group.current) {
      group.current.position.y = Math.sin(t * 1.2) * 0.03;
      if (spin) group.current.rotation.y = t * 0.15;
    }
  });

  return (
    <group ref={group}>
      {SEGS.map((s, k) => (
        <mesh key={k} position={[0, s.y, 0]}>
          <cylinderGeometry args={[R, R, SEG_H, 56, 1, true]} />
          <meshStandardMaterial
            ref={(m: THREE.MeshStandardMaterial | null) => {
              if (m) segMats.current[k] = m;
            }}
            color={s.color}
            emissive={s.color}
            emissiveIntensity={0.16}
            roughness={0.35}
            metalness={0.15}
            side={THREE.DoubleSide}
          />
          {/* status light */}
          {!showLogos && (
            <mesh position={[0, 0, R + 0.001]}>
              <circleGeometry args={[0.07, 24]} />
              <meshBasicMaterial color={0xffffff} />
            </mesh>
          )}
        </mesh>
      ))}

      {/* database name badges (toggle) */}
      {showLogos && (
        <group>
          {logoPlacements.map((p, i) => (
            <mesh key={i} position={[p.x, p.y, p.z]} rotation={[0, p.ry, 0]} material={logoMats[p.mat]}>
              <planeGeometry args={[0.62, 0.23]} />
            </mesh>
          ))}
        </group>
      )}

      {/* teal top cap */}
      <mesh position={[0, TOP_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[R, 56]} />
        <meshStandardMaterial color={TEAL} emissive={TEAL} emissiveIntensity={0.3} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* bottom cap */}
      <mesh position={[0, -SEG_H * 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[R, 56]} />
        <meshStandardMaterial color={SEGS[2].color} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* fill level (toggle) */}
      <mesh ref={fillMesh} visible={false}>
        <cylinderGeometry args={[R * 0.92, R * 0.92, 1, 48, 1, false]} />
        <meshBasicMaterial
          color={TEAL}
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <instancedMesh
        ref={meshCore}
        key={`core-${instGeoKey}`}
        args={[itemGeo, matCore, ITEMS]}
        visible={itemType === "crystals" || itemType === "atoms"}
      />
      <instancedMesh
        ref={meshGlow}
        key={`glow-${instGeoKey}`}
        args={[itemGeo, matGlow, ITEMS]}
        visible={itemType === "crystals" || itemType === "atoms"}
      />

      <group visible={itemType === "bits"}>
        {bits.map((sp, i) => (
          <primitive key={i} object={sp} />
        ))}
      </group>
      <group visible={itemType === "formulas"}>
        {formulas.map((sp, i) => (
          <primitive key={i} object={sp} />
        ))}
      </group>
    </group>
  );
}

/** Content only (no lights/camera), for embedding as a node in the shared city. */
export function DatabaseMapScene() {
  const countEl = useRef<HTMLSpanElement | null>(null);
  return (
    <DatabaseStack
      rate={1}
      glow={1}
      spin
      itemType="crystals"
      pulseTint={false}
      showFill={false}
      showLogos
      countEl={countEl}
    />
  );
}

export default function DatabaseStackAsset() {
  const [rate, setRate] = useState(1);
  const [glow, setGlow] = useState(1);
  const [spin, setSpin] = useState(false);
  const [itemType, setItemType] = useState<"crystals" | "atoms" | "bits" | "formulas">("crystals");
  const [pulseTint, setPulseTint] = useState(false);
  const [showFill, setShowFill] = useState(false);
  const [showLogos, setShowLogos] = useState(false);
  const countEl = useRef<HTMLSpanElement | null>(null);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 1.2, 5 ], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 6, 4]} intensity={0.9} />
        <pointLight position={[-4, 2, -2]} intensity={0.4} color={0x88aaff} />
        <DatabaseStack
          rate={rate}
          glow={glow}
          spin={spin}
          itemType={itemType}
          pulseTint={pulseTint}
          showFill={showFill}
          showLogos={showLogos}
          countEl={countEl}
        />
        <OrbitControls enablePan={false} enableZoom minDistance={3} maxDistance={12} target={[0, 0, 0]} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-5 top-5 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] px-4 py-3 text-right backdrop-blur-md">
          <div className="text-[11px] uppercase tracking-widest text-sky-300/80">records ingested</div>
          <div className="mt-1 font-mono text-2xl tabular-nums text-white">
            <span ref={countEl}>0</span>
          </div>
        </div>

        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Materials database — ingesting data, pulsing as it grows</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">inflow</span>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.05}
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{rate.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">pulse</span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={glow}
                onChange={(e) => setGlow(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{glow.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">data</span>
              {(["crystals", "atoms", "bits", "formulas"] as const).map((it) => (
                <button key={it} className={btn(itemType === it)} onClick={() => setItemType(it)}>
                  {it}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">db logos</span>
              <button className={btn(showLogos)} onClick={() => setShowLogos((s) => !s)}>
                {showLogos ? "on" : "off"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">fill level</span>
              <button className={btn(showFill)} onClick={() => setShowFill((s) => !s)}>
                {showFill ? "on" : "off"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">tint pulse</span>
              <button className={btn(pulseTint)} onClick={() => setPulseTint((s) => !s)}>
                {pulseTint ? "on" : "off"}
              </button>
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
