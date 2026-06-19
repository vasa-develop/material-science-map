import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: High-throughput screening — a wide stream of candidate materials
 * pours into a funnel; most are rejected (flash red, veer out, vanish), a few
 * pass (turn green, glow, fall through the neck). Verb: screen / filter many → few.
 */

const COUNT = 260;
const PASS_RATE = 0.2;
const Y_TOP = 2.4;
const Y_SPAN = 4.4; // falls to y = Y_TOP - Y_SPAN
const R_WIDE = 1.7;
const R_NECK = 0.18;
const U_NECK = 0.62; // progress at which the funnel neck / decision happens
const D_START = 0.5;
const D_MID = 0.67;

const NEUTRAL: [number, number, number] = [0.62, 0.7, 0.85];
const PASS: [number, number, number] = [0.3, 0.95, 0.62];
const FAIL: [number, number, number] = [0.96, 0.33, 0.3];

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

const BOTTOM_Y = Y_TOP - Y_SPAN;

function KeptPile({ size }: { size: number }) {
  const meshStd = useRef<THREE.InstancedMesh>(null);
  const meshGlow = useRef<THREE.InstancedMesh>(null);

  const { geo, gems, count } = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.075, 0);
    const n = g.attributes.position.count;
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    const count = 26;
    const gems: { x: number; y: number; z: number; s: number; ph: number }[] = [];
    for (let i = 0; i < count; i++) {
      const r = 0.5 * Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      gems.push({
        x: Math.cos(a) * r,
        y: BOTTOM_Y + (0.5 - r) * 0.45 + Math.random() * 0.06,
        z: Math.sin(a) * r,
        s: 0.85 + Math.random() * 0.4,
        ph: Math.random() * 6.28,
      });
    }
    return { geo: g, gems, count };
  }, []);

  const matStd = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.1 }),
    []
  );
  const matGlow = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const inited = useRef(false);

  useFrame((state) => {
    if (!meshStd.current || !meshGlow.current) return;
    const t = state.clock.elapsedTime;
    const c = new THREE.Color(PASS[0], PASS[1], PASS[2]);
    for (let i = 0; i < count; i++) {
      const g = gems[i];
      dummy.position.set(g.x, g.y + Math.sin(t * 1.5 + g.ph) * 0.015, g.z);
      dummy.rotation.set(g.ph, t * 0.2 + g.ph, 0);
      dummy.scale.setScalar(size * g.s);
      dummy.updateMatrix();
      meshStd.current.setMatrixAt(i, dummy.matrix);
      meshGlow.current.setMatrixAt(i, dummy.matrix);
      if (!inited.current) {
        meshStd.current.setColorAt(i, c);
        meshGlow.current.setColorAt(i, c);
      }
    }
    meshStd.current.instanceMatrix.needsUpdate = true;
    meshGlow.current.instanceMatrix.needsUpdate = true;
    if (!inited.current) {
      if (meshStd.current.instanceColor) meshStd.current.instanceColor.needsUpdate = true;
      if (meshGlow.current.instanceColor) meshGlow.current.instanceColor.needsUpdate = true;
      inited.current = true;
    }
    matGlow.opacity = 0.35 + 0.2 * (0.5 + 0.5 * Math.sin(t * 2));
  });

  const yNeck = Y_TOP - Y_SPAN * U_NECK;
  return (
    <group>
      <instancedMesh ref={meshStd} args={[geo, matStd, count]} />
      <instancedMesh ref={meshGlow} args={[geo, matGlow, count]} />
      {/* beam: neck -> bin */}
      <mesh position={[0, (yNeck + BOTTOM_Y) / 2 + 0.25, 0]}>
        <cylinderGeometry args={[R_NECK * 0.4, 0.5, yNeck - BOTTOM_Y - 0.25, 24, 1, true]} />
        <meshBasicMaterial
          color={0x4dffa0}
          transparent
          opacity={0.07}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function ScreeningFunnel({
  speed,
  spin,
  size,
  showKept,
}: {
  speed: number;
  spin: boolean;
  size: number;
  showKept: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const meshStd = useRef<THREE.InstancedMesh>(null);
  const meshGlow = useRef<THREE.InstancedMesh>(null);

  const cand = useMemo(() => {
    const theta: number[] = [];
    const offset: number[] = [];
    const pass: boolean[] = [];
    const wf: number[] = [];
    const wp: number[] = [];
    for (let i = 0; i < COUNT; i++) {
      theta.push(Math.random() * Math.PI * 2);
      offset.push(Math.random());
      pass.push(Math.random() < PASS_RATE);
      wf.push(2 + Math.random() * 3);
      wp.push(Math.random() * 6.28);
    }
    return { theta, offset, pass, wf, wp };
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.075, 0);
    const n = g.attributes.position.count;
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    return g;
  }, []);
  const matStd = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1 }),
    []
  );
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
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cStd = useMemo(() => new THREE.Color(), []);
  const cGlow = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!meshStd.current || !meshGlow.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      let u = (t * speed + cand.offset[i]) % 1;
      if (u < 0) u += 1;
      const passed = cand.pass[i];

      // radius profile: wide -> neck, then pass stays tight / fail veers out
      let R: number;
      if (u <= U_NECK) {
        R = R_WIDE + (R_NECK - R_WIDE) * smoother(u / U_NECK);
      } else if (passed) {
        R = R_NECK * 0.35;
      } else {
        R = R_NECK + (u - U_NECK) * 5.0;
      }
      R += Math.sin(t * cand.wf[i] + cand.wp[i]) * 0.03;

      const th = cand.theta[i] + t * 0.25;
      const y = Y_TOP - Y_SPAN * u;

      // color: neutral -> green (pass) / red (fail) through the decision window
      let col = NEUTRAL;
      let glowAmt = 0;
      if (u >= D_START) {
        const f = clamp01((u - D_START) / (D_MID - D_START));
        col = lerp3(NEUTRAL, passed ? PASS : FAIL, f);
        glowAmt = f * (passed ? 1 : 0.55);
      }

      // scale: fails shrink away after decision; everyone fades at the very end
      let s = 1;
      if (!passed && u > D_MID) s *= 1 - clamp01((u - D_MID) / 0.22);
      s *= u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1;
      s *= u < 0.04 ? u / 0.04 : 1; // ease-in at spawn
      s *= size * (passed ? 1.12 : 1);

      dummy.position.set(Math.cos(th) * R, y, Math.sin(th) * R);
      dummy.rotation.set(t * 0.8 + i, t * 0.6 + i, 0);
      dummy.scale.setScalar(Math.max(0, s));
      dummy.updateMatrix();
      meshStd.current.setMatrixAt(i, dummy.matrix);
      meshGlow.current.setMatrixAt(i, dummy.matrix);

      cStd.setRGB(col[0], col[1], col[2]);
      meshStd.current.setColorAt(i, cStd);
      cGlow.setRGB(col[0] * glowAmt, col[1] * glowAmt, col[2] * glowAmt);
      meshGlow.current.setColorAt(i, cGlow);
    }
    meshStd.current.instanceMatrix.needsUpdate = true;
    meshGlow.current.instanceMatrix.needsUpdate = true;
    if (meshStd.current.instanceColor) meshStd.current.instanceColor.needsUpdate = true;
    if (meshGlow.current.instanceColor) meshGlow.current.instanceColor.needsUpdate = true;
    if (group.current && spin) group.current.rotation.y = t * 0.12;
  });

  // funnel wall + neck ring (static guides)
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
      <instancedMesh ref={meshStd} args={[geo, matStd, COUNT]} />
      <instancedMesh ref={meshGlow} args={[geo, matGlow, COUNT]} />

      <mesh position={[0, (Y_TOP + yNeck) / 2, 0]}>
        <cylinderGeometry args={[R_NECK, R_WIDE, wallH, 48, 1, true]} />
        <meshBasicMaterial
          color={0x33405c}
          transparent
          opacity={0.07}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <lineLoop position={[0, yNeck, 0]} geometry={ring}>
        <lineBasicMaterial color={0x6cf0ff} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineLoop>

      {showKept && <KeptPile size={size} />}
    </group>
  );
}

export default function HtsAsset() {
  const [speed, setSpeed] = useState(0.18);
  const [spin, setSpin] = useState(true);
  const [size, setSize] = useState(1);
  const [showKept, setShowKept] = useState(true);

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
        <ScreeningFunnel speed={speed} spin={spin} size={size} showKept={showKept} />
        <OrbitControls enablePan={false} enableZoom minDistance={3.5} maxDistance={15} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">High-throughput screening — many candidates in, few pass</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">flow</span>
              <input
                type="range"
                min={0.05}
                max={0.5}
                step={0.01}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{speed.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">size</span>
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
              <span className="w-20 text-xs text-slate-400">kept pile</span>
              <button className={btn(showKept)} onClick={() => setShowKept((s) => !s)}>
                {showKept ? "on" : "off"}
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
