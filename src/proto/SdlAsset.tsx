import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Self-driving lab — the autonomous experiment loop that closes the map.
 * A pulse runs the propose -> make -> measure -> learn ring while a robotic arm
 * tracks it and dips at each station, carrying a sample whose color converges
 * as the optimizer "learns". Verb: cycle the loop, optimize.
 */

const R = 2.0; // loop radius
const RING_Y = 0.0;
const ARM_H = 1.55; // shoulder height
const TARGET_HUE = 0.34; // the "good" outcome the optimizer drives toward

type IconKind = "propose" | "make" | "measure" | "learn";
const STATIONS: { ang: number; name: string; color: number; icon: IconKind }[] = [
  { ang: 0, name: "PROPOSE", color: 0x9a6bff, icon: "propose" },
  { ang: Math.PI / 2, name: "MAKE", color: 0xffb24a, icon: "make" },
  { ang: Math.PI, name: "MEASURE", color: 0x5fd0ff, icon: "measure" },
  { ang: (3 * Math.PI) / 2, name: "LEARN", color: 0x5fe089, icon: "learn" },
];

const TAU = Math.PI * 2;
const angDist = (a: number, b: number) => {
  let d = Math.abs(a - b) % TAU;
  if (d > Math.PI) d = TAU - d;
  return d;
};

function labelTexture(text: string): THREE.Texture {
  const w = 256;
  const h = 64;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 10;
  ctx.font = "bold 34px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

function StationIcon({ kind, color }: { kind: IconKind; color: number }) {
  const mat = (
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.4} metalness={0.2} />
  );
  if (kind === "propose")
    return (
      <mesh>
        <icosahedronGeometry args={[0.19, 0]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.9} />
      </mesh>
    );
  if (kind === "make")
    return (
      <mesh>
        <coneGeometry args={[0.16, 0.32, 4]} />
        {mat}
      </mesh>
    );
  if (kind === "measure")
    return (
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.05, 12, 28]} />
        {mat}
      </mesh>
    );
  return (
    <mesh>
      <octahedronGeometry args={[0.2, 0]} />
      {mat}
    </mesh>
  );
}

function Station({
  station,
  matRef,
  iconRef,
  showLabel,
}: {
  station: (typeof STATIONS)[number];
  matRef: (m: THREE.MeshStandardMaterial | null) => void;
  iconRef: (g: THREE.Group | null) => void;
  showLabel: boolean;
}) {
  const x = Math.cos(station.ang) * R;
  const z = Math.sin(station.ang) * R;
  const tex = useMemo(() => labelTexture(station.name), [station.name]);
  const tint = useMemo(() => new THREE.Color(station.color).lerp(new THREE.Color(0xffffff), 0.4), [station.color]);
  return (
    <group position={[x, RING_Y, z]}>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.32, 0.36, 0.18, 24]} />
        <meshStandardMaterial
          ref={matRef}
          color={0x141a2a}
          emissive={station.color}
          emissiveIntensity={0.3}
          roughness={0.6}
          metalness={0.3}
        />
      </mesh>
      <group ref={iconRef} position={[0, 0.5, 0]}>
        <StationIcon kind={station.icon} color={station.color} />
      </group>
      {showLabel && (
        <sprite position={[0, 0.95, 0]} scale={[1.1, 0.275, 1]}>
          <spriteMaterial map={tex} transparent depthWrite={false} color={tint} />
        </sprite>
      )}
    </group>
  );
}

function SdlScene({ speed, showLabel }: { speed: number; showLabel: boolean }) {
  const column = useRef<THREE.Group>(null);
  const forearm = useRef<THREE.Mesh>(null);
  const gripper = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Group>(null);
  const sampleLiquid = useRef<THREE.MeshStandardMaterial>(null);
  const sampleGlow = useRef<THREE.MeshBasicMaterial>(null);
  const stationMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const stationIcons = useRef<THREE.Group[]>([]);

  const ringGeo = useMemo(() => new THREE.TorusGeometry(R, 0.028, 12, 140), []);

  // loop / learning state
  const prevP = useRef(0);
  const curHue = useRef(Math.random());
  const dispHue = useRef(curHue.current);
  const loops = useRef(0);
  const converged = useRef(false);
  const tmpCol = useMemo(() => new THREE.Color(), []);

  const BASE_FL = 0.95; // forearm length

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const p = (t * speed * 0.12) % 1;
    const a = p * TAU;

    // loop completed -> step the optimizer
    if (p < prevP.current) {
      loops.current++;
      if (converged.current) {
        // explore again from a fresh guess
        curHue.current = Math.random();
        converged.current = false;
      } else {
        let d = TARGET_HUE - curHue.current;
        curHue.current += d * 0.45;
        if (Math.abs(TARGET_HUE - curHue.current) < 0.015) {
          curHue.current = TARGET_HUE;
          converged.current = true;
        }
      }
    }
    prevP.current = p;
    dispHue.current += (curHue.current - dispHue.current) * Math.min(1, dt * 3);

    // pulse travels the ring
    if (pulse.current) pulse.current.position.set(Math.cos(a) * R, RING_Y, Math.sin(a) * R);

    // arm tracks the pulse; forearm dips near each station
    let dip = 0;
    for (let i = 0; i < STATIONS.length; i++) {
      const dd = angDist(a, STATIONS[i].ang);
      const flare = Math.exp(-(dd * dd) / 0.05);
      dip = Math.max(dip, flare);
      const m = stationMats.current[i];
      if (m) m.emissiveIntensity = 0.3 + flare * 1.7;
      const ic = stationIcons.current[i];
      if (ic) {
        ic.rotation.y = t * 0.8 + i;
        ic.position.y = 0.5 + 0.05 * Math.sin(t * 2 + i) + flare * 0.12;
        ic.scale.setScalar(1 + flare * 0.25);
      }
    }

    if (column.current) column.current.rotation.y = -a;
    const flLen = BASE_FL + dip * 0.5;
    if (forearm.current) {
      forearm.current.scale.y = flLen;
      forearm.current.position.y = -flLen / 2;
    }
    if (gripper.current) gripper.current.position.y = -flLen;

    // sample color = current learned hue; brighter + steady once converged
    const sat = 0.85;
    const light = converged.current ? 0.62 + 0.06 * Math.sin(t * 6) : 0.5;
    tmpCol.setHSL(dispHue.current % 1, sat, light);
    if (sampleLiquid.current) {
      sampleLiquid.current.color.copy(tmpCol);
      sampleLiquid.current.emissive.copy(tmpCol);
      sampleLiquid.current.emissiveIntensity = converged.current ? 1.4 : 0.7;
    }
    if (sampleGlow.current) sampleGlow.current.opacity = converged.current ? 0.6 : 0.3;
  });

  return (
    <group>
      {/* loop ring */}
      <mesh geometry={ringGeo} rotation={[Math.PI / 2, 0, 0]} position={[0, RING_Y, 0]}>
        <meshBasicMaterial color={0x4aa6ff} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* traveling pulse */}
      <group ref={pulse}>
        <mesh>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshBasicMaterial color={0x9fe0ff} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      {/* stations */}
      {STATIONS.map((s, i) => (
        <Station
          key={s.name}
          station={s}
          showLabel={showLabel}
          matRef={(m) => {
            if (m) stationMats.current[i] = m;
          }}
          iconRef={(g) => {
            if (g) stationIcons.current[i] = g;
          }}
        />
      ))}

      {/* robotic arm */}
      <group ref={column}>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.32, 0.4, 0.2, 28]} />
          <meshStandardMaterial color={0x2a3550} roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh position={[0, ARM_H / 2, 0]}>
          <cylinderGeometry args={[0.11, 0.13, ARM_H, 20]} />
          <meshStandardMaterial color={0x3a466a} roughness={0.45} metalness={0.6} />
        </mesh>
        {/* shoulder + upper arm reaching out to the ring */}
        <group position={[0, ARM_H, 0]}>
          <mesh>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial color={0x55c8ff} emissive={0x1f6fa0} emissiveIntensity={0.5} roughness={0.4} metalness={0.4} />
          </mesh>
          <mesh position={[R / 2, 0, 0]}>
            <boxGeometry args={[R, 0.13, 0.16]} />
            <meshStandardMaterial color={0x3a466a} roughness={0.45} metalness={0.6} />
          </mesh>
          {/* elbow at the ring radius */}
          <group position={[R, 0, 0]}>
            <mesh>
              <sphereGeometry args={[0.11, 14, 14]} />
              <meshStandardMaterial color={0x55c8ff} emissive={0x1f6fa0} emissiveIntensity={0.5} roughness={0.4} metalness={0.4} />
            </mesh>
            <mesh ref={forearm} position={[0, -BASE_FL / 2, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 1, 14]} />
              <meshStandardMaterial color={0x6a7790} roughness={0.4} metalness={0.6} />
            </mesh>
            {/* gripper + carried sample vial */}
            <group ref={gripper} position={[0, -BASE_FL, 0]}>
              <mesh position={[0.08, 0.05, 0]}>
                <boxGeometry args={[0.04, 0.16, 0.1]} />
                <meshStandardMaterial color={0x8a97b0} roughness={0.4} metalness={0.6} />
              </mesh>
              <mesh position={[-0.08, 0.05, 0]}>
                <boxGeometry args={[0.04, 0.16, 0.1]} />
                <meshStandardMaterial color={0x8a97b0} roughness={0.4} metalness={0.6} />
              </mesh>
              <mesh position={[0, -0.12, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 0.34, 18, 1, true]} />
                <meshStandardMaterial color={0xbfe6ff} transparent opacity={0.25} roughness={0.1} metalness={0} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, -0.15, 0]}>
                <cylinderGeometry args={[0.075, 0.075, 0.22, 16]} />
                <meshStandardMaterial ref={sampleLiquid} color={0xffffff} emissive={0xffffff} emissiveIntensity={0.7} roughness={0.3} />
              </mesh>
              <mesh position={[0, -0.15, 0]}>
                <sphereGeometry args={[0.2, 16, 16]} />
                <meshBasicMaterial ref={sampleGlow} color={0xffffff} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

/** Content only (no lights/camera), for embedding as a node in the shared city. */
export function SdlMapScene() {
  return <SdlScene speed={1} showLabel />;
}

export default function SdlAsset() {
  const [speed, setSpeed] = useState(1);
  const [spin, setSpin] = useState(true);
  const [showLabel, setShowLabel] = useState(true);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [3.6, 3.4, 3.8], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 3]} intensity={0.8} />
        <pointLight position={[-4, 2, -3]} intensity={0.4} color={0x88aaff} />
        <SdlScene speed={speed} showLabel={showLabel} />
        <OrbitControls enablePan={false} enableZoom autoRotate={spin} autoRotateSpeed={0.8} minDistance={3} maxDistance={16} target={[0, 0.4, 0]} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Self-driving lab — propose → make → measure → learn</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-400">speed</span>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{speed.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-400">labels</span>
              <button className={btn(showLabel)} onClick={() => setShowLabel((s) => !s)}>
                {showLabel ? "on" : "off"}
              </button>
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
