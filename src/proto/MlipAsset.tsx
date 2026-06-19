import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Machine-learning interatomic potential — a learned potential-energy
 * surface. A colored terrain of wells (low energy) and peaks; glowing probes
 * follow the downhill gradient (= forces) into the basins, then respawn.
 * Verb: descend the learned energy landscape.
 */

const SIZE = 4.2;
const SEG = 60;
const BOUND = SIZE / 2 - 0.25;

// signed gaussian features: negative amp = valley (low energy), positive = peak
const WELLS: [number, number, number, number][] = [
  [-1.0, -0.6, -1.25, 0.85],
  [1.25, 0.85, -0.95, 0.8],
  [0.15, 0.25, 0.95, 0.95],
  [-1.35, 1.25, 0.55, 0.7],
  [1.4, -1.25, 0.45, 0.7],
];

function height(x: number, z: number): number {
  let h = 0.08 * Math.sin(1.5 * x) * Math.cos(1.5 * z);
  for (const [cx, cz, amp, sig] of WELLS) {
    const dx = x - cx;
    const dz = z - cz;
    h += amp * Math.exp(-(dx * dx + dz * dz) / (2 * sig * sig));
  }
  return h;
}

type Stop = [number, [number, number, number]];
const VIRIDIS: Stop[] = [
  [0.0, [0.27, 0.0, 0.33]],
  [0.35, [0.2, 0.49, 0.72]],
  [0.62, [0.13, 0.8, 0.55]],
  [1.0, [0.99, 0.91, 0.14]],
];
function sample(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 0; i < VIRIDIS.length - 1; i++) {
    const [p0, c0] = VIRIDIS[i];
    const [p1, c1] = VIRIDIS[i + 1];
    if (x >= p0 && x <= p1) {
      const f = (x - p0) / (p1 - p0 || 1);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return VIRIDIS[VIRIDIS.length - 1][1];
}

function Probe({ speed, color }: { speed: number; color: number }) {
  const g = useRef<THREE.Group>(null);
  const st = useRef({ x: 0, z: 0, settle: 0, life: 0 });

  const respawn = () => {
    st.current.x = (Math.random() * 2 - 1) * BOUND;
    st.current.z = (Math.random() * 2 - 1) * BOUND;
    st.current.settle = 0;
    st.current.life = 0;
  };
  useMemo(respawn, []);

  useFrame((_, dt) => {
    if (!g.current) return;
    const s = st.current;
    const e = 0.02;
    const gx = (height(s.x + e, s.z) - height(s.x - e, s.z)) / (2 * e);
    const gz = (height(s.x, s.z + e) - height(s.x, s.z - e)) / (2 * e);
    const lr = 0.9 * speed;
    s.x = Math.max(-BOUND, Math.min(BOUND, s.x - lr * gx * dt * 60 * 0.02));
    s.z = Math.max(-BOUND, Math.min(BOUND, s.z - lr * gz * dt * 60 * 0.02));
    s.life += dt;
    const gmag = Math.hypot(gx, gz);
    if (gmag < 0.06) s.settle += dt;
    if (s.settle > 1.0 || s.life > 9) respawn();
    g.current.position.set(s.x, height(s.x, s.z) + 0.12, s.z);
  });

  return (
    <group ref={g}>
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Landscape({ speed, spin, wire }: { speed: number; spin: boolean; wire: boolean }) {
  const group = useRef<THREE.Group>(null);

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const hs = new Float32Array(pos.count);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const h = height(pos.getX(i), pos.getZ(i));
      hs[i] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, hs[i]);
      const c = sample((hs[i] - min) / (max - min || 1));
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  useFrame((state) => {
    if (group.current && spin) group.current.rotation.y = state.clock.elapsedTime * 0.12;
  });

  return (
    <group ref={group}>
      <mesh geometry={geo}>
        <meshStandardMaterial vertexColors roughness={0.65} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      {wire && (
        <lineSegments>
          <wireframeGeometry args={[geo]} />
          <lineBasicMaterial color={0xffffff} transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending} />
        </lineSegments>
      )}
      <Probe speed={speed} color={0x9bf6ff} />
      <Probe speed={speed} color={0xfff1a8} />
      <Probe speed={speed} color={0xff9ee0} />
    </group>
  );
}

export default function MlipAsset() {
  const [speed, setSpeed] = useState(1);
  const [spin, setSpin] = useState(true);
  const [wire, setWire] = useState(true);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 3.1, 5.2], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 6, 4]} intensity={0.9} />
        <pointLight position={[-4, 3, -2]} intensity={0.4} color={0x88aaff} />
        <Landscape speed={speed} spin={spin} wire={wire} />
        <OrbitControls enablePan={false} enableZoom minDistance={3} maxDistance={13} target={[0, -0.2, 0]} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">MLIP — learned energy landscape; probes follow forces downhill</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">descent</span>
              <input
                type="range"
                min={0.2}
                max={2.5}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{speed.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">grid</span>
              <button className={btn(wire)} onClick={() => setWire((w) => !w)}>
                {wire ? "on" : "off"}
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
