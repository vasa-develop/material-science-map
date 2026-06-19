import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Characterization (XRD) — Debye-Scherrer powder camera. An X-ray beam
 * enters through a gap in the cylindrical film, strikes a glowing powder
 * sample, and diffracts into colored cones whose rims land as rings on the
 * film. The whole rig can orbit for a 360 view. Verb: diffract sample -> data.
 */

const FILM_R = 3.3;
const GAP = 0.13; // half-angle of the entrance/exit holes
const BEAM_X = 4.6;
const PHOTONS = 14;

// Debye-Scherrer cones: {half-angle (deg from beam axis), color, dir (+1 fwd / -1 back)}
const CONES: { half: number; color: number; dir: 1 | -1 }[] = [
  { half: 24, color: 0x4aa8ff, dir: -1 },
  { half: 47, color: 0xffd24a, dir: 1 },
  { half: 67, color: 0x5fe089, dir: 1 },
  { half: 82, color: 0xff7fd0, dir: 1 },
];

function ringInYZ(r: number, n = 96): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(0, Math.sin(a) * r, Math.cos(a) * r));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function whiteColorAttr(g: THREE.BufferGeometry) {
  const n = g.attributes.position.count;
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return g;
}

function XrdScene({
  rate,
  glowFreq,
  sample,
  filmOpacity,
  sampleSize,
  filmWidth,
}: {
  rate: number;
  glowFreq: number;
  sample: "lattice" | "chunk";
  filmOpacity: number;
  sampleSize: number;
  filmWidth: number;
}) {
  const crystal = useRef<THREE.Group>(null);
  const photonMesh = useRef<THREE.InstancedMesh>(null);
  const coneMats = useRef<THREE.MeshBasicMaterial[]>([]);
  const rimMats = useRef<THREE.LineBasicMaterial[]>([]);

  // powder sample: a little cluster of glow-probe atoms
  const { bases, atomCount } = useMemo(() => {
    const G = 3;
    const sp = 0.26;
    const off = (G - 1) / 2;
    const bases: THREE.Vector3[] = [];
    for (let x = 0; x < G; x++)
      for (let y = 0; y < G; y++)
        for (let z = 0; z < G; z++)
          bases.push(new THREE.Vector3((x - off) * sp, (y - off) * sp, (z - off) * sp));
    return { bases, atomCount: bases.length };
  }, []);

  const coreGeo = useMemo(() => whiteColorAttr(new THREE.SphereGeometry(0.07, 14, 14)), []);
  const haloGeo = useMemo(() => whiteColorAttr(new THREE.SphereGeometry(0.17, 14, 14)), []);
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

  // cohesive chunk: small faceted blocks packed into a rough sphere
  const blocks = useMemo(() => {
    const out: { p: THREE.Vector3; s: number; rx: number; ry: number; rz: number }[] = [];
    const N = 42;
    let seed = 7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < N; i++) {
      // random point in a sphere, biased outward so the cluster reads as a solid blob
      const u = rnd() * 2 - 1;
      const phi = rnd() * Math.PI * 2;
      const sp = Math.sqrt(1 - u * u);
      const r = 0.42 * Math.cbrt(rnd());
      out.push({
        p: new THREE.Vector3(r * sp * Math.cos(phi), r * sp * Math.sin(phi), r * u),
        s: 0.1 + rnd() * 0.14,
        rx: rnd() * Math.PI,
        ry: rnd() * Math.PI,
        rz: rnd() * Math.PI,
      });
    }
    return out;
  }, []);
  const blockGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const blockMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xc6efe0,
        flatShading: true,
        roughness: 0.45,
        metalness: 0.06,
        emissive: 0x2f6f5a,
        emissiveIntensity: 0.3,
      }),
    []
  );
  const blockInst = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    for (let i = 0; i < atomCount; i++) {
      dummy.position.copy(bases[i]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      coreInst.current?.setMatrixAt(i, dummy.matrix);
      haloInst.current?.setMatrixAt(i, dummy.matrix);
    }
    if (coreInst.current) coreInst.current.instanceMatrix.needsUpdate = true;
    if (haloInst.current) haloInst.current.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      dummy.position.copy(b.p);
      dummy.rotation.set(b.rx, b.ry, b.rz);
      dummy.scale.setScalar(b.s);
      dummy.updateMatrix();
      blockInst.current?.setMatrixAt(i, dummy.matrix);
    }
    if (blockInst.current) blockInst.current.instanceMatrix.needsUpdate = true;
  }, [bases, atomCount, blocks, dummy]);

  // film band: two arc segments leaving gaps along the beam (±X) axis
  const filmSegs = useMemo(() => {
    const seg = (start: number) =>
      new THREE.CylinderGeometry(FILM_R, FILM_R, filmWidth, 48, 1, true, start, Math.PI - 2 * GAP);
    return [seg(Math.PI / 2 + GAP), seg((3 * Math.PI) / 2 + GAP)];
  }, [filmWidth]);

  // cones + their rim rings
  const cones = useMemo(
    () =>
      CONES.map((c) => {
        const half = (c.half * Math.PI) / 180;
        const dist = FILM_R + 0.18;
        const H = dist * Math.cos(half);
        const R = dist * Math.sin(half);
        const g = new THREE.ConeGeometry(R, H, 56, 1, true);
        g.translate(0, -H / 2, 0); // apex at origin, base toward -Y
        return { geo: g, rim: ringInYZ(R), rotZ: c.dir === 1 ? Math.PI / 2 : -Math.PI / 2, x: c.dir * H, color: c.color };
      }),
    []
  );

  const photonGeo = useMemo(() => new THREE.SphereGeometry(0.055, 10, 10), []);
  const photonMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    []
  );
  const phOff = useMemo(() => Array.from({ length: PHOTONS }, (_, i) => i / PHOTONS), []);
  const phPrev = useRef<number[]>(Array(PHOTONS).fill(0));
  const pulse = useRef(0);
  const coreCol = useMemo(() => new THREE.Color(), []);
  const haloCol = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // sample slowly tumbling (powder rotation)
    if (crystal.current) crystal.current.rotation.y = t * 0.5;

    // glow pulse — sine periodicity in brightness + hue
    const s = 0.5 + 0.5 * Math.sin(t * glowFreq * 2.4);
    const hue = 0.54 + 0.12 * Math.sin(t * glowFreq * 2.4);
    coreCol.setHSL(hue, 0.85, 0.6 + 0.28 * s);
    haloCol.setHSL(hue, 0.9, 0.45 + 0.2 * s);
    atomCore.color.copy(coreCol);
    atomHalo.color.copy(haloCol);
    atomHalo.opacity = 0.28 + 0.4 * s;
    blockMat.emissive.setHSL(hue, 0.7, 0.4 + 0.18 * s);
    blockMat.emissiveIntensity = 0.18 + 0.5 * s;
    if (crystal.current) crystal.current.scale.setScalar(sampleSize * (1 + 0.07 * s));

    // photons run the beam; firing a diffraction pulse as they cross the sample
    if (photonMesh.current) {
      for (let i = 0; i < PHOTONS; i++) {
        const u = (t * rate * 0.22 + phOff[i]) % 1;
        const x = -BEAM_X + 2 * BEAM_X * u;
        if (phPrev.current[i] < 0.5 && u >= 0.5) pulse.current = Math.min(2, pulse.current + 0.8);
        phPrev.current[i] = u;
        dummy.position.set(x, 0, 0);
        dummy.scale.setScalar(Math.abs(x) < 0.3 ? 1.6 : 1);
        dummy.updateMatrix();
        photonMesh.current.setMatrixAt(i, dummy.matrix);
      }
      photonMesh.current.instanceMatrix.needsUpdate = true;
    }
    pulse.current *= 0.93;
    const fl = pulse.current;
    for (let k = 0; k < coneMats.current.length; k++) {
      if (coneMats.current[k]) coneMats.current[k].opacity = 0.16 + fl * 0.12;
      if (rimMats.current[k]) rimMats.current[k].opacity = Math.min(1, 0.45 + fl * 0.5);
    }
  });

  return (
    <group>
      {/* incoming + outgoing X-ray beam (fixed in the lab frame) */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, BEAM_X * 2, 12, 1, true]} />
        <meshBasicMaterial color={0xff4d4d} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <instancedMesh ref={photonMesh} args={[photonGeo, photonMat, PHOTONS]} />

      {/* powder sample — lattice of glow probes or a cohesive chunk of blocks */}
      <group ref={crystal}>
        <group visible={sample === "lattice"}>
          <instancedMesh ref={coreInst} args={[coreGeo, atomCore, atomCount]} />
          <instancedMesh ref={haloInst} args={[haloGeo, atomHalo, atomCount]} />
        </group>
        <instancedMesh ref={blockInst} args={[blockGeo, blockMat, blocks.length]} visible={sample === "chunk"} />
      </group>

      {/* Debye-Scherrer cones + rim rings */}
      {cones.map((c, k) => (
        <group key={k}>
          <mesh geometry={c.geo} rotation={[0, 0, c.rotZ]}>
            <meshBasicMaterial
              ref={(m: THREE.MeshBasicMaterial | null) => {
                if (m) coneMats.current[k] = m;
              }}
              color={c.color}
              transparent
              opacity={0.16}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <lineLoop geometry={c.rim} position={[c.x, 0, 0]}>
            <lineBasicMaterial
              ref={(m: THREE.LineBasicMaterial | null) => {
                if (m) rimMats.current[k] = m;
              }}
              color={c.color}
              transparent
              opacity={0.45}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </lineLoop>
        </group>
      ))}

      {/* cylindrical film with entrance / exit gaps */}
      {filmSegs.map((g, k) => (
        <mesh key={k} geometry={g}>
          <meshStandardMaterial
            color={0xcfd6e2}
            roughness={0.85}
            metalness={0.05}
            emissive={0x223049}
            emissiveIntensity={0.25}
            transparent={filmOpacity < 0.99}
            opacity={filmOpacity}
            side={THREE.DoubleSide}
            depthWrite={filmOpacity >= 0.99}
          />
        </mesh>
      ))}
    </group>
  );
}

function FilmStripOverlay() {
  // unrolled film: exit (2θ=0) at the ends, entrance (2θ=180) at the centre
  const W = 280;
  const cx = W / 2 + 12;
  const marks = CONES.map((c) => ({
    color: c.color,
    // forward cones land near the exit ends, back-scatter near the centre
    off: (c.dir === 1 ? (1 - c.half / 90) : (c.half / 90)) * 110,
  }));
  return (
    <svg width={W + 24} height={70} className="block">
      <rect x={12} y={18} width={W} height={28} fill="#cfd6e2" opacity={0.14} stroke="#475569" strokeWidth={1} rx={3} />
      <line x1={cx} y1={14} x2={cx} y2={50} stroke="#64748b" strokeWidth={1} strokeDasharray="3 3" />
      {marks.map((m, i) => (
        <g key={i}>
          <path d={`M ${cx + m.off} 19 q 4 13 0 26`} stroke={`#${m.color.toString(16).padStart(6, "0")}`} strokeWidth={2.5} fill="none" />
          <path d={`M ${cx - m.off} 19 q -4 13 0 26`} stroke={`#${m.color.toString(16).padStart(6, "0")}`} strokeWidth={2.5} fill="none" />
        </g>
      ))}
      <text x={cx} y={64} fill="#94a3b8" fontSize={8} textAnchor="middle">entrance 2θ=180°</text>
      <text x={20} y={64} fill="#94a3b8" fontSize={8} textAnchor="start">exit 0°</text>
    </svg>
  );
}

export default function CharacterizationAsset() {
  const [rate, setRate] = useState(1);
  const [glowFreq, setGlowFreq] = useState(1.2);
  const [spin, setSpin] = useState(true);
  const [showFilm, setShowFilm] = useState(true);
  const [sample, setSample] = useState<"lattice" | "chunk">("lattice");
  const [filmOpacity, setFilmOpacity] = useState(1);
  const [sampleSize, setSampleSize] = useState(0.5);
  const [filmWidth, setFilmWidth] = useState(0.65);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [5.6, 3.2, 7.0], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={0.6} />
        <pointLight position={[2, 3, 3]} intensity={0.5} color={0x88aaff} />
        <XrdScene
          rate={rate}
          glowFreq={glowFreq}
          sample={sample}
          filmOpacity={filmOpacity}
          sampleSize={sampleSize}
          filmWidth={filmWidth}
        />
        <OrbitControls enablePan={false} enableZoom autoRotate={spin} autoRotateSpeed={1.1} minDistance={4} maxDistance={24} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Characterization (XRD) — Debye-Scherrer powder camera</div>
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
              <span className="w-20 text-xs text-slate-400">glow freq</span>
              <input
                type="range"
                min={0.1}
                max={4}
                step={0.05}
                value={glowFreq}
                onChange={(e) => setGlowFreq(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{glowFreq.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">crystal size</span>
              <input
                type="range"
                min={0.2}
                max={1.4}
                step={0.05}
                value={sampleSize}
                onChange={(e) => setSampleSize(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{sampleSize.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">ring width</span>
              <input
                type="range"
                min={0.4}
                max={3.2}
                step={0.05}
                value={filmWidth}
                onChange={(e) => setFilmWidth(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{filmWidth.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">ring opacity</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={filmOpacity}
                onChange={(e) => setFilmOpacity(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{filmOpacity.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">sample</span>
              <button
                className={btn(true)}
                onClick={() => setSample((s) => (s === "lattice" ? "chunk" : "lattice"))}
              >
                {sample === "lattice" ? "lattice" : "crystal chunk"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">film strip</span>
              <button className={btn(showFilm)} onClick={() => setShowFilm((s) => !s)}>
                {showFilm ? "on" : "off"}
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

        {showFilm && (
          <div className="absolute bottom-5 right-5 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-3 backdrop-blur-md">
            <div className="mb-1 text-[11px] uppercase tracking-widest text-amber-300/80">film readout</div>
            <FilmStripOverlay />
          </div>
        )}
      </div>
    </>
  );
}
