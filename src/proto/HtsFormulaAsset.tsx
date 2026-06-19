import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: HTS (formula variant). Compound-formula names stream into a funnel
 * and get screened; the few that pass convert into crystals that pile up at
 * the bottom, the rest flash red and veer out. Verb: screen names -> keep crystals.
 */

const COUNT = 72;
const PASS_RATE = 0.28;
const Y_TOP = 2.4;
const Y_SPAN = 4.4;
const BOTTOM_Y = Y_TOP - Y_SPAN;
const R_WIDE = 1.7;
const R_NECK = 0.18;
const U_NECK = 0.62;
const D_START = 0.5;
const D_MID = 0.67;

const NEUTRAL: [number, number, number] = [0.7, 0.78, 0.92];
const PASS: [number, number, number] = [0.3, 0.95, 0.62];
const FAIL: [number, number, number] = [0.96, 0.4, 0.36];

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

function KeptPile({ size }: { size: number }) {
  const meshStd = useRef<THREE.InstancedMesh>(null);
  const meshGlow = useRef<THREE.InstancedMesh>(null);
  const { geo, gems, count } = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.08, 0);
    const count = 30;
    const gems: { x: number; y: number; z: number; s: number; ph: number }[] = [];
    for (let i = 0; i < count; i++) {
      const r = 0.55 * Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      gems.push({
        x: Math.cos(a) * r,
        y: BOTTOM_Y + (0.55 - r) * 0.4 + Math.random() * 0.05,
        z: Math.sin(a) * r,
        s: 0.8 + Math.random() * 0.5,
        ph: Math.random() * 6.28,
      });
    }
    return { geo: g, gems, count };
  }, []);
  const matStd = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x4dffa0, roughness: 0.3, metalness: 0.1, emissive: 0x0c5a34, emissiveIntensity: 0.6 }),
    []
  );
  const matGlow = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x4dffa0, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }),
    []
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    if (!meshStd.current || !meshGlow.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const g = gems[i];
      dummy.position.set(g.x, g.y + Math.sin(t * 1.5 + g.ph) * 0.015, g.z);
      dummy.rotation.set(g.ph, t * 0.2 + g.ph, 0);
      dummy.scale.setScalar(size * g.s);
      dummy.updateMatrix();
      meshStd.current.setMatrixAt(i, dummy.matrix);
      meshGlow.current.setMatrixAt(i, dummy.matrix);
    }
    meshStd.current.instanceMatrix.needsUpdate = true;
    meshGlow.current.instanceMatrix.needsUpdate = true;
    matGlow.opacity = 0.35 + 0.2 * (0.5 + 0.5 * Math.sin(t * 2));
  });
  return (
    <group>
      <instancedMesh ref={meshStd} args={[geo, matStd, count]} />
      <instancedMesh ref={meshGlow} args={[geo, matGlow, count]} />
    </group>
  );
}

function ScreeningFunnel({ speed, size, spin }: { speed: number; size: number; spin: boolean }) {
  const group = useRef<THREE.Group>(null);
  const meshCore = useRef<THREE.InstancedMesh>(null);
  const meshGlow = useRef<THREE.InstancedMesh>(null);

  const sharedTex = useMemo(() => FORMULAS.map((f) => glyphTexture(f)), []);
  const cand = useMemo(() => {
    const arr: { theta: number; offset: number; pass: boolean; fi: number; wf: number; wp: number }[] = [];
    for (let i = 0; i < COUNT; i++) {
      arr.push({
        theta: Math.random() * Math.PI * 2,
        offset: Math.random(),
        pass: Math.random() < PASS_RATE,
        fi: (Math.random() * FORMULAS.length) | 0,
        wf: 2 + Math.random() * 3,
        wp: Math.random() * 6.28,
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

  const crystGeo = useMemo(() => new THREE.IcosahedronGeometry(0.08, 0), []);
  const matCore = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x4dffa0 }), []);
  const matGlow = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x4dffa0, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }),
    []
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tintCol = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    // start crystals hidden
    for (let i = 0; i < COUNT; i++) {
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      meshCore.current?.setMatrixAt(i, dummy.matrix);
      meshGlow.current?.setMatrixAt(i, dummy.matrix);
    }
    if (meshCore.current) meshCore.current.instanceMatrix.needsUpdate = true;
    if (meshGlow.current) meshGlow.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((state) => {
    if (!meshCore.current || !meshGlow.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const c = cand[i];
      let u = (t * speed + c.offset) % 1;
      if (u < 0) u += 1;
      const passed = c.pass;

      let R: number;
      if (u <= U_NECK) R = R_WIDE + (R_NECK - R_WIDE) * smoother(u / U_NECK);
      else if (passed) R = R_NECK * 0.35;
      else R = R_NECK + (u - U_NECK) * 5.0;
      R += Math.sin(t * c.wf + c.wp) * 0.03;
      const th = c.theta + t * 0.25;
      const x = Math.cos(th) * R;
      const z = Math.sin(th) * R;
      const y = Y_TOP - Y_SPAN * u;

      // color through the decision window
      let col = NEUTRAL;
      if (u >= D_START) col = lerp3(NEUTRAL, passed ? PASS : FAIL, clamp01((u - D_START) / (D_MID - D_START)));

      // formula sprite: visible until pass-conversion / fail-vanish
      const sp = sprites[i];
      const spriteOn = passed ? u < D_MID : u < D_MID + 0.22;
      sp.visible = spriteOn;
      if (spriteOn) {
        let s = 1;
        if (!passed && u > D_MID) s *= 1 - clamp01((u - D_MID) / 0.22);
        s *= u < 0.04 ? u / 0.04 : 1;
        const fs = size * 0.5 * s;
        sp.position.set(x, y, z);
        sp.scale.set(fs * GLYPH_ASPECT, fs, 1);
        tintCol.setRGB(col[0], col[1], col[2]);
        sp.material.color.copy(tintCol);
        sp.material.opacity = clamp01(s);
      }

      // crystal: the passed candidate, after conversion, falling to the pile
      const crystOn = passed && u >= D_MID;
      let cs = 0;
      if (crystOn) {
        cs = size * 1.1;
        cs *= u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1;
        const pop = smoother(clamp01((u - D_MID) / 0.12)); // grow in as it forms
        cs *= 0.3 + 0.7 * pop;
      }
      dummy.position.set(x, y, z);
      dummy.rotation.set(t * 0.9 + i, t * 0.7 + i, 0);
      dummy.scale.setScalar(Math.max(0, cs));
      dummy.updateMatrix();
      meshCore.current.setMatrixAt(i, dummy.matrix);
      meshGlow.current.setMatrixAt(i, dummy.matrix);
    }
    meshCore.current.instanceMatrix.needsUpdate = true;
    meshGlow.current.instanceMatrix.needsUpdate = true;
    if (group.current && spin) group.current.rotation.y = t * 0.1;
  });

  const yNeck = Y_TOP - Y_SPAN * U_NECK;
  const wallH = Y_TOP - yNeck;
  const ring = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * R_NECK, 0, Math.sin(a) * R_NECK));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  return (
    <group ref={group}>
      {sprites.map((sp, i) => (
        <primitive key={i} object={sp} />
      ))}
      <instancedMesh ref={meshCore} args={[crystGeo, matCore, COUNT]} />
      <instancedMesh ref={meshGlow} args={[crystGeo, matGlow, COUNT]} />

      <mesh position={[0, (Y_TOP + yNeck) / 2, 0]}>
        <cylinderGeometry args={[R_NECK, R_WIDE, wallH, 48, 1, true]} />
        <meshBasicMaterial color={0x33405c} transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineLoop position={[0, yNeck, 0]} geometry={ring}>
        <lineBasicMaterial color={0x6cf0ff} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineLoop>

      <KeptPile size={size} />
    </group>
  );
}

export default function HtsFormulaAsset() {
  const [speed, setSpeed] = useState(0.16);
  const [size, setSize] = useState(1);
  const [spin, setSpin] = useState(true);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0.3, 6.5], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 3]} intensity={0.85} />
        <pointLight position={[-4, -2, -3]} intensity={0.4} color={0x88aaff} />
        <ScreeningFunnel speed={speed} size={size} spin={spin} />
        <OrbitControls enablePan={false} enableZoom minDistance={3.5} maxDistance={15} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">HTS — screen formulas, keep crystals</div>
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
