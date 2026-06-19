import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Bulk synthesis (solid-state / forge). A glowing crucible holds a
 * swirling molten pool throwing off embers; a crystal grows inside, then cools
 * from white-hot amber to a solid phase before the melt reclaims it and the
 * cycle repeats. Verb: melt, grow, cool. Warm palette to contrast discovery.
 */

const POOL_Y = 0.32;
const EMBERS = 150;

const smoother = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * c * (c * (c * 6 - 15) + 10);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function Crucible({ heat, speed, spin }: { heat: number; speed: number; spin: boolean }) {
  const group = useRef<THREE.Group>(null);
  const poolMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const rimMat = useRef<THREE.MeshStandardMaterial>(null);
  const crystal = useRef<THREE.Mesh>(null);
  const crystalMat = useRef<THREE.MeshStandardMaterial>(null);
  const blobs = useRef<THREE.InstancedMesh>(null);
  const embers = useRef<THREE.Points>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  // swirling molten blobs on the pool surface
  const NB = 18;
  const blobParams = useMemo(
    () =>
      Array.from({ length: NB }, () => ({
        r: 0.12 + Math.random() * 0.6,
        a: Math.random() * Math.PI * 2,
        w: 0.4 + Math.random() * 0.9,
        s: 0.06 + Math.random() * 0.12,
        ph: Math.random() * 6.28,
      })),
    []
  );
  const blobGeo = useMemo(() => new THREE.SphereGeometry(1, 12, 12), []);
  const blobMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    []
  );

  // rising embers
  const emberState = useMemo(
    () =>
      Array.from({ length: EMBERS }, () => ({
        a: Math.random() * Math.PI * 2,
        r: Math.random() * 0.7,
        y: POOL_Y + Math.random() * 1.4,
        vy: 0.15 + Math.random() * 0.4,
        life: Math.random(),
      })),
    []
  );
  const emberPos = useMemo(() => new Float32Array(EMBERS * 3), []);
  const emberGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
    return g;
  }, [emberPos]);
  const emberMat = useMemo(
    () => new THREE.PointsMaterial({ color: 0xffb24a, size: 0.06, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    []
  );

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const phase = (t * speed * 0.18) % 1; // melt -> grow -> cool cycle
    const hb = 0.6 + 0.4 * Math.sin(t * 2.2); // heat beat

    // molten pool brightness
    if (poolMat.current) {
      tmp.setHSL(0.08, 1, 0.45 + 0.18 * hb * heat);
      poolMat.current.color.copy(tmp);
      poolMat.current.opacity = 0.85;
    }
    if (glowMat.current) glowMat.current.opacity = (0.18 + 0.12 * hb) * heat;
    if (rimMat.current) rimMat.current.emissiveIntensity = (0.8 + 0.5 * hb) * heat;

    // swirling blobs
    if (blobs.current) {
      for (let i = 0; i < NB; i++) {
        const b = blobParams[i];
        const ang = b.a + t * b.w * speed;
        const rr = b.r * (0.85 + 0.15 * Math.sin(t * 1.3 + b.ph));
        const x = Math.cos(ang) * rr;
        const z = Math.sin(ang) * rr;
        dummy.position.set(x, POOL_Y + 0.02 + 0.03 * Math.sin(t * 3 + b.ph), z);
        const sc = b.s * (0.8 + 0.4 * Math.sin(t * 4 + b.ph)) * (0.6 + 0.4 * heat);
        dummy.scale.set(sc, sc * 0.4, sc);
        dummy.updateMatrix();
        blobs.current.setMatrixAt(i, dummy.matrix);
      }
      blobs.current.instanceMatrix.needsUpdate = true;
    }

    // embers
    if (embers.current) {
      for (let i = 0; i < EMBERS; i++) {
        const e = emberState[i];
        e.y += e.vy * dt * (0.6 + heat);
        e.life -= dt * 0.4;
        if (e.life <= 0 || e.y > 2.0) {
          e.a = Math.random() * Math.PI * 2;
          e.r = Math.random() * 0.7;
          e.y = POOL_Y;
          e.vy = 0.15 + Math.random() * 0.4;
          e.life = 0.6 + Math.random() * 0.6;
        }
        const sway = Math.sin(t * 1.5 + i) * 0.05 * (e.y - POOL_Y);
        emberPos[i * 3] = Math.cos(e.a) * e.r + sway;
        emberPos[i * 3 + 1] = e.y;
        emberPos[i * 3 + 2] = Math.sin(e.a) * e.r;
      }
      emberGeo.attributes.position.needsUpdate = true;
      emberMat.opacity = 0.5 + 0.4 * heat;
    }

    // crystal: grows while hot, then cools to a solid phase, then remelts
    if (crystal.current && crystalMat.current) {
      const grow = smoother(clamp01((phase - 0.35) / 0.35));
      const remelt = smoother(clamp01((phase - 0.9) / 0.1));
      const sc = grow * (1 - remelt);
      crystal.current.scale.setScalar(0.0001 + sc * 0.42);
      crystal.current.rotation.y = t * 0.5;
      crystal.current.rotation.x = Math.sin(t * 0.3) * 0.3;
      crystal.current.position.y = POOL_Y + 0.18 + sc * 0.1;
      // hot amber while forming -> cool teal once solidified
      const cool = smoother(clamp01((phase - 0.7) / 0.2));
      tmp.setHSL(0.09 + cool * 0.38, 0.85, 0.55 - cool * 0.08);
      crystalMat.current.color.copy(tmp);
      crystalMat.current.emissive.copy(tmp);
      crystalMat.current.emissiveIntensity = 1.2 - cool * 0.8;
    }

    if (group.current && spin) group.current.rotation.y = t * 0.25;
  });

  return (
    <group ref={group}>
      {/* crucible body */}
      <mesh>
        <cylinderGeometry args={[0.92, 0.6, 1.0, 44, 1, true]} />
        <meshStandardMaterial color={0x241f1b} roughness={0.8} metalness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <circleGeometry args={[0.6, 40]} />
        <meshStandardMaterial color={0x1a1613} roughness={0.9} metalness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* hot rim */}
      <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.92, 0.05, 16, 48]} />
        <meshStandardMaterial ref={rimMat} color={0xff8a3a} emissive={0xff7a2a} emissiveIntensity={1} roughness={0.5} />
      </mesh>

      {/* molten pool */}
      <mesh position={[0, POOL_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.84, 48]} />
        <meshBasicMaterial ref={poolMat} color={0xffb24a} transparent opacity={0.85} />
      </mesh>
      <instancedMesh ref={blobs} args={[blobGeo, blobMat, NB]} />
      {/* heat glow */}
      <mesh position={[0, POOL_Y + 0.3, 0]}>
        <sphereGeometry args={[0.9, 20, 20]} />
        <meshBasicMaterial ref={glowMat} color={0xff9a3a} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* growing crystal */}
      <mesh ref={crystal} position={[0, POOL_Y + 0.18, 0]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial ref={crystalMat} color={0xffb24a} emissive={0xffb24a} emissiveIntensity={1.2} roughness={0.25} metalness={0.2} flatShading />
      </mesh>

      <points ref={embers} geometry={emberGeo} material={emberMat} />
    </group>
  );
}

export default function CrucibleAsset() {
  const [heat, setHeat] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [spin, setSpin] = useState(true);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [2.2, 1.7, 3.0], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#08060a"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 2]} intensity={0.5} />
        <pointLight position={[0, 0.6, 0]} intensity={1.2} color={0xff8a3a} distance={6} />
        <Crucible heat={heat} speed={speed} spin={spin} />
        <OrbitControls enablePan={false} enableZoom minDistance={2} maxDistance={10} target={[0, 0.3, 0]} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Bulk synthesis — crucible: melt → grow → cool</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-400">heat</span>
              <input type="range" min={0.2} max={1.6} step={0.05} value={heat} onChange={(e) => setHeat(parseFloat(e.target.value))} className="w-36 accent-amber-400" />
              <span className="text-[11px] tabular-nums text-slate-500">{heat.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-400">cycle</span>
              <input type="range" min={0.2} max={3} step={0.05} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-36 accent-amber-400" />
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
