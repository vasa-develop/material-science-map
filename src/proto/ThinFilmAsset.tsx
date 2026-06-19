import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Precision synthesis (thin-film / CVD). Precursor vapor rains onto a
 * substrate and snaps into an ordered film, layer by layer; once a film is
 * grown it resets and deposition begins again. Cool plasma palette to contrast
 * the warm bulk crucible. Verb: deposit atom-by-atom, grow epitaxial layers.
 */

const GRID = 5; // sites per side
const LAYERS = 4;
const SP = 0.26; // lattice spacing
const SUB_Y = -0.55; // substrate top
const SPECIES = [0x6cc8ff, 0xb98cff]; // alternating, cool palette
const VAPOR = 90;

const smoother = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * c * (c * (c * 6 - 15) + 10);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function Chamber({ speed, spin }: { speed: number; spin: boolean }) {
  const group = useRef<THREE.Group>(null);
  const filmInst = useRef<THREE.InstancedMesh>(null);
  const haloInst = useRef<THREE.InstancedMesh>(null);
  const vapor = useRef<THREE.Points>(null);
  const plasmaMat = useRef<THREE.MeshBasicMaterial>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // film sites, ordered bottom layer first so the film grows upward
  const sites = useMemo(() => {
    const off = (GRID - 1) / 2;
    const arr: { pos: THREE.Vector3; start: THREE.Vector3; order: number; col: THREE.Color }[] = [];
    let order = 0;
    for (let ly = 0; ly < LAYERS; ly++)
      for (let x = 0; x < GRID; x++)
        for (let z = 0; z < GRID; z++) {
          const pos = new THREE.Vector3((x - off) * SP, SUB_Y + 0.13 + ly * SP, (z - off) * SP);
          const start = new THREE.Vector3((Math.random() - 0.5) * 1.6, 1.8 + Math.random() * 0.8, (Math.random() - 0.5) * 1.6);
          arr.push({ pos, start, order: order++, col: new THREE.Color(SPECIES[(x + z + ly) % 2]) });
        }
    return arr;
  }, []);
  const total = sites.length;

  const coreGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.085, 14, 14);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    return g;
  }, []);
  const haloGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.16, 12, 12);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    return g;
  }, []);
  const coreMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.15, emissive: 0x101a2a, emissiveIntensity: 0.5 }), []);
  const haloMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }), []);

  // precursor vapor drifting down
  const vaporState = useMemo(
    () => Array.from({ length: VAPOR }, () => ({ x: (Math.random() - 0.5) * 2, y: Math.random() * 2.2 - 0.3, z: (Math.random() - 0.5) * 2, vy: 0.2 + Math.random() * 0.4 })),
    []
  );
  const vaporPos = useMemo(() => new Float32Array(VAPOR * 3), []);
  const vaporGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(vaporPos, 3));
    return g;
  }, [vaporPos]);
  const vaporMat = useMemo(() => new THREE.PointsMaterial({ color: 0x8fd6ff, size: 0.04, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), []);

  useLayoutEffect(() => {
    for (let i = 0; i < total; i++) {
      filmInst.current?.setColorAt(i, sites[i].col);
      haloInst.current?.setColorAt(i, sites[i].col);
    }
    if (filmInst.current?.instanceColor) filmInst.current.instanceColor.needsUpdate = true;
    if (haloInst.current?.instanceColor) haloInst.current.instanceColor.needsUpdate = true;
  }, [sites, total]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const cycle = (t * speed * 0.08) % 1; // full film grows over one cycle
    const travel = 0.16; // fraction of cycle one atom takes to land

    if (filmInst.current && haloInst.current) {
      for (let i = 0; i < total; i++) {
        const s = sites[i];
        const delay = (s.order / total) * 0.82;
        const p = smoother(clamp01((cycle - delay) / travel));
        const x = s.start.x + (s.pos.x - s.start.x) * p;
        const y = s.start.y + (s.pos.y - s.start.y) * p;
        const z = s.start.z + (s.pos.z - s.start.z) * p;
        dummy.position.set(x, y, z);
        const sc = p < 0.02 ? 0.0001 : 0.6 + 0.4 * p;
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        filmInst.current.setMatrixAt(i, dummy.matrix);
        haloInst.current.setMatrixAt(i, dummy.matrix);
      }
      filmInst.current.instanceMatrix.needsUpdate = true;
      haloInst.current.instanceMatrix.needsUpdate = true;
    }

    if (vapor.current) {
      for (let i = 0; i < VAPOR; i++) {
        const v = vaporState[i];
        v.y -= v.vy * dt * (0.5 + speed * 0.5);
        if (v.y < SUB_Y + 0.1) {
          v.x = (Math.random() - 0.5) * 2;
          v.z = (Math.random() - 0.5) * 2;
          v.y = 2.0 + Math.random() * 0.6;
          v.vy = 0.2 + Math.random() * 0.4;
        }
        vaporPos[i * 3] = v.x;
        vaporPos[i * 3 + 1] = v.y;
        vaporPos[i * 3 + 2] = v.z;
      }
      vaporGeo.attributes.position.needsUpdate = true;
    }

    if (plasmaMat.current) plasmaMat.current.opacity = 0.12 + 0.06 * (0.5 + 0.5 * Math.sin(t * 2));
    if (group.current && spin) group.current.rotation.y = t * 0.3;
  });

  return (
    <group ref={group}>
      {/* substrate */}
      <mesh position={[0, SUB_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.1, 56]} />
        <meshStandardMaterial color={0x1a2233} roughness={0.5} metalness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, SUB_Y - 0.06, 0]}>
        <cylinderGeometry args={[1.1, 1.0, 0.12, 56]} />
        <meshStandardMaterial color={0x121a28} roughness={0.7} metalness={0.5} />
      </mesh>
      {/* substrate glow ring */}
      <mesh position={[0, SUB_Y + 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.1, 0.02, 12, 64]} />
        <meshBasicMaterial color={0x4aa6ff} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* plasma haze above the substrate */}
      <mesh position={[0, SUB_Y + 0.9, 0]}>
        <cylinderGeometry args={[1.0, 0.7, 1.8, 40, 1, true]} />
        <meshBasicMaterial ref={plasmaMat} color={0x6cb6ff} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <points ref={vapor} geometry={vaporGeo} material={vaporMat} />
      <instancedMesh ref={filmInst} args={[coreGeo, coreMat, total]} />
      <instancedMesh ref={haloInst} args={[haloGeo, haloMat, total]} />
    </group>
  );
}

export default function ThinFilmAsset() {
  const [speed, setSpeed] = useState(1);
  const [spin, setSpin] = useState(true);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [2.2, 1.4, 3.0], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 3]} intensity={0.7} />
        <pointLight position={[-3, 2, -2]} intensity={0.4} color={0x88aaff} />
        <Chamber speed={speed} spin={spin} />
        <OrbitControls enablePan={false} enableZoom minDistance={2} maxDistance={10} target={[0, 0, 0]} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Precision synthesis — thin-film / CVD: deposit layer by layer</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-400">rate</span>
              <input type="range" min={0.2} max={3} step={0.05} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-36 accent-sky-400" />
              <span className="text-[11px] tabular-nums text-slate-500">{speed.toFixed(2)}</span>
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
