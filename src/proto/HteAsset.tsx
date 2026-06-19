import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: High-Throughput Experimentation. A combinatorial well-plate whose
 * samples form a 2D composition gradient; a measurement wave sweeps across and
 * each well flares as it's read out in parallel. A few "hit" compositions flare
 * brighter and keep glowing. Verb: screen a whole library at once, find hits.
 */

const GX = 12;
const GZ = 8;
const SP = 0.34;
const TOTAL = GX * GZ;

const CORNERS = [
  new THREE.Color(0xff5a5a), // u0 v0
  new THREE.Color(0xffd24a), // u1 v0
  new THREE.Color(0x5fd0ff), // u0 v1
  new THREE.Color(0xb98cff), // u1 v1
];

function Plate({ speed, spin }: { speed: number; spin: boolean }) {
  const group = useRef<THREE.Group>(null);
  const sampleInst = useRef<THREE.InstancedMesh>(null);
  const haloInst = useRef<THREE.InstancedMesh>(null);
  const cupInst = useRef<THREE.InstancedMesh>(null);
  const scanBar = useRef<THREE.Mesh>(null);
  const scanMat = useRef<THREE.MeshBasicMaterial>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scratch = useMemo(() => new THREE.Color(), []);
  const glow = useRef<Float32Array>(new Float32Array(TOTAL));

  const wells = useMemo(() => {
    const ox = ((GX - 1) * SP) / 2;
    const oz = ((GZ - 1) * SP) / 2;
    const arr: { x: number; z: number; proj: number; base: THREE.Color; hit: boolean }[] = [];
    for (let i = 0; i < GX; i++)
      for (let j = 0; j < GZ; j++) {
        const u = i / (GX - 1);
        const v = j / (GZ - 1);
        // bilinear blend of the four corner compositions
        const top = CORNERS[0].clone().lerp(CORNERS[1], u);
        const bot = CORNERS[2].clone().lerp(CORNERS[3], u);
        const base = top.lerp(bot, v);
        arr.push({ x: i * SP - ox, z: j * SP - oz, proj: u, base, hit: false });
      }
    // mark a handful of hit compositions
    const hitIdx = [18, 31, 44, 57, 70, 83];
    hitIdx.forEach((k) => arr[k % TOTAL] && (arr[k % TOTAL].hit = true));
    return arr;
  }, []);

  const cupGeo = useMemo(() => new THREE.CylinderGeometry(0.13, 0.13, 0.08, 18), []);
  const cupMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x10151f, roughness: 0.7, metalness: 0.4 }), []);
  const sampleGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.1, 0.1, 0.12, 18);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    return g;
  }, []);
  const sampleMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true }), []);
  const haloGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.16, 12, 12);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    return g;
  }, []);
  const haloMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }), []);

  useLayoutEffect(() => {
    for (let k = 0; k < TOTAL; k++) {
      const w = wells[k];
      dummy.position.set(w.x, 0.02, w.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cupInst.current?.setMatrixAt(k, dummy.matrix);
      sampleInst.current?.setColorAt(k, w.base);
      haloInst.current?.setColorAt(k, w.base);
    }
    if (cupInst.current) cupInst.current.instanceMatrix.needsUpdate = true;
    if (sampleInst.current?.instanceColor) sampleInst.current.instanceColor.needsUpdate = true;
    if (haloInst.current?.instanceColor) haloInst.current.instanceColor.needsUpdate = true;
  }, [wells, dummy]);

  const plateW = GX * SP + 0.3;
  const plateD = GZ * SP + 0.3;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!sampleInst.current || !haloInst.current) return;
    const sw = (t * speed * 0.18) % 1.35; // sweep position (with a gap before repeat)
    const sigma = 0.012;

    for (let k = 0; k < TOTAL; k++) {
      const w = wells[k];
      const d = w.proj - sw;
      const act = Math.exp(-(d * d) / sigma);
      let g = act;
      if (w.hit) g = Math.max(glow.current[k] * 0.985, act); // hits linger
      glow.current[k] = g;

      const shimmer = 0.04 * Math.sin(t * 2 + k);
      const bright = 0.34 + shimmer + g * 0.95;
      scratch.copy(w.base).multiplyScalar(Math.min(1, bright));
      if (g > 0.4) scratch.lerp(new THREE.Color(0xffffff), (g - 0.4) * 0.5);
      sampleInst.current.setColorAt(k, scratch);

      const rise = 1 + g * (w.hit ? 2.4 : 1.1);
      dummy.position.set(w.x, 0.06 + g * (w.hit ? 0.18 : 0.06), w.z);
      dummy.scale.set(1, rise, 1);
      dummy.updateMatrix();
      sampleInst.current.setMatrixAt(k, dummy.matrix);

      // halo
      scratch.copy(w.base).multiplyScalar(g * (w.hit ? 1.3 : 0.9));
      haloInst.current.setColorAt(k, scratch);
      const hs = 0.4 + g * (w.hit ? 1.4 : 0.8);
      dummy.position.set(w.x, 0.1, w.z);
      dummy.scale.setScalar(hs);
      dummy.updateMatrix();
      haloInst.current.setMatrixAt(k, dummy.matrix);
    }
    sampleInst.current.instanceMatrix.needsUpdate = true;
    sampleInst.current.instanceColor!.needsUpdate = true;
    haloInst.current.instanceMatrix.needsUpdate = true;
    haloInst.current.instanceColor!.needsUpdate = true;

    // scan bar
    if (scanBar.current && scanMat.current) {
      const inRange = sw <= 1.001;
      const x = (sw - 0.5) * (GX - 1) * SP;
      scanBar.current.position.x = x;
      scanBar.current.visible = inRange;
      scanMat.current.opacity = inRange ? 0.5 + 0.3 * Math.sin(t * 8) : 0;
    }

    if (group.current && spin) group.current.rotation.y = t * 0.12;
  });

  return (
    <group ref={group} rotation={[-0.35, 0, 0]}>
      {/* plate body */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[plateW, 0.16, plateD]} />
        <meshStandardMaterial color={0x161d2b} roughness={0.6} metalness={0.5} />
      </mesh>

      <instancedMesh ref={cupInst} args={[cupGeo, cupMat, TOTAL]} />
      <instancedMesh ref={sampleInst} args={[sampleGeo, sampleMat, TOTAL]} />
      <instancedMesh ref={haloInst} args={[haloGeo, haloMat, TOTAL]} />

      {/* sweeping scan bar */}
      <mesh ref={scanBar} position={[0, 0.18, 0]}>
        <boxGeometry args={[0.03, 0.36, GZ * SP + 0.2]} />
        <meshBasicMaterial ref={scanMat} color={0x8fe6ff} transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export default function HteAsset() {
  const [speed, setSpeed] = useState(1);
  const [spin, setSpin] = useState(true);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 3.0, 3.4], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 6, 4]} intensity={0.7} />
        <pointLight position={[-3, 3, -2]} intensity={0.4} color={0x88aaff} />
        <Plate speed={speed} spin={spin} />
        <OrbitControls enablePan={false} enableZoom minDistance={2.5} maxDistance={11} target={[0, 0, 0]} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">High-throughput experimentation — sweep a composition library</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-400">sweep</span>
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
