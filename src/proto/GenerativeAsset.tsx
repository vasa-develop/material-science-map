import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Generative model — a crystal self-assembles out of noise. Atoms
 * scatter in random positions, snap into an ordered lattice (staggered, so it
 * looks like it's being "solved"), bonds crystallize in, then it disperses and
 * repeats. Verb: denoise / assemble.
 */

const GRID = 3;
const SP = 0.98; // lattice spacing
const SCATTER_R = 2.6; // radius of the noise cloud
const MAX_DELAY = 0.45; // per-atom stagger of assembly
const SPECIES = [0xff9d4d, 0x5cc8ff]; // alternating cation / anion

// element symbols per species (cation-ish warm / anion-ish cool)
const SYMBOLS: [string[], string[]] = [
  ["Na", "Li", "K", "Mg", "Ca", "Fe", "Ti", "Al"],
  ["Cl", "O", "S", "N", "F", "Br"],
];

const smoother = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * c * (c * (c * 6 - 15) + 10);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function symbolTexture(text: string): THREE.Texture {
  const S = 128;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 14;
  ctx.font = `bold 74px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(text, S / 2, S / 2 + 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

function GenerativeCrystal({
  speed,
  spin,
  size,
  elements,
}: {
  speed: number;
  spin: boolean;
  size: number;
  elements: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const meshStd = useRef<THREE.InstancedMesh>(null);
  const meshGlow = useRef<THREE.InstancedMesh>(null);
  const bondAttr = useRef<THREE.BufferAttribute>(null);
  const bondMat = useRef<THREE.LineBasicMaterial>(null);

  const { ordered, scatter, delays, count, bonds, bondPos, cur } = useMemo(() => {
    const count = GRID * GRID * GRID;
    const ordered: THREE.Vector3[] = [];
    const scatter: THREE.Vector3[] = [];
    const delays: number[] = [];
    const off = (GRID - 1) / 2;
    const idx = (x: number, y: number, z: number) => x * GRID * GRID + y * GRID + z;
    for (let x = 0; x < GRID; x++)
      for (let y = 0; y < GRID; y++)
        for (let z = 0; z < GRID; z++) {
          ordered.push(new THREE.Vector3((x - off) * SP, (y - off) * SP, (z - off) * SP));
          // random point in a sphere (noise position)
          const u = Math.random() * 2 - 1;
          const phi = Math.random() * Math.PI * 2;
          const s = Math.sqrt(1 - u * u);
          const r = SCATTER_R * Math.cbrt(Math.random());
          scatter.push(new THREE.Vector3(r * s * Math.cos(phi), r * s * Math.sin(phi), r * u));
          delays.push(Math.random() * MAX_DELAY);
        }
    // nearest-neighbor bonds along +x / +y / +z
    const bonds: [number, number][] = [];
    for (let x = 0; x < GRID; x++)
      for (let y = 0; y < GRID; y++)
        for (let z = 0; z < GRID; z++) {
          if (x + 1 < GRID) bonds.push([idx(x, y, z), idx(x + 1, y, z)]);
          if (y + 1 < GRID) bonds.push([idx(x, y, z), idx(x, y + 1, z)]);
          if (z + 1 < GRID) bonds.push([idx(x, y, z), idx(x, y, z + 1)]);
        }
    const bondPos = new Float32Array(bonds.length * 2 * 3);
    const cur = new Float32Array(count * 3);
    return { ordered, scatter, delays, count, bonds, bondPos, cur };
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.16, 20, 20);
    const n = g.attributes.position.count;
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    return g;
  }, []);
  const matStd = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.1 }),
    []
  );
  const matGlow = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // per-atom species color (alternating, rock-salt style), assigned on first frame
  const colorOf = useMemo<THREE.Color[]>(() => {
    const out: THREE.Color[] = [];
    for (let x = 0; x < GRID; x++)
      for (let y = 0; y < GRID; y++)
        for (let z = 0; z < GRID; z++) out.push(new THREE.Color(SPECIES[(x + y + z) % 2]));
    return out;
  }, []);

  const initedColors = useRef(false);

  // element-symbol sprites (one per atom) that morph into balls on assembly
  const symbolSprites = useMemo(() => {
    const cache = new Map<string, THREE.Texture>();
    const tex = (s: string) => {
      let tx = cache.get(s);
      if (!tx) {
        tx = symbolTexture(s);
        cache.set(s, tx);
      }
      return tx;
    };
    const sprites: THREE.Sprite[] = [];
    const tint = new THREE.Color();
    for (let x = 0; x < GRID; x++)
      for (let y = 0; y < GRID; y++)
        for (let z = 0; z < GRID; z++) {
          const sp = (x + y + z) % 2;
          const set = SYMBOLS[sp];
          const sym = set[(Math.random() * set.length) | 0];
          const m = new THREE.SpriteMaterial({ map: tex(sym), transparent: true, depthWrite: false });
          tint.set(SPECIES[sp]).lerp(new THREE.Color(0xffffff), 0.35);
          m.color.copy(tint);
          sprites.push(new THREE.Sprite(m));
        }
    return sprites;
  }, []);

  useFrame((state) => {
    if (!meshStd.current || !meshGlow.current) return;
    const t = state.clock.elapsedTime;

    if (!initedColors.current && colorOf.length === count) {
      for (let i = 0; i < count; i++) {
        meshStd.current.setColorAt(i, colorOf[i]);
        meshGlow.current.setColorAt(i, colorOf[i]);
      }
      if (meshStd.current.instanceColor) meshStd.current.instanceColor.needsUpdate = true;
      if (meshGlow.current.instanceColor) meshGlow.current.instanceColor.needsUpdate = true;
      initedColors.current = true;
    }

    const base = 0.5 - 0.5 * Math.cos(t * speed); // oscillate noise <-> crystal
    let crystallinity = 0;
    for (let i = 0; i < count; i++) {
      const p = smoother((base - delays[i]) / (1 - MAX_DELAY));
      crystallinity += p;
      const o = ordered[i];
      const sc = scatter[i];
      const x = sc.x + (o.x - sc.x) * p;
      const y = sc.y + (o.y - sc.y) * p;
      const z = sc.z + (o.z - sc.z) * p;
      cur[i * 3] = x;
      cur[i * 3 + 1] = y;
      cur[i * 3 + 2] = z;

      // in elements mode, the ball only emerges as the symbol resolves into it
      const morphBall = elements ? smoother((p - 0.4) / 0.45) : 1;
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(size * (0.45 + 0.55 * p) * morphBall); // atoms grow as they settle
      dummy.updateMatrix();
      meshStd.current.setMatrixAt(i, dummy.matrix);
      meshGlow.current.setMatrixAt(i, dummy.matrix);

      // element symbol: floats while scattered, fades as it becomes a ball
      const sp = symbolSprites[i];
      if (elements) {
        const symA = 1 - smoother((p - 0.3) / 0.4);
        sp.visible = symA > 0.02;
        if (sp.visible) {
          const ss = size * 0.85 * (0.85 + 0.15 * (1 - p));
          sp.position.set(x, y, z);
          sp.scale.set(ss, ss, 1);
          sp.material.opacity = clamp01(symA);
        }
      } else if (sp.visible) {
        sp.visible = false;
      }
    }
    meshStd.current.instanceMatrix.needsUpdate = true;
    meshGlow.current.instanceMatrix.needsUpdate = true;
    crystallinity /= count;

    // bonds follow current atom positions, fade in with crystallinity
    if (bondAttr.current) {
      for (let b = 0; b < bonds.length; b++) {
        const [i, j] = bonds[b];
        const k = b * 6;
        bondPos[k] = cur[i * 3];
        bondPos[k + 1] = cur[i * 3 + 1];
        bondPos[k + 2] = cur[i * 3 + 2];
        bondPos[k + 3] = cur[j * 3];
        bondPos[k + 4] = cur[j * 3 + 1];
        bondPos[k + 5] = cur[j * 3 + 2];
      }
      bondAttr.current.needsUpdate = true;
    }
    if (bondMat.current) bondMat.current.opacity = Math.pow(crystallinity, 2.2) * 0.7;

    if (group.current && spin) group.current.rotation.y = t * 0.18;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={meshStd} args={[geo, matStd, count]} />
      <instancedMesh ref={meshGlow} args={[geo, matGlow, count]} />
      {symbolSprites.map((sp, i) => (
        <primitive key={i} object={sp} visible={false} />
      ))}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute ref={bondAttr} attach="attributes-position" args={[bondPos, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          ref={bondMat}
          color={0x9fc6ff}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}

export default function GenerativeAsset() {
  const [speed, setSpeed] = useState(0.6);
  const [spin, setSpin] = useState(true);
  const [size, setSize] = useState(1);
  const [elements, setElements] = useState(false);

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${
      active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0, 7], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 3]} intensity={0.85} />
        <pointLight position={[-4, -2, -3]} intensity={0.4} color={0x88aaff} />
        <GenerativeCrystal speed={speed} spin={spin} size={size} elements={elements} />
        <OrbitControls enablePan={false} enableZoom minDistance={3.5} maxDistance={15} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Generative model — crystal assembling out of noise</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">speed</span>
              <input
                type="range"
                min={0.15}
                max={1.6}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{speed.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">atom size</span>
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.05}
                value={size}
                onChange={(e) => setSize(parseFloat(e.target.value))}
                className="w-36 accent-sky-400"
              />
              <span className="text-[11px] tabular-nums text-slate-500">{size.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">spin</span>
              <button className={btn(spin)} onClick={() => setSpin((s) => !s)}>
                {spin ? "on" : "off"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-slate-400">elements</span>
              <button className={btn(elements)} onClick={() => setElements((s) => !s)}>
                {elements ? "symbols → balls" : "off"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
