import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: 2s atomic orbital — dense inner blob, a radial node (gap), then a
 * diffuse outer shell. Points are sampled from the true 2s radial probability
 *   P(rho) ∝ rho^2 (2 - rho)^2 e^{-rho}   (node at rho = 2),
 * so the inner/outer split emerges from the physics, not by hand.
 * Verb: spin + breathe. Uniform violet (no center/shell color split).
 */

const SCALE = 0.5; // maps rho -> scene units (outer shell peak ~rho 5.24)
const RHO_MAX = 14;
const P_ENVELOPE = 1.6; // > max of P(rho) over [0, RHO_MAX]

function radialP(rho: number): number {
  const a = 2 - rho;
  return rho * rho * a * a * Math.exp(-rho);
}

function build2s(count: number) {
  const positions = new Float32Array(count * 3);
  let i = 0;
  while (i < count) {
    // rejection-sample the radial coordinate from P(rho)
    const rho = Math.random() * RHO_MAX;
    if (Math.random() * P_ENVELOPE > radialP(rho)) continue;

    // uniform direction on the unit sphere
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = rho * SCALE;
    positions[i * 3] = r * s * Math.cos(phi);
    positions[i * 3 + 1] = r * s * Math.sin(phi);
    positions[i * 3 + 2] = r * u;
    i++;
  }
  return positions;
}

function Orbital2s({ spin, pointSize }: { spin: boolean; pointSize: number }) {
  const group = useRef<THREE.Group>(null);
  const positions = useMemo(() => build2s(18000), []);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    if (spin) group.current.rotation.y = t * 0.25;
    group.current.rotation.x = Math.sin(t * 0.3) * 0.15;
    group.current.scale.setScalar(1 + Math.sin(t * 1.1) * 0.04);
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={0x9d5cff}
          size={pointSize}
          sizeAttenuation
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default function Orbital2sAsset() {
  const [spin, setSpin] = useState(true);
  const [pointSize, setPointSize] = useState(0.04);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0, 8], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <Orbital2s spin={spin} pointSize={pointSize} />
        <OrbitControls enablePan={false} enableZoom minDistance={3.5} maxDistance={16} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">2s orbital — inner blob, radial node, outer shell</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-14 text-xs text-slate-400">size</span>
              <input
                type="range"
                min={0.015}
                max={0.11}
                step={0.005}
                value={pointSize}
                onChange={(e) => setPointSize(parseFloat(e.target.value))}
                className="w-32 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{pointSize.toFixed(3)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 text-xs text-slate-400">spin</span>
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
