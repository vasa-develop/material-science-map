import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Literature & Dark Data. A drifting field of paper-glyphs. A few
 * published papers glow bright; the vast majority are "dark data" — the
 * unpublished failed experiments — barely visible, flickering faintly. A
 * reveal toggle surfaces the hidden mass. Verb: drift; dark ones flicker.
 */

const COUNT = 200;
const PUB_RATE = 0.14;
const SLAB_X = 2.4;
const SLAB_Y = 2.1;
const SLAB_Z = 1.3;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function paperTexture(): THREE.Texture {
  const W = 96;
  const H = 128;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  // page outline (with a folded corner) drawn as light strokes on transparent
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(14, 10);
  ctx.lineTo(W - 26, 10);
  ctx.lineTo(W - 12, 26);
  ctx.lineTo(W - 12, H - 12);
  ctx.lineTo(14, H - 12);
  ctx.closePath();
  ctx.stroke();
  // fold
  ctx.beginPath();
  ctx.moveTo(W - 26, 10);
  ctx.lineTo(W - 26, 26);
  ctx.lineTo(W - 12, 26);
  ctx.stroke();
  // text lines
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";
  for (let i = 0; i < 7; i++) {
    const y = 38 + i * 12;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(W - 22 - (i % 3) * 10, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

function PaperField({ speed, reveal }: { speed: number; reveal: boolean }) {
  const inst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scratch = useMemo(() => new THREE.Color(), []);
  const tex = useMemo(() => paperTexture(), []);
  const revealAmt = useRef(0);

  const papers = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * 2 * SLAB_X,
        y: (Math.random() - 0.5) * 2 * SLAB_Y,
        z: (Math.random() - 0.5) * 2 * SLAB_Z,
        vy: 0.04 + Math.random() * 0.1,
        s: 0.7 + Math.random() * 0.7,
        roll: (Math.random() - 0.5) * 0.5,
        ph: Math.random() * 6.28,
        pub: Math.random() < PUB_RATE,
      })),
    []
  );

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.3, 0.4);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    return g;
  }, []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    [tex]
  );

  const PUB = useMemo(() => new THREE.Color(0x8fe0ff), []);
  const DARK = useMemo(() => new THREE.Color(0x9fb1d6), []);

  useFrame((state, dt) => {
    if (!inst.current) return;
    const t = state.clock.elapsedTime;
    revealAmt.current += ((reveal ? 1 : 0) - revealAmt.current) * Math.min(1, dt * 3);
    const rev = revealAmt.current;
    const camQ = state.camera.quaternion;

    for (let i = 0; i < COUNT; i++) {
      const p = papers[i];
      p.y += p.vy * dt * speed;
      if (p.y > SLAB_Y) p.y = -SLAB_Y;

      dummy.position.set(p.x, p.y, p.z);
      dummy.quaternion.copy(camQ);
      dummy.rotateZ(p.roll + Math.sin(t * 0.3 + p.ph) * 0.05);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      inst.current.setMatrixAt(i, dummy.matrix);

      let b: number;
      if (p.pub) {
        b = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.5 + p.ph));
        scratch.copy(PUB).multiplyScalar(b);
      } else {
        const flick = Math.pow(Math.max(0, Math.sin(t * 0.9 + p.ph * 7)), 8);
        b = 0.06 + 0.16 * flick;
        b = b + (0.62 - b) * rev; // reveal lifts the dark data
        scratch.copy(DARK).multiplyScalar(b);
      }
      inst.current.setColorAt(i, scratch);
    }
    inst.current.instanceMatrix.needsUpdate = true;
    if (inst.current.instanceColor) inst.current.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={inst} args={[geo, mat, COUNT]} />;
}

export default function LiteratureAsset() {
  const [speed, setSpeed] = useState(1);
  const [reveal, setReveal] = useState(false);
  const [orbit, setOrbit] = useState(true);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0, 5.2], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#05060c"]} />
        <PaperField speed={speed} reveal={reveal} />
        <OrbitControls enablePan={false} enableZoom autoRotate={orbit} autoRotateSpeed={0.35} minDistance={3} maxDistance={11} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Literature & dark data — a few published, most unseen</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-400">drift</span>
              <input type="range" min={0.2} max={3} step={0.05} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-36 accent-sky-400" />
              <span className="text-[11px] tabular-nums text-slate-500">{speed.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-400">reveal dark data</span>
              <button className={btn(reveal)} onClick={() => setReveal((s) => !s)}>
                {reveal ? "on" : "off"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-400">orbit</span>
              <button className={btn(orbit)} onClick={() => setOrbit((s) => !s)}>
                {orbit ? "on" : "off"}
              </button>
            </div>
            <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#8fe0ff", boxShadow: "0 0 6px #8fe0ff" }} />published</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-600" />dark data</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
