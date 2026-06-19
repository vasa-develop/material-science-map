import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Characterization (XRD). An X-ray beam strikes a spinning crystal and
 * diffracts into Debye-Scherrer rings on a detector; the 1D diffraction pattern
 * builds alongside. Verb: diffract — turn a physical sample back into data.
 */

const RING_RADII = [0.45, 0.8, 1.15, 1.5];
const RING_COLOR = 0xffb15a;
const DET_Z = -1.9;
const PHOTONS = 12;
const BEAM_X0 = -3.2;

function circlePoints(r: number, n = 96): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function whiteColorAttr(g: THREE.BufferGeometry) {
  const n = g.attributes.position.count;
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return g;
}

function XrdScene({ rate, glow, spin }: { rate: number; glow: number; spin: boolean }) {
  const crystal = useRef<THREE.Group>(null);
  const photonMesh = useRef<THREE.InstancedMesh>(null);
  const ringMats = useRef<THREE.LineBasicMaterial[]>([]);
  const directSpot = useRef<THREE.Mesh>(null);

  // crystal lattice atoms (glow probes)
  const { bases, atomCount } = useMemo(() => {
    const G = 3;
    const sp = 0.3;
    const off = (G - 1) / 2;
    const bases: THREE.Vector3[] = [];
    for (let x = 0; x < G; x++)
      for (let y = 0; y < G; y++)
        for (let z = 0; z < G; z++)
          bases.push(new THREE.Vector3((x - off) * sp, (y - off) * sp, (z - off) * sp));
    return { bases, atomCount: bases.length };
  }, []);

  const coreGeo = useMemo(() => whiteColorAttr(new THREE.SphereGeometry(0.07, 14, 14)), []);
  const haloGeo = useMemo(() => whiteColorAttr(new THREE.SphereGeometry(0.16, 14, 14)), []);
  const atomCore = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x9be7ff }), []);
  const atomHalo = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x6cc8ff,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );
  const coreInst = useRef<THREE.InstancedMesh>(null);
  const haloInst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    for (let i = 0; i < atomCount; i++) {
      dummy.position.copy(bases[i]);
      dummy.updateMatrix();
      coreInst.current?.setMatrixAt(i, dummy.matrix);
      haloInst.current?.setMatrixAt(i, dummy.matrix);
    }
    if (coreInst.current) coreInst.current.instanceMatrix.needsUpdate = true;
    if (haloInst.current) haloInst.current.instanceMatrix.needsUpdate = true;
  }, [bases, atomCount, dummy]);

  const photonGeo = useMemo(() => new THREE.SphereGeometry(0.05, 10, 10), []);
  const photonMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xeaf4ff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );
  const phOff = useMemo(() => Array.from({ length: PHOTONS }, (_, i) => i / PHOTONS), []);
  const phPrev = useRef<number[]>(Array(PHOTONS).fill(0));

  const ringGeos = useMemo(() => RING_RADII.map((r) => circlePoints(r)), []);
  const pulse = useRef(RING_RADII.map(() => 0));

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (crystal.current && spin) {
      crystal.current.rotation.y = t * 0.6;
      crystal.current.rotation.x = Math.sin(t * 0.4) * 0.3;
    }

    // photons travel source -> crystal; on arrival, fire a diffraction pulse
    let hit = 0;
    if (photonMesh.current) {
      for (let i = 0; i < PHOTONS; i++) {
        const u = (t * rate * 0.25 + phOff[i]) % 1;
        if (phPrev.current[i] > 0.92 && u <= 0.92) hit++;
        phPrev.current[i] = u;
        const x = BEAM_X0 * (1 - u);
        dummy.position.set(x, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        photonMesh.current.setMatrixAt(i, dummy.matrix);
      }
      photonMesh.current.instanceMatrix.needsUpdate = true;
    }

    // diffraction-ring pulse cascades outward from the center
    const p = pulse.current;
    if (hit > 0) p[0] = Math.min(2, p[0] + 0.9 * hit);
    for (let k = p.length - 1; k > 0; k--) p[k] += (p[k - 1] - p[k]) * 0.18;
    for (let k = 0; k < p.length; k++) p[k] *= 0.94;
    for (let k = 0; k < ringMats.current.length; k++) {
      const m = ringMats.current[k];
      if (m) m.opacity = Math.min(1, 0.18 + p[k] * glow);
    }
    if (directSpot.current) {
      const mm = directSpot.current.material as THREE.MeshBasicMaterial;
      mm.opacity = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * 6));
    }
  });

  const beamLen = -BEAM_X0;
  return (
    <group>
      {/* incoming X-ray beam */}
      <mesh position={[BEAM_X0 / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, beamLen, 12, 1, true]} />
        <meshBasicMaterial color={0xbcd6ff} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <instancedMesh ref={photonMesh} args={[photonGeo, photonMat, PHOTONS]} />

      {/* spinning crystal sample */}
      <group ref={crystal}>
        <instancedMesh ref={coreInst} args={[coreGeo, atomCore, atomCount]} />
        <instancedMesh ref={haloInst} args={[haloGeo, atomHalo, atomCount]} />
      </group>

      {/* detector with Debye-Scherrer rings */}
      <group position={[0, 0, DET_Z]}>
        <mesh>
          <circleGeometry args={[1.9, 64]} />
          <meshBasicMaterial color={0x0b1020} transparent opacity={0.55} />
        </mesh>
        {ringGeos.map((g, k) => (
          <lineLoop key={k} geometry={g}>
            <lineBasicMaterial
              ref={(m: THREE.LineBasicMaterial | null) => {
                if (m) ringMats.current[k] = m;
              }}
              color={RING_COLOR}
              transparent
              opacity={0.18}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </lineLoop>
        ))}
        {/* direct (undiffracted) beam spot */}
        <mesh ref={directSpot}>
          <circleGeometry args={[0.08, 20]} />
          <meshBasicMaterial color={0xffffff} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function PatternOverlay() {
  // 2θ peak positions roughly tied to the ring radii
  const peaks = [
    { x: 60, h: 70 },
    { x: 104, h: 95 },
    { x: 150, h: 48 },
    { x: 196, h: 62 },
    { x: 232, h: 30 },
  ];
  return (
    <svg width={260} height={130} className="block">
      <line x1={24} y1={108} x2={250} y2={108} stroke="#475569" strokeWidth={1} />
      <line x1={24} y1={12} x2={24} y2={108} stroke="#475569" strokeWidth={1} />
      <text x={20} y={10} fill="#94a3b8" fontSize={9} textAnchor="end">I</text>
      <text x={252} y={120} fill="#94a3b8" fontSize={9} textAnchor="end">2θ</text>
      {peaks.map((p, i) => (
        <line key={i} x1={p.x} y1={108} x2={p.x} y2={108 - p.h} stroke="#ffb15a" strokeWidth={2.5} />
      ))}
    </svg>
  );
}

export default function CharacterizationAsset() {
  const [rate, setRate] = useState(1);
  const [glow, setGlow] = useState(1);
  const [spin, setSpin] = useState(true);
  const [showPattern, setShowPattern] = useState(true);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0.6, 1.0, 4.6], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[2, 3, 3]} intensity={0.5} color={0x88aaff} />
        <XrdScene rate={rate} glow={glow} spin={spin} />
        <OrbitControls enablePan={false} enableZoom minDistance={3} maxDistance={12} target={[0, 0, -0.5]} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Characterization (XRD) — diffract a sample into a pattern</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">beam</span>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.05}
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{rate.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">ring glow</span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={glow}
                onChange={(e) => setGlow(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{glow.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">pattern</span>
              <button className={btn(showPattern)} onClick={() => setShowPattern((s) => !s)}>
                {showPattern ? "on" : "off"}
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

        {showPattern && (
          <div className="absolute bottom-5 right-5 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-3 backdrop-blur-md">
            <div className="mb-1 text-[11px] uppercase tracking-widest text-amber-300/80">diffraction pattern</div>
            <PatternOverlay />
          </div>
        )}
      </div>
    </>
  );
}
