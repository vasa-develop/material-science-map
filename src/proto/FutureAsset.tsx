import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: The Future. An abstract aurora curtain shimmering over a dark horizon,
 * hues drifting through green-cyan-violet while light ribbons undulate, with a
 * field of slow-drifting stars. Verb: shimmering drift.
 */

const COLS = 110;
const SPAN = 6;

function Aurora({ speed }: { speed: number }) {
  const inst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);

  // vertical alpha-gradient texture: opaque at the base, fading to transparent
  const tex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 4;
    cv.height = 64;
    const ctx = cv.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 64, 0, 0);
    g.addColorStop(0, "rgba(255,255,255,0.0)");
    g.addColorStop(0.12, "rgba(255,255,255,0.9)");
    g.addColorStop(0.5, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0.0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 64);
    return new THREE.CanvasTexture(cv);
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0, 0.5, 0); // anchor at the base
    return g;
  }, []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    [tex]
  );

  const cols = useMemo(
    () =>
      Array.from({ length: COLS }, (_, i) => {
        const u = i / (COLS - 1);
        return { x: (u - 0.5) * SPAN, z: -Math.cos((u - 0.5) * Math.PI) * 0.8 - 0.4, ph: u * 8 };
      }),
    []
  );

  useFrame((state) => {
    if (!inst.current) return;
    const t = state.clock.elapsedTime * speed;
    for (let i = 0; i < COLS; i++) {
      const c = cols[i];
      const wave = 0.5 + 0.5 * Math.sin(t * 0.8 + c.ph) * Math.sin(t * 0.3 + c.ph * 0.5);
      const h = 1.4 + wave * 2.6;
      const sway = Math.sin(t * 0.5 + c.ph) * 0.15;
      dummy.position.set(c.x + sway, -1.2, c.z);
      dummy.scale.set(SPAN / COLS + 0.02, h, 1);
      dummy.updateMatrix();
      inst.current.setMatrixAt(i, dummy.matrix);

      const hue = (0.33 + 0.22 * Math.sin(t * 0.25 + c.ph * 0.4) + 0.12 * Math.sin(t * 0.7 + i * 0.1)) % 1;
      col.setHSL((hue + 1) % 1, 0.8, 0.55 * (0.5 + 0.5 * wave));
      inst.current.setColorAt(i, col);
    }
    inst.current.instanceMatrix.needsUpdate = true;
    if (inst.current.instanceColor) inst.current.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={inst} args={[geo, mat, COLS]} />;
}

function Stars() {
  const pts = useRef<THREE.Points>(null);
  const { geo, mat } = useMemo(() => {
    const N = 320;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = Math.random() * 4 + 0.5;
      pos[i * 3 + 2] = -2 - Math.random() * 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xbfe0ff, size: 0.03, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    return { geo: g, mat: m };
  }, []);
  useFrame((state) => {
    if (pts.current) {
      const m = pts.current.material as THREE.PointsMaterial;
      m.opacity = 0.5 + 0.25 * Math.sin(state.clock.elapsedTime * 0.8);
    }
  });
  return <points ref={pts} geometry={geo} material={mat} />;
}

export default function FutureAsset() {
  const [speed, setSpeed] = useState(1);
  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0.6, 5.4], fov: 55 }} dpr={[1, 2]}>
        <color attach="background" args={["#04050b"]} />
        <Stars />
        <Aurora speed={speed} />
        {/* horizon glow */}
        <mesh position={[0, -1.25, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10, 3]} />
          <meshBasicMaterial color={0x163a4a} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <OrbitControls enablePan={false} enableZoom minDistance={3} maxDistance={11} target={[0, 0.2, 0]} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">The future — an open horizon</div>
          <div className="pointer-events-auto inline-flex items-center gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <span className="w-16 text-xs text-slate-400">drift</span>
            <input type="range" min={0.2} max={3} step={0.05} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-36 accent-sky-400" />
            <span className="text-[11px] tabular-nums text-slate-500">{speed.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </>
  );
}
