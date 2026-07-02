import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import { useAmbient } from "./useAmbient";

/**
 * Asset: diamond vs graphite — same carbon atoms, different arrangement, different world.
 * Toggle between the two structures; hit "push" to feel the difference:
 * diamond barely shivers (rigid 3D cage), graphite's sheets slide (weakly-bound layers).
 */

const CARBON = "#cbd5e1";
const BOND = "#7dd3fc";

/* ---------- structure generation ---------- */

function diamondStructure() {
  const a = 1.6; // lattice constant (scene units)
  const fcc = [
    [0, 0, 0],
    [0, 0.5, 0.5],
    [0.5, 0, 0.5],
    [0.5, 0.5, 0],
  ];
  const atoms: THREE.Vector3[] = [];
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++)
        for (const f of fcc)
          for (const s of [0, 0.25]) {
            const v = new THREE.Vector3((i + f[0] + s) * a, (j + f[1] + s) * a, (k + f[2] + s) * a);
            if (v.length() < 1.75) atoms.push(v);
          }
  // dedupe
  const uniq: THREE.Vector3[] = [];
  for (const v of atoms) if (!uniq.some((u) => u.distanceTo(v) < 0.01)) uniq.push(v);

  const bondLen = (a * Math.sqrt(3)) / 4 + 0.02;
  const bonds: [THREE.Vector3, THREE.Vector3][] = [];
  for (let i = 0; i < uniq.length; i++)
    for (let j = i + 1; j < uniq.length; j++)
      if (uniq[i].distanceTo(uniq[j]) < bondLen) bonds.push([uniq[i], uniq[j]]);
  return { atoms: uniq, bonds };
}

function graphiteLayer(): { atoms: THREE.Vector3[]; bonds: [THREE.Vector3, THREE.Vector3][] } {
  const d = 0.62; // C–C in-plane
  const atoms: THREE.Vector3[] = [];
  // honeycomb: hexagonal lattice, 2-atom basis
  const a1 = new THREE.Vector3(d * 1.5, 0, (d * Math.sqrt(3)) / 2);
  const a2 = new THREE.Vector3(d * 1.5, 0, (-d * Math.sqrt(3)) / 2);
  for (let i = -3; i <= 3; i++)
    for (let j = -3; j <= 3; j++) {
      const base = new THREE.Vector3().addScaledVector(a1, i).addScaledVector(a2, j);
      const p1 = base.clone();
      const p2 = base.clone().add(new THREE.Vector3(d, 0, 0));
      if (p1.length() < 1.7) atoms.push(p1);
      if (p2.length() < 1.7) atoms.push(p2);
    }
  // prune dangling edge atoms (fewer than 2 in-plane neighbors) for clean sheets
  const neighborCount = atoms.map(
    (p) => atoms.filter((q) => q !== p && p.distanceTo(q) < d + 0.02).length,
  );
  const kept = atoms.filter((_, i) => neighborCount[i] >= 2);
  const bonds: [THREE.Vector3, THREE.Vector3][] = [];
  for (let i = 0; i < kept.length; i++)
    for (let j = i + 1; j < kept.length; j++)
      if (kept[i].distanceTo(kept[j]) < d + 0.02) bonds.push([kept[i], kept[j]]);
  return { atoms: kept, bonds };
}

/* ---------- pieces ---------- */

function Atoms({ positions, r = 0.11 }: { positions: THREE.Vector3[]; r?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const obj = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!ref.current) return;
    positions.forEach((p, i) => {
      obj.position.copy(p);
      obj.updateMatrix();
      ref.current!.setMatrixAt(i, obj.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]}>
      <sphereGeometry args={[r, 20, 20]} />
      <meshStandardMaterial color={CARBON} roughness={0.35} metalness={0.15} />
    </instancedMesh>
  );
}

function Bonds({ bonds, opacity = 0.85 }: { bonds: [THREE.Vector3, THREE.Vector3][]; opacity?: number }) {
  return (
    <>
      {bonds.map(([p, q], i) => (
        <Line key={i} points={[p, q]} color={BOND} lineWidth={1.4} transparent opacity={opacity} />
      ))}
    </>
  );
}

function DiamondModel({ pushT }: { pushT: number }) {
  const { atoms, bonds } = useMemo(diamondStructure, []);
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!g.current) return;
    // rigid: the whole cage shivers, nothing internal moves
    const s = Math.sin(pushT * Math.PI * 6) * Math.exp(-pushT * 4) * 0.05;
    g.current.position.x = s;
    g.current.rotation.z = s * 0.4;
  });
  return (
    <group ref={g}>
      <Atoms positions={atoms} />
      <Bonds bonds={bonds} />
    </group>
  );
}

function GraphiteModel({ pushT }: { pushT: number }) {
  const layer = useMemo(graphiteLayer, []);
  const gap = 0.85;
  const refs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  useFrame(() => {
    // layers shear and the top one keeps sliding — soft!
    refs.forEach((r, i) => {
      if (!r.current) return;
      const ease = 1 - Math.exp(-pushT * 3);
      const slide = i === 2 ? ease * 1.7 : i === 1 ? ease * 0.5 : 0;
      r.current.position.x = slide;
    });
  });
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <group key={i} ref={refs[i]} position={[i === 1 ? 0.31 : 0, (i - 1) * gap, 0]}>
          <Atoms positions={layer.atoms} r={0.1} />
          <Bonds bonds={layer.bonds} />
        </group>
      ))}
      {/* faint inter-layer "bonds" to show weakness */}
      {[0, 1].map((i) => (
        <Line
          key={`w${i}`}
          points={[new THREE.Vector3(0, (i - 1) * gap, 0), new THREE.Vector3(i === 0 ? 0.31 : 0, i * gap, 0)]}
          color="#64748b"
          lineWidth={1}
          dashed
          dashSize={0.06}
          gapSize={0.06}
          transparent
          opacity={0.6}
        />
      ))}
    </group>
  );
}

/* ---------- shell ---------- */

export default function DiamondGraphiteAsset() {
  const [which, setWhich] = useState<"diamond" | "graphite">("diamond");
  const [pushT, setPushT] = useState(0);
  const pushing = useRef(false);

  const push = () => {
    pushing.current = true;
    setPushT(0.0001);
  };

  // attract mode: slow orbit + a demo push every few seconds until the reader takes over
  const { ambient, notifyInteraction } = useAmbient();
  useEffect(() => {
    if (!ambient) return;
    const iv = window.setInterval(push, 6500);
    return () => window.clearInterval(iv);
  }, [ambient]);

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [4.6, 3.1, 4.6], fov: 42 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 3]} intensity={1.2} />
        <Ticker pushing={pushing} setPushT={setPushT} />
        {which === "diamond" ? <DiamondModel pushT={pushT} /> : <GraphiteModel pushT={pushT} />}
        <OrbitControls
          enablePan={false}
          minDistance={3}
          maxDistance={10}
          autoRotate={ambient}
          autoRotateSpeed={0.9}
          onStart={notifyInteraction}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end gap-3 pb-6">
        <div className="max-w-lg px-4 text-center text-sm leading-relaxed text-slate-300">
          {which === "diamond" ? (
            <>Every atom locked to four neighbors in a rigid 3D cage — push it and the <em>whole thing</em> barely shivers. That's hardness.</>
          ) : (
            <>Strong honeycomb sheets, feebly stuck to each other — push and the layers <em>slide right off</em>. That's a pencil writing.</>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {(["diamond", "graphite"] as const).map((w) => (
            <button
              key={w}
              onClick={() => {
                notifyInteraction();
                setWhich(w);
                setPushT(0);
                pushing.current = false;
              }}
              className={`rounded-full px-4 py-1.5 text-xs capitalize transition ${
                which === w ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {w}
            </button>
          ))}
          <button
            onClick={() => {
              notifyInteraction();
              push();
            }}
            className="rounded-full bg-sky-400/15 px-4 py-1.5 text-xs text-sky-300 transition hover:bg-sky-400/25"
          >
            push it
          </button>
        </div>
        <div className="text-[11px] text-slate-500">same carbon atoms in both — only the arrangement differs</div>
      </div>
    </>
  );
}

function Ticker({
  pushing,
  setPushT,
}: {
  pushing: React.MutableRefObject<boolean>;
  setPushT: React.Dispatch<React.SetStateAction<number>>;
}) {
  useFrame((_, dt) => {
    if (!pushing.current) return;
    setPushT((t) => {
      const nt = t + dt;
      if (nt > 2.2) {
        pushing.current = false;
        return 0;
      }
      return nt;
    });
  });
  return null;
}
