import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Generative model (gem variant) — a faceted crystal cluster that
 * shines and sparkles. Hexagonal prisms with an iridescent vertical gradient;
 * a slow spin sweeps specular highlights across facets while star glints
 * twinkle around it. Verb: shine + sparkle.
 */

type Stop = [number, [number, number, number]];
const GEM: Stop[] = [
  [0.0, [0.6, 0.25, 0.85]], // violet base
  [0.4, [0.32, 0.45, 0.95]], // blue
  [0.7, [0.35, 0.85, 0.95]], // cyan
  [1.0, [0.55, 0.98, 0.7]], // green tip
];

function sample(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 0; i < GEM.length - 1; i++) {
    const [p0, c0] = GEM[i];
    const [p1, c1] = GEM[i + 1];
    if (x >= p0 && x <= p1) {
      const f = (x - p0) / (p1 - p0 || 1);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return GEM[GEM.length - 1][1];
}

function setGradient(geo: THREE.BufferGeometry, yMin: number, yMax: number) {
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const f = (pos.getY(i) - yMin) / (yMax - yMin || 1);
    const c = sample(f);
    arr[i * 3] = c[0];
    arr[i * 3 + 1] = c[1];
    arr[i * 3 + 2] = c[2];
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
}

function starTexture(): THREE.Texture {
  const s = 64;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d")!;
  const c = s / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(c, 4);
  ctx.lineTo(c, s - 4);
  ctx.moveTo(4, c);
  ctx.lineTo(s - 4, c);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

function GemCluster({ spin, sparkle }: { spin: boolean; sparkle: number }) {
  const group = useRef<THREE.Group>(null);

  const crystals = useMemo(() => {
    const out: {
      pos: [number, number, number];
      rot: [number, number, number];
      bodyGeo: THREE.BufferGeometry;
      tipGeo: THREE.BufferGeometry;
    }[] = [];
    const N = 6;
    for (let i = -1; i < N; i++) {
      const center = i === -1;
      const ang = (i / N) * Math.PI * 2 + 0.4;
      const ringR = center ? 0 : 0.34 + Math.random() * 0.12;
      const h = center ? 2.0 + Math.random() * 0.3 : 0.9 + Math.random() * 0.8;
      const rad = center ? 0.3 : 0.16 + Math.random() * 0.12;
      const tipH = h * 0.4;

      const body = new THREE.CylinderGeometry(rad, rad, h, 6);
      const tip = new THREE.ConeGeometry(rad, tipH, 6);
      tip.translate(0, h / 2 + tipH / 2, 0);
      const yMin = -h / 2;
      const yMax = h / 2 + tipH;
      setGradient(body, yMin, yMax);
      setGradient(tip, yMin, yMax);

      const tilt = center ? 0 : 0.12 + Math.random() * 0.28;
      out.push({
        pos: [Math.cos(ang) * ringR, -0.55 - yMin, Math.sin(ang) * ringR],
        rot: [Math.sin(ang) * tilt, Math.random() * Math.PI, Math.cos(ang) * tilt],
        bodyGeo: body,
        tipGeo: tip,
      });
    }
    return out;
  }, []);

  const crystalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        roughness: 0.12,
        metalness: 0.0,
        emissive: new THREE.Color(0x223066),
        emissiveIntensity: 0.5,
        side: THREE.DoubleSide,
      }),
    []
  );
  const edgeMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0xcfe4ff,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  const tex = useMemo(() => starTexture(), []);
  const sparkles = useMemo(() => {
    const arr: { sprite: THREE.Sprite; phase: number; freq: number; base: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.6, 0.85),
      });
      const sprite = new THREE.Sprite(m);
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 1.0 + Math.random() * 1.3;
      sprite.position.set(r * s * Math.cos(phi), 0.2 + r * u * 0.7, r * s * Math.sin(phi));
      arr.push({ sprite, phase: Math.random() * 6.28, freq: 1.5 + Math.random() * 2.5, base: 0.22 + Math.random() * 0.3 });
    }
    return arr;
  }, [tex]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current && spin) group.current.rotation.y = t * 0.22;
    for (const sp of sparkles) {
      const tw = 0.5 + 0.5 * Math.sin(t * sp.freq * (0.4 + sparkle) + sp.phase);
      sp.sprite.material.opacity = 0.1 + 0.9 * tw * tw;
      const sc = sp.base * (0.45 + 0.75 * tw);
      sp.sprite.scale.set(sc, sc, 1);
    }
  });

  return (
    <group ref={group}>
      {crystals.map((c, i) => (
        <group key={i} position={c.pos} rotation={c.rot}>
          <mesh geometry={c.bodyGeo} material={crystalMat} />
          <mesh geometry={c.tipGeo} material={crystalMat} />
          <lineSegments material={edgeMat}>
            <edgesGeometry args={[c.bodyGeo]} />
          </lineSegments>
          <lineSegments material={edgeMat}>
            <edgesGeometry args={[c.tipGeo]} />
          </lineSegments>
        </group>
      ))}
      {sparkles.map((s, i) => (
        <primitive key={i} object={s.sprite} />
      ))}
    </group>
  );
}

export default function GenerativeGemAsset() {
  const [spin, setSpin] = useState(true);
  const [sparkle, setSparkle] = useState(0.6);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0.4, 5.5], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 4]} intensity={1.1} />
        <pointLight position={[-4, 1, -2]} intensity={0.7} color={0xff7bd5} />
        <pointLight position={[4, -1, 3]} intensity={0.7} color={0x6cf0ff} />
        <GemCluster spin={spin} sparkle={sparkle} />
        <OrbitControls enablePan={false} enableZoom minDistance={3} maxDistance={12} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Generative model — crystal cluster, shine &amp; sparkle</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">sparkle</span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={sparkle}
                onChange={(e) => setSparkle(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{sparkle.toFixed(2)}</span>
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
