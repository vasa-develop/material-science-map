import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Line, Grid } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { RING_NODES, ringNodeById, type RingNode } from "./ringNodes";

const EASE = [0.22, 1, 0.36, 1] as const;

const FIELD_META = [
  { key: "why", label: "Why it exists", tone: "#34d399" },
  { key: "where", label: "Where it fits", tone: "#38bdf8" },
  { key: "removes", label: "Bottleneck it removes", tone: "#a78bfa" },
  { key: "creates", label: "New bottleneck it creates", tone: "#f87171" },
] as const;

/**
 * The main page: a single persistent, orbitable 3D isometric "city". Each core
 * capability is a floating, glowing building arranged in a Discovery -> Synthesis
 * closed loop, wired by conduits with flowing data packets, over a grid ground
 * with faint ambient districts. Hover brightens + grows a node; click flies the
 * camera in (placeholder for the deeper semantic-zoom we'll design next).
 */

// node positions on the ground (x, z), aligned with RING_NODES order
const POS: [number, number][] = [
  [-5.2, -2.7],
  [-6.3, 0.4],
  [-5.2, 3.3],
  [-1.9, 4.5],
  [1.9, 4.5],
  [5.2, 3.3],
  [6.3, 0.4],
  [5.2, -2.7],
];

const DISTRICTS = [
  { name: "METHODS", x: -10.5, z: -6 },
  { name: "DATA", x: -12, z: 1.5 },
  { name: "INFRASTRUCTURE", x: -5, z: 9.5 },
  { name: "APPLICATIONS", x: 5, z: 9.5 },
  { name: "INDUSTRY", x: 12, z: 1.5 },
  { name: "INSTITUTIONS", x: 10.5, z: -6 },
  { name: "PEOPLE", x: 0, z: -9.5 },
  { name: "MARKET & SOCIETY", x: 0, z: 11 },
];

const HOME_CAM = new THREE.Vector3(12.5, 10.5, 15.5);
const HOME_TGT = new THREE.Vector3(0, 0.6, 0);

// dive framing: keep the iso viewing direction, fly close, and push the node to
// screen-right so the inspector can sit alongside it on the left.
const ISO_DIR = HOME_CAM.clone().sub(HOME_TGT).normalize();
const SCREEN_RIGHT = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), ISO_DIR).normalize();
const DIVE_DIST = 4.8;
const DIVE_SHIFT = 1.7; // how far to push the node off-center toward screen-right

let _glow: THREE.Texture | null = null;
function glowTex(): THREE.Texture {
  if (_glow) return _glow;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

const UNIT_BOX_EDGES = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));

function AutoSpin({ speed, children }: { speed: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * speed;
  });
  return <group ref={ref}>{children}</group>;
}

function CityNode({
  rn,
  pos,
  hovered,
  focused,
  anyHover,
  focusActive,
  onOver,
  onOut,
  onSelect,
}: {
  rn: RingNode;
  pos: [number, number];
  hovered: boolean;
  focused: boolean;
  anyHover: boolean;
  focusActive: boolean;
  onOver: () => void;
  onOut: () => void;
  onSelect: () => void;
}) {
  const accent = rn.node.accent ?? "#5fa8ff";
  const accentCol = useMemo(() => new THREE.Color(accent), [accent]);
  const assetRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Sprite>(null);
  const rimRef = useRef<THREE.MeshStandardMaterial>(null);
  const cur = useRef(1);
  const halo = useMemo(() => glowTex(), []);
  const SceneComp = rn.Scene;
  // dimmed by a hover elsewhere, OR muted because another node is focused
  const mutedByFocus = focusActive && !focused;
  const dim = mutedByFocus || (anyHover && !hovered && !focused);
  const [x, z] = pos;

  useFrame(() => {
    const tScale = focused ? 1.18 : mutedByFocus ? 0.78 : hovered ? 1.14 : dim ? 0.93 : 1;
    cur.current += (tScale - cur.current) * 0.12;
    if (assetRef.current) assetRef.current.scale.setScalar(rn.scale * cur.current);
    if (haloRef.current) {
      const m = haloRef.current.material as THREE.SpriteMaterial;
      const tHalo = focused ? 0.95 : mutedByFocus ? 0.03 : hovered ? 0.85 : dim ? 0.05 : 0.2;
      m.opacity += (tHalo - m.opacity) * 0.12;
    }
    if (rimRef.current) {
      const tE = focused ? 2.0 : mutedByFocus ? 0.08 : hovered ? 1.7 : dim ? 0.2 : 0.5;
      rimRef.current.emissiveIntensity += (tE - rimRef.current.emissiveIntensity) * 0.12;
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* plinth */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.88, 1.0, 0.22, 6]} />
        <meshStandardMaterial ref={rimRef} color={0x0e1626} emissive={accentCol} emissiveIntensity={0.5} roughness={0.5} metalness={0.45} />
      </mesh>
      {/* rim glow ring */}
      <mesh position={[0, 0.235, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.84, 0.97, 6]} />
        <meshBasicMaterial color={accentCol} transparent opacity={0.55} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* glow halo behind the floating asset */}
      <sprite ref={haloRef} position={[0, rn.lift * 0.9, 0]} scale={[3.4, 3.4, 1]}>
        <spriteMaterial map={halo} color={accentCol} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* floating asset */}
      <group ref={assetRef} position={[0, rn.lift, 0]} scale={rn.scale}>
        {rn.autoSpin ? (
          <AutoSpin speed={rn.autoSpin}>
            <SceneComp />
          </AutoSpin>
        ) : (
          <SceneComp />
        )}
      </group>

      {/* invisible hitbox for hover/click */}
      <mesh
        position={[0, rn.lift, 0]}
        visible={false}
        onPointerOver={(e) => {
          e.stopPropagation();
          onOver();
        }}
        onPointerOut={() => onOut()}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <boxGeometry args={[2.7, 3.4, 2.7]} />
      </mesh>

      {/* numbered label */}
      <Html position={[0, 0.1, 1.35]} center distanceFactor={15} style={{ pointerEvents: "none" }}>
        <div
          className="flex items-center gap-1.5 whitespace-nowrap"
          style={{ opacity: focused || mutedByFocus ? 0 : dim ? 0.4 : 1, transition: "opacity 0.35s ease" }}
        >
          <span
            className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold"
            style={{ background: accent, color: "#03040a" }}
          >
            {rn.num}
          </span>
          <span className="text-[11px] font-medium text-white drop-shadow">{rn.node.title}</span>
        </div>
      </Html>
    </group>
  );
}

function Conduits({ show, dimRef }: { show: boolean; dimRef: React.MutableRefObject<number> }) {
  const segs = useMemo(
    () =>
      POS.map((_, i) => {
        const a = POS[i];
        const b = POS[(i + 1) % POS.length];
        return { a: new THREE.Vector3(a[0], 0.18, a[1]), b: new THREE.Vector3(b[0], 0.18, b[1]) };
      }),
    []
  );
  const K = 3;
  const total = segs.length * K;
  const inst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lineRefs = useRef<Array<{ material?: THREE.Material & { opacity: number } }>>([]);

  useFrame((state) => {
    const fade = 1 - dimRef.current * 0.92;
    lineRefs.current.forEach((l) => {
      if (l?.material) l.material.opacity = 0.4 * fade;
    });
    if (!inst.current) return;
    const t = state.clock.elapsedTime;
    const pktScale = Math.max(0.0001, 1 - dimRef.current);
    let idx = 0;
    for (const seg of segs) {
      for (let k = 0; k < K; k++) {
        let u = (t * 0.16 + k / K) % 1;
        if (u < 0) u += 1;
        dummy.position.lerpVectors(seg.a, seg.b, u);
        dummy.scale.setScalar(pktScale);
        dummy.updateMatrix();
        inst.current.setMatrixAt(idx++, dummy.matrix);
      }
    }
    inst.current.instanceMatrix.needsUpdate = true;
  });

  if (!show) return null;
  return (
    <group>
      {segs.map((seg, i) => (
        <Line
          key={i}
          ref={(el) => {
            if (el) lineRefs.current[i] = el as unknown as { material?: THREE.Material & { opacity: number } };
          }}
          points={[seg.a, seg.b]}
          color="#3fa9ff"
          lineWidth={1.4}
          transparent
          opacity={0.4}
          dashed={false}
        />
      ))}
      <instancedMesh ref={inst} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, total]}>
        <sphereGeometry args={[0.075, 8, 8]} />
        <meshBasicMaterial color={0xc8ecff} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

function District({ d, dimRef, focusActive }: { d: (typeof DISTRICTS)[number]; dimRef: React.MutableRefObject<number>; focusActive: boolean }) {
  const grpRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const o = 0.5 * (1 - dimRef.current * 0.96);
    grpRef.current?.traverse((c) => {
      const m = (c as THREE.LineSegments).material as THREE.Material & { opacity?: number } | undefined;
      if (m && "opacity" in m) m.opacity = o;
    });
  });
  const boxes = useMemo(() => {
    let seed = Math.abs(d.x * 37 + d.z * 13) + 1;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: 5 }, () => ({
      dx: (rnd() - 0.5) * 2.6,
      dz: (rnd() - 0.5) * 2.6,
      h: 0.6 + rnd() * 1.8,
      w: 0.45 + rnd() * 0.5,
    }));
  }, [d]);
  return (
    <group ref={grpRef} position={[d.x, 0, d.z]}>
      {boxes.map((b, i) => (
        <lineSegments key={i} geometry={UNIT_BOX_EDGES} position={[b.dx, b.h / 2, b.dz]} scale={[b.w, b.h, b.w]}>
          <lineBasicMaterial color={0x2c4a72} transparent opacity={0.5} />
        </lineSegments>
      ))}
      <Html position={[0, 0.1, 1.8]} center distanceFactor={26} style={{ pointerEvents: "none" }}>
        <div
          className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500/70"
          style={{ opacity: focusActive ? 0 : 1, transition: "opacity 0.35s ease" }}
        >
          {d.name}
        </div>
      </Html>
    </group>
  );
}

function CameraRig({ focus, focusId }: { focus: THREE.Vector3 | null; focusId: string | null }) {
  const { camera } = useThree();
  // OrbitControls registers itself as the default `controls`
  const three = useThree() as unknown as { controls?: { target: THREE.Vector3; update: () => void; enabled: boolean } };
  const goalPos = useMemo(() => new THREE.Vector3(), []);
  const goalTgt = useMemo(() => new THREE.Vector3(), []);
  // false while the camera is still flying to a pose; once arrived we hand
  // control back to OrbitControls so the user can orbit around the focused node.
  const arrived = useRef(false);

  // reset the flight whenever the focus target changes
  useEffect(() => {
    arrived.current = false;
  }, [focusId]);

  useFrame(() => {
    const c = three.controls;
    if (!c) return;
    if (focus) {
      // look slightly left of the node so it sits on the right, leaving room
      // for the inspector on the left.
      goalTgt.copy(focus).addScaledVector(SCREEN_RIGHT, -DIVE_SHIFT);
      goalPos.copy(focus).addScaledVector(ISO_DIR, DIVE_DIST).add(new THREE.Vector3(0, 0.4, 0));
      if (!arrived.current) {
        c.enabled = false;
        camera.position.lerp(goalPos, 0.09);
        c.target.lerp(goalTgt, 0.09);
        c.update();
        if (camera.position.distanceTo(goalPos) < 0.3) {
          arrived.current = true;
          c.enabled = true; // allow orbiting around the focused node
        }
      }
    } else if (!c.enabled || camera.position.distanceTo(HOME_CAM) > 0.6) {
      c.enabled = false;
      camera.position.lerp(HOME_CAM, 0.08);
      c.target.lerp(HOME_TGT, 0.08);
      c.update();
      if (camera.position.distanceTo(HOME_CAM) < 0.6) c.enabled = true;
    }
  });
  return null;
}

interface Layers {
  grid: boolean;
  conduits: boolean;
  districts: boolean;
  labels: boolean;
}

function City({
  hover,
  setHover,
  focusId,
  onSelect,
  layers,
}: {
  hover: string | null;
  setHover: (id: string | null) => void;
  focusId: string | null;
  onSelect: (id: string) => void;
  layers: Layers;
}) {
  const focusActive = focusId !== null;
  const dimRef = useRef(0);
  useFrame(() => {
    dimRef.current += ((focusActive ? 1 : 0) - dimRef.current) * 0.08;
  });

  const focusPos = useMemo(() => {
    if (!focusId) return null;
    const i = RING_NODES.findIndex((n) => n.id === focusId);
    if (i < 0) return null;
    return new THREE.Vector3(POS[i][0], RING_NODES[i].lift, POS[i][1]);
  }, [focusId]);

  return (
    <>
      <color attach="background" args={["#04060d"]} />
      <fog attach="fog" args={["#04060d", 26, 64]} />

      <ambientLight intensity={0.55} />
      <hemisphereLight args={[0x88aaff, 0x202838, 0.45]} />
      <directionalLight position={[6, 12, 6]} intensity={0.7} />

      {layers.grid && (
        <Grid
          args={[64, 64]}
          cellSize={1}
          cellThickness={0.55}
          cellColor="#162338"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#294063"
          fadeDistance={46}
          fadeStrength={1.4}
          infiniteGrid={false}
          position={[0, 0, 0]}
        />
      )}

      {/* closed-loop echo ring at center */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.0, 3.06, 64]} />
        <meshBasicMaterial color={0x2a4063} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {layers.districts && DISTRICTS.map((d) => <District key={d.name} d={d} dimRef={dimRef} focusActive={focusActive} />)}

      <Conduits show={layers.conduits} dimRef={dimRef} />

      {RING_NODES.map((rn, i) => (
        <CityNode
          key={rn.id}
          rn={rn}
          pos={POS[i]}
          hovered={hover === rn.id}
          focused={focusId === rn.id}
          anyHover={hover !== null}
          focusActive={focusActive}
          onOver={() => layers.labels && !focusActive && setHover(rn.id)}
          onOut={() => setHover(null)}
          onSelect={() => onSelect(rn.id)}
        />
      ))}

      {/* center hub label */}
      <Html position={[0, 0.6, 0]} center distanceFactor={20} style={{ pointerEvents: "none" }}>
        <div className="text-center" style={{ opacity: focusActive ? 0 : 1, transition: "opacity 0.35s ease" }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-300/80">Closed loop</div>
          <div className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-slate-500">knowledge → materials → knowledge</div>
        </div>
      </Html>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={36}
        minPolarAngle={0.15}
        maxPolarAngle={1.28}
        target={[0, 0.6, 0]}
      />
      <CameraRig focus={focusPos} focusId={focusId} />
    </>
  );
}

const TABS = ["World", "Bottleneck Trail", "History"] as const;

export default function LivingMap() {
  const navigate = useNavigate();
  const [hover, setHover] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("World");
  const [layers, setLayers] = useState<Layers>({ grid: true, conduits: true, districts: true, labels: true });

  const focusActive = focusId !== null;
  const focusRing = focusId ? ringNodeById(focusId) : undefined;

  useEffect(() => {
    document.body.style.cursor = hover && !focusActive ? "pointer" : "default";
    return () => {
      document.body.style.cursor = "default";
    };
  }, [hover, focusActive]);

  useEffect(() => {
    if (!focusActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusActive]);

  const toggle = (k: keyof Layers) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  const chromeHidden = focusActive ? "pointer-events-none opacity-0" : "opacity-100";

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#04060d] text-slate-200">
      <Canvas
        camera={{ position: HOME_CAM.toArray(), fov: 38 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onPointerMissed={() => setFocusId(null)}
      >
        <City hover={hover} setHover={setHover} focusId={focusId} onSelect={setFocusId} layers={layers} />
      </Canvas>

      {/* ---- OS chrome ---- */}
      {/* brand */}
      <div className={`pointer-events-none absolute left-5 top-4 flex items-center gap-3 transition-opacity duration-500 ${chromeHidden}`}>
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-sky-400/40 bg-sky-400/10 text-sky-300">◆</div>
        <div>
          <div className="text-sm font-semibold tracking-wide text-white">MATERIALS GENOME OS</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Living city map</div>
        </div>
      </div>

      {/* top tabs */}
      <div className={`absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[rgba(8,12,22,0.7)] p-1 backdrop-blur-md transition-opacity duration-500 ${chromeHidden}`}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1.5 text-xs transition ${
              tab === t ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* status */}
      <div className={`pointer-events-none absolute right-5 top-4 text-right transition-opacity duration-500 ${chromeHidden}`}>
        <div className="flex items-center justify-end gap-1.5 text-[11px] uppercase tracking-[0.2em] text-emerald-300/80">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> System nominal
        </div>
        <div className="font-mono text-[11px] text-slate-500">discovery ⇄ synthesis</div>
      </div>

      {/* arc headers */}
      <div className={`pointer-events-none absolute left-5 top-[68px] transition-opacity duration-500 ${chromeHidden}`}>
        <div className="text-lg font-semibold uppercase tracking-[0.3em] text-cyan-300/90">Discovery</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Explore · predict · design</div>
      </div>
      <div className={`pointer-events-none absolute right-5 top-[68px] text-right transition-opacity duration-500 ${chromeHidden}`}>
        <div className="text-lg font-semibold uppercase tracking-[0.3em] text-amber-300/90">Synthesis</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Make · test · understand</div>
      </div>

      {/* layers panel */}
      <div className={`absolute left-5 top-[120px] w-44 rounded-xl border border-white/10 bg-[rgba(8,12,22,0.6)] p-3 backdrop-blur-md transition-opacity duration-500 ${chromeHidden}`}>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Layers</div>
        {(["grid", "conduits", "districts", "labels"] as (keyof Layers)[]).map((k) => (
          <button
            key={k}
            onClick={() => toggle(k)}
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs capitalize text-slate-300 transition hover:bg-white/5"
          >
            <span
              className={`grid h-3.5 w-3.5 place-items-center rounded border text-[8px] ${
                layers[k] ? "border-sky-400 bg-sky-400/20 text-sky-300" : "border-white/20 text-transparent"
              }`}
            >
              ✓
            </span>
            {k}
          </button>
        ))}
      </div>

      {/* legend */}
      <div className={`absolute bottom-5 right-5 rounded-xl border border-white/10 bg-[rgba(8,12,22,0.6)] p-3 text-[11px] text-slate-400 backdrop-blur-md transition-opacity duration-500 ${chromeHidden}`}>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Legend</div>
        <div className="flex items-center gap-2"><span className="h-1.5 w-5 rounded-full bg-cyan-300/80" /> Data / knowledge packet</div>
        <div className="mt-1.5 flex items-center gap-2"><span className="h-px w-5 bg-sky-400/70" /> Information conduit</div>
        <div className="mt-1.5 flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-slate-500" /> Ambient district</div>
        <div className="mt-1.5 flex items-center gap-2"><span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-sky-400 text-[8px] font-bold text-black">#</span> Step in the loop</div>
      </div>

      {/* orbit hint (only when nothing is focused) */}
      {!focusActive && (
        <div className="pointer-events-none absolute bottom-5 left-5 text-[11px] text-slate-500">
          Drag to orbit · scroll to zoom · hover a node to focus · click to dive in
        </div>
      )}

      {/* in-place node inspector — appears alongside the zoomed-in asset */}
      <AnimatePresence>
        {focusRing && (
          <>
            <motion.button
              key="back"
              onClick={() => setFocusId(null)}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="absolute left-6 top-5 z-10 rounded-full border border-white/15 bg-[rgba(8,12,22,0.7)] px-3.5 py-1.5 text-sm text-slate-200 backdrop-blur-md transition hover:bg-white/10"
            >
              ← Back to map
            </motion.button>

            <motion.div
              key={focusRing.id}
              initial={{ opacity: 0, x: -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="absolute left-6 top-1/2 z-10 w-[min(380px,38vw)] -translate-y-1/2"
            >
              <div className="max-h-[78vh] overflow-y-auto rounded-2xl border bg-[rgba(7,10,18,0.72)] p-5 backdrop-blur-xl"
                style={{ borderColor: `${focusRing.node.accent ?? "#5fa8ff"}40` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold"
                    style={{ background: focusRing.node.accent ?? "#5fa8ff", color: "#03040a" }}
                  >
                    {focusRing.num}
                  </span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: focusRing.node.accent ?? "#5fa8ff" }}
                  >
                    {focusRing.arc === "discovery" ? "Discovery arc" : "Synthesis arc"}
                  </span>
                </div>

                <h2 className="mt-2 text-2xl font-semibold leading-tight text-white">{focusRing.node.title}</h2>
                {focusRing.node.subtitle && (
                  <div className="mt-0.5 text-sm text-slate-400">{focusRing.node.subtitle}</div>
                )}

                {focusRing.node.fields && (
                  <div className="mt-4 space-y-2.5">
                    {FIELD_META.filter((m) => focusRing.node.fields?.[m.key]).map((m) => (
                      <div key={m.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: m.tone }}>
                          {m.label}
                        </div>
                        <p className="mt-1 text-[13px] leading-snug text-slate-300">{focusRing.node.fields?.[m.key]}</p>
                      </div>
                    ))}
                  </div>
                )}

                {focusRing.node.children && focusRing.node.children.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Inside this node
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {focusRing.node.children.map((c) => (
                        <span
                          key={c.id}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300"
                        >
                          {c.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/n/${focusRing.id}`)}
                    className="rounded-lg px-3.5 py-2 text-sm font-medium text-[#03040a] transition hover:brightness-110"
                    style={{ background: focusRing.node.accent ?? "#5fa8ff" }}
                  >
                    Open full asset ↗
                  </button>
                  <span className="text-[11px] text-slate-500">Esc · click empty space to exit</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
