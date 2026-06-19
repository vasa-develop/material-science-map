import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Production Scales. Three nested vessels — bench, pilot, industrial —
 * with a scale-up pulse that ripples outward from the smallest to the largest,
 * flaring each in turn. Verb: scale-up pulse.
 */

const VESSELS = [
  { r: 0.5, h: 0.9, color: 0x6cd0ff, label: "bench" },
  { r: 1.0, h: 1.5, color: 0x6affb0, label: "pilot" },
  { r: 1.6, h: 2.1, color: 0xffc24a, label: "industrial" },
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function Vessel({
  idx,
  r,
  h,
  color,
  pulse,
}: {
  idx: number;
  r: number;
  h: number;
  color: number;
  pulse: React.MutableRefObject<number>;
}) {
  const wallMat = useRef<THREE.MeshStandardMaterial>(null);
  const rimMat = useRef<THREE.MeshStandardMaterial>(null);
  const fillMat = useRef<THREE.MeshBasicMaterial>(null);
  const fill = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const p = pulse.current;
    const d = p - (idx + 0.5) / 3;
    const flare = Math.exp(-(d * d) / 0.012);
    if (wallMat.current) {
      wallMat.current.emissiveIntensity = 0.25 + flare * 1.6;
      wallMat.current.opacity = 0.16 + flare * 0.18;
    }
    if (rimMat.current) rimMat.current.emissiveIntensity = 0.5 + flare * 1.8;
    const lvl = 0.25 + 0.6 * clamp01((p - idx / 3) / (1 / 3));
    if (fill.current && fillMat.current) {
      fill.current.scale.y = Math.max(0.001, lvl);
      fill.current.position.y = (lvl * h) / 2 - h / 2 + 0.06;
      fillMat.current.opacity = 0.35 + flare * 0.4;
    }
    if (ringMat.current) ringMat.current.opacity = flare * 0.9;
  });

  return (
    <group>
      {/* wall */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[r, r, h, 48, 1, true]} />
        <meshStandardMaterial
          ref={wallMat}
          color={color}
          emissive={color}
          emissiveIntensity={0.25}
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>
      {/* top + bottom rims */}
      <mesh position={[0, h / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r, 0.022, 12, 64]} />
        <meshStandardMaterial ref={rimMat} color={color} emissive={color} emissiveIntensity={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, -h / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r, 0.022, 12, 64]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.4} />
      </mesh>
      {/* liquid fill */}
      <mesh ref={fill} position={[0, -h / 2 + 0.06, 0]}>
        <cylinderGeometry args={[r * 0.94, r * 0.94, h, 40]} />
        <meshBasicMaterial ref={fillMat} color={color} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* scale-up ring on the floor */}
      <mesh position={[0, -h / 2 + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r + 0.06, 0.03, 10, 64]} />
        <meshBasicMaterial ref={ringMat} color={0xffffff} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Rig({ speed }: { speed: number }) {
  const group = useRef<THREE.Group>(null);
  const pulse = useRef(0);
  useFrame((state) => {
    pulse.current = (state.clock.elapsedTime * speed * 0.12) % 1.25;
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.15;
  });
  return (
    <group ref={group}>
      {VESSELS.map((v, i) => (
        <Vessel key={i} idx={i} r={v.r} h={v.h} color={v.color} pulse={pulse} />
      ))}
    </group>
  );
}

export default function ProductionScalesAsset() {
  const [speed, setSpeed] = useState(1);
  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 1.4, 5.2], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 6, 4]} intensity={0.6} />
        <pointLight position={[-3, 2, 3]} intensity={0.4} color={0x88aaff} />
        <Rig speed={speed} />
        <OrbitControls enablePan={false} enableZoom minDistance={3.5} maxDistance={13} target={[0, 0, 0]} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Production scales — bench → pilot → industrial</div>
          <div className="pointer-events-auto inline-flex items-center gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <span className="w-16 text-xs text-slate-400">scale-up</span>
            <input type="range" min={0.2} max={3} step={0.05} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-36 accent-sky-400" />
            <span className="text-[11px] tabular-nums text-slate-500">{speed.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#6cd0ff" }} />bench</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#6affb0" }} />pilot</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#ffc24a" }} />industrial</span>
          </div>
        </div>
      </div>
    </>
  );
}
