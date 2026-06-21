import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { regionById, ringNodeById, type RegionVis } from "./ringNodes";
import { CrucibleMapScene } from "../proto/CrucibleAsset";
import { CharacterizationMapScene } from "../proto/CharacterizationAsset";
import { Orbital2sMapScene } from "../proto/Orbital2sAsset";

/**
 * LAB COPY of the L0 page (served at /lab). This is an isolated playground for
 * trying out L0 tweaks without touching the live page at "/". The region LAYOUT
 * (positions / scales / lift / spin) is duplicated locally as LAB_REGIONS so
 * editing the numbers here does not affect the original. The content metadata
 * (titles, essences, accents) is still shared via regionById().
 */

const EASE = [0.22, 1, 0.36, 1] as const;

// prototype: ground-anchor style under each floating hero
type Anchor = "none" | "disc" | "ring";

// characterize hero using the cohesive crystal-chunk sample instead of the lattice
const CharacterizeChunkScene = () => <CharacterizationMapScene sample="chunk" />;

// ── Local, independently-tweakable region layout ──
const LAB_REGIONS: RegionVis[] = [
  {
    id: "discover",
    stage: "discover",
    num: 1,
    Hero: Orbital2sMapScene,
    heroScale: 0.18,
    heroLift: 1.45,
    heroSpin: 0.16,
    pos: [6.2, -0.5],
    node: regionById("discover")!.node,
  },
  {
    id: "synthesis",
    stage: "synthesis",
    num: 2,
    Hero: CrucibleMapScene,
    heroScale: 0.78,
    heroLift: 1.15,
    heroSpin: 0.1,
    pos: [-6.2, -0.5],
    node: regionById("synthesis")!.node,
  },
  {
    id: "characterize",
    stage: "characterize",
    num: 3,
    Hero: CharacterizeChunkScene,
    heroScale: 0.24,
    heroLift: 1.7,
    heroSpin: 0.18,
    pos: [0, 7.5],
    node: regionById("characterize")!.node,
  },
];

const labRegionById = (id: string): RegionVis | undefined => LAB_REGIONS.find((r) => r.id === id);

// region ground positions (x, z), aligned with LAB_REGIONS order.
const POS: [number, number][] = LAB_REGIONS.map((r) => r.pos);

const HOME_CAM = new THREE.Vector3(0, 16.5, -21);
const HOME_TGT = new THREE.Vector3(0, 0.8, 2.8);

// dive framing: keep the iso viewing direction, fly close, and push the region
// to screen-right so the inspector can sit alongside it on the left.
const ISO_DIR = HOME_CAM.clone().sub(HOME_TGT).normalize();
const SCREEN_RIGHT = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), ISO_DIR).normalize();
const DIVE_DIST = 6.6;
const DIVE_SHIFT = 2.4; // how far to push the region off-center toward screen-right

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

function AutoSpin({ speed, children }: { speed: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * speed;
  });
  return <group ref={ref}>{children}</group>;
}

function RegionTotem({
  region,
  pos,
  hovered,
  focused,
  anyHover,
  focusActive,
  anchor,
  onOver,
  onOut,
  onSelect,
}: {
  region: RegionVis;
  pos: [number, number];
  hovered: boolean;
  focused: boolean;
  anyHover: boolean;
  focusActive: boolean;
  anchor: Anchor;
  onOver: () => void;
  onOut: () => void;
  onSelect: () => void;
}) {
  const accent = region.node.accent ?? "#5fa8ff";
  const accentCol = useMemo(() => new THREE.Color(accent), [accent]);
  const heroRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Sprite>(null);
  const rimRef = useRef<THREE.MeshStandardMaterial>(null);
  const discRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringRef = useRef<THREE.MeshBasicMaterial>(null);
  const cur = useRef(1);
  const halo = useMemo(() => glowTex(), []);
  const Hero = region.Hero;
  const mutedByFocus = focusActive && !focused;
  const dim = mutedByFocus || (anyHover && !hovered && !focused);
  const [x, z] = pos;

  useFrame(() => {
    const tScale = focused ? 1.12 : mutedByFocus ? 0.74 : hovered ? 1.1 : dim ? 0.92 : 1;
    cur.current += (tScale - cur.current) * 0.12;
    if (heroRef.current) heroRef.current.scale.setScalar(region.heroScale * cur.current);
    if (haloRef.current) {
      const m = haloRef.current.material as THREE.SpriteMaterial;
      const tHalo = focused ? 0.95 : mutedByFocus ? 0.03 : hovered ? 0.85 : dim ? 0.05 : 0.28;
      m.opacity += (tHalo - m.opacity) * 0.12;
    }
    if (rimRef.current) {
      const tE = focused ? 2.0 : mutedByFocus ? 0.08 : hovered ? 1.7 : dim ? 0.2 : 0.6;
      rimRef.current.emissiveIntensity += (tE - rimRef.current.emissiveIntensity) * 0.12;
    }
    if (discRef.current) {
      const tD = focused ? 0.72 : mutedByFocus ? 0.04 : hovered ? 0.66 : dim ? 0.16 : 0.42;
      discRef.current.opacity += (tD - discRef.current.opacity) * 0.12;
    }
    if (ringRef.current) {
      const tR = focused ? 0.95 : mutedByFocus ? 0.05 : hovered ? 0.88 : dim ? 0.22 : 0.6;
      ringRef.current.opacity += (tR - ringRef.current.opacity) * 0.12;
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* ground anchor (prototype): soft glow pool or a thin contact ring on the plane */}
      {anchor === "disc" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <circleGeometry args={[2.5, 56]} />
          <meshBasicMaterial
            ref={discRef}
            map={halo}
            color={accentCol}
            transparent
            opacity={0.42}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      {anchor === "ring" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[1.78, 2.0, 72]} />
          <meshBasicMaterial
            ref={ringRef}
            color={accentCol}
            transparent
            opacity={0.6}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* glow halo behind the floating hero */}
      <sprite ref={haloRef} position={[0, region.heroLift * 0.9, 0]} scale={[5.2, 5.2, 1]}>
        <spriteMaterial map={halo} color={accentCol} transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* floating hero */}
      <group ref={heroRef} position={[0, region.heroLift, 0]} scale={region.heroScale}>
        <AutoSpin speed={region.heroSpin}>
          <Hero />
        </AutoSpin>
      </group>

      {/* invisible hitbox for hover/click */}
      <mesh
        position={[0, region.heroLift, 0]}
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
        <boxGeometry args={[4.2, 5, 4.2]} />
      </mesh>

      {/* region label — sits on the OUTSIDE of the loop: below the bottom heroes,
          floated above the top (characterize) apex so it isn't trapped inside the triangle. */}
      <Html
        position={region.id === "characterize" ? [0, region.heroLift + 1.9, 0] : [0, 0.05, -2.5]}
        center
        distanceFactor={18}
        style={{ pointerEvents: "none" }}
      >
        <div
          className="flex items-center gap-1.5 whitespace-nowrap"
          style={{ opacity: focused || mutedByFocus ? 0 : dim ? 0.4 : 1, transition: "opacity 0.35s ease" }}
        >
          <span
            className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold"
            style={{ background: accent, color: "#03040a" }}
          >
            {region.num}
          </span>
          <span className="text-[15px] font-semibold uppercase tracking-[0.18em] text-white drop-shadow">
            {region.node.title}
          </span>
        </div>
      </Html>
    </group>
  );
}

function Conduits({ dimRef }: { dimRef: React.MutableRefObject<number> }) {
  // each segment carries the accent of the stage at each end, so the line and
  // its packets bleed from one stage's color into the next along their length.
  const segs = useMemo(
    () =>
      POS.map((_, i) => {
        const a = POS[i];
        const b = POS[(i + 1) % POS.length];
        const ca = new THREE.Color(LAB_REGIONS[i].node.accent ?? "#5fa8ff");
        const cb = new THREE.Color(LAB_REGIONS[(i + 1) % LAB_REGIONS.length].node.accent ?? "#5fa8ff");
        return { a: new THREE.Vector3(a[0], 0.2, a[1]), b: new THREE.Vector3(b[0], 0.2, b[1]), ca, cb };
      }),
    []
  );
  const K = 4;
  const total = segs.length * K;
  const inst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pktCol = useMemo(() => new THREE.Color(), []);
  const white = useMemo(() => new THREE.Color(0xffffff), []);
  const lineRefs = useRef<Array<{ material?: THREE.Material & { opacity: number } }>>([]);

  useFrame((state) => {
    const fade = 1 - dimRef.current * 0.92;
    lineRefs.current.forEach((l) => {
      if (l?.material) l.material.opacity = 0.62 * fade;
    });
    if (!inst.current) return;
    const t = state.clock.elapsedTime;
    const pktScale = Math.max(0.0001, 1 - dimRef.current);
    let idx = 0;
    for (const seg of segs) {
      for (let k = 0; k < K; k++) {
        let u = (t * 0.12 + k / K) % 1;
        if (u < 0) u += 1;
        dummy.position.lerpVectors(seg.a, seg.b, u);
        dummy.scale.setScalar(pktScale);
        dummy.updateMatrix();
        inst.current.setMatrixAt(idx, dummy.matrix);
        // packet color = stage accents lerped by position, nudged toward white so it reads as a bright mote
        pktCol.copy(seg.ca).lerp(seg.cb, u).lerp(white, 0.12);
        inst.current.setColorAt(idx, pktCol);
        idx++;
      }
    }
    inst.current.instanceMatrix.needsUpdate = true;
    if (inst.current.instanceColor) inst.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {segs.map((seg, i) => (
        <Line
          key={i}
          ref={(el) => {
            if (el) lineRefs.current[i] = el as unknown as { material?: THREE.Material & { opacity: number } };
          }}
          points={[seg.a, seg.b]}
          vertexColors={[seg.ca, seg.cb]}
          lineWidth={2}
          transparent
          opacity={0.62}
          dashed={false}
        />
      ))}
      <instancedMesh ref={inst} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, total]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color={0xffffff} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

function CameraRig({ focus, focusId, shift, dist }: { focus: THREE.Vector3 | null; focusId: string | null; shift: number; dist: number }) {
  const { camera } = useThree();
  const three = useThree() as unknown as { controls?: { target: THREE.Vector3; update: () => void; enabled: boolean } };
  const goalPos = useMemo(() => new THREE.Vector3(), []);
  const goalTgt = useMemo(() => new THREE.Vector3(), []);
  const arrived = useRef(false);

  useEffect(() => {
    arrived.current = false;
  }, [focusId]);

  useFrame(() => {
    const c = three.controls;
    if (!c) return;
    if (focus) {
      goalTgt.copy(focus).addScaledVector(SCREEN_RIGHT, -shift);
      goalPos.copy(focus).addScaledVector(ISO_DIR, dist).add(new THREE.Vector3(0, 0.6, 0));
      if (!arrived.current) {
        c.enabled = false;
        camera.position.lerp(goalPos, 0.13);
        c.target.lerp(goalTgt, 0.13);
        c.update();
        if (camera.position.distanceTo(goalPos) < 0.3) {
          arrived.current = true;
          c.enabled = true;
        }
      }
    } else if (!c.enabled || camera.position.distanceTo(HOME_CAM) > 0.6) {
      c.enabled = false;
      camera.position.lerp(HOME_CAM, 0.12);
      c.target.lerp(HOME_TGT, 0.12);
      c.update();
      if (camera.position.distanceTo(HOME_CAM) < 0.6) c.enabled = true;
    }
  });
  return null;
}

function World({
  hover,
  setHover,
  focusId,
  onSelect,
  interactive,
  anchor,
  diveShift,
  diveDist,
  onUserInteract,
}: {
  hover: string | null;
  setHover: (id: string | null) => void;
  focusId: string | null;
  onSelect: (id: string) => void;
  interactive: boolean;
  anchor: Anchor;
  diveShift: number;
  diveDist: number;
  onUserInteract: () => void;
}) {
  const focusActive = focusId !== null;
  const dimRef = useRef(0);
  useFrame(() => {
    dimRef.current += ((focusActive ? 1 : 0) - dimRef.current) * 0.08;
  });

  const focusPos = useMemo(() => {
    if (!focusId) return null;
    const i = LAB_REGIONS.findIndex((r) => r.id === focusId);
    if (i < 0) return null;
    return new THREE.Vector3(POS[i][0], LAB_REGIONS[i].heroLift, POS[i][1]);
  }, [focusId]);

  return (
    <>
      <color attach="background" args={["#04060d"]} />
      <fog attach="fog" args={["#04060d", 30, 72]} />

      <ambientLight intensity={0.55} />
      <hemisphereLight args={[0x88aaff, 0x202838, 0.45]} />
      <directionalLight position={[6, 12, 6]} intensity={0.7} />

      <Conduits dimRef={dimRef} />

      {LAB_REGIONS.map((region, i) => (
        <RegionTotem
          key={region.id}
          region={region}
          pos={POS[i]}
          hovered={hover === region.id}
          focused={focusId === region.id}
          anyHover={hover !== null}
          focusActive={focusActive}
          anchor={anchor}
          onOver={() => interactive && !focusActive && setHover(region.id)}
          onOut={() => setHover(null)}
          onSelect={() => interactive && onSelect(region.id)}
        />
      ))}

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={40}
        minPolarAngle={0.15}
        maxPolarAngle={1.42}
        target={[0, 0.8, 2.8]}
        onStart={onUserInteract}
      />
      <CameraRig focus={focusPos} focusId={focusId} shift={diveShift} dist={diveDist} />
    </>
  );
}

const REGION_TAG: Record<string, string> = {
  discover: "Stage ① · Discovery",
  synthesis: "Stage ② · Synthesis",
  characterize: "Stage ③ · Characterization",
};

interface TourStop {
  focusId: string | null;
  title: string;
  caption: string;
  dwell: number;
  accent: string;
}

// The guided narrative: establishing drift → the three stages → loop close.
const TOUR_STOPS: TourStop[] = [
  {
    focusId: null,
    title: "The Materials Loop",
    caption:
      "Three stages, one closed loop — discover what to make, synthesize it, then characterize what you made, feeding the truth back to discovery.",
    dwell: 6500,
    accent: "#7dd3fc",
  },
  {
    focusId: "discover",
    title: "① Discovery",
    caption: regionById("discover")?.node.essence ?? "",
    dwell: 6000,
    accent: regionById("discover")?.node.accent ?? "#38bdf8",
  },
  {
    focusId: "synthesis",
    title: "② Synthesis",
    caption: regionById("synthesis")?.node.essence ?? "",
    dwell: 6000,
    accent: regionById("synthesis")?.node.accent ?? "#fbbf24",
  },
  {
    focusId: "characterize",
    title: "③ Characterization",
    caption: regionById("characterize")?.node.essence ?? "",
    dwell: 6000,
    accent: regionById("characterize")?.node.accent ?? "#f472b6",
  },
  {
    focusId: null,
    title: "…and back again",
    caption:
      "Characterization feeds new ground truth back into discovery — closing the loop and making the whole system smarter on every pass.",
    dwell: 7500,
    accent: "#34d399",
  },
];

type Mode = "tour" | "explore";

export default function LivingMapLab() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("tour");
  const [hover, setHover] = useState<string | null>(null);
  const [exploreFocus, setExploreFocus] = useState<string | null>(null);
  const [tourIdx, setTourIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [anchor, setAnchor] = useState<Anchor>("disc");

  const inTour = mode === "tour";
  const stop = TOUR_STOPS[tourIdx];
  // the camera target: tour-driven in Tour mode, click-driven in Explore mode
  const focusId = inTour ? stop.focusId : exploreFocus;
  const focusActive = focusId !== null;
  const exploreFocusActive = !inTour && exploreFocus !== null;
  const focusRegion = !inTour && exploreFocus ? labRegionById(exploreFocus) : undefined;

  // auto-advance the tour
  useEffect(() => {
    if (!inTour || !playing) return;
    const t = window.setTimeout(() => setTourIdx((i) => (i + 1) % TOUR_STOPS.length), stop.dwell);
    return () => window.clearTimeout(t);
  }, [inTour, playing, tourIdx, stop.dwell]);

  useEffect(() => {
    document.body.style.cursor = hover && !inTour && !exploreFocusActive ? "pointer" : "default";
    return () => {
      document.body.style.cursor = "default";
    };
  }, [hover, inTour, exploreFocusActive]);

  useEffect(() => {
    const order = LAB_REGIONS.map((r) => r.id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExploreFocus(null);
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      if (inTour) {
        // step through the guided tour stops, pausing auto-advance
        setTourIdx((cur) => (cur + dir + TOUR_STOPS.length) % TOUR_STOPS.length);
        setPlaying(false);
      } else {
        // cycle the focused stage around the loop (entering focus if none yet)
        setExploreFocus((cur) => {
          if (cur === null) return dir === 1 ? order[0] : order[order.length - 1];
          const i = order.indexOf(cur);
          return order[(i + dir + order.length) % order.length];
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inTour]);

  const enterMode = (m: Mode) => {
    setMode(m);
    setHover(null);
    if (m === "tour") setPlaying(true);
    else setExploreFocus(null); // free orbit on entering Explore; tour resumes from where it left off
  };

  const goStop = (i: number) => {
    setTourIdx((i + TOUR_STOPS.length) % TOUR_STOPS.length);
    setPlaying(false); // manual stepping pauses auto-advance
  };

  // explore chrome (the orbit hint) only in Explore mode at the overview
  const exploreChrome = mode === "explore" && !exploreFocusActive;
  const chromeFade = (show: boolean) => (show ? "opacity-100" : "pointer-events-none opacity-0");

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#04060d] text-slate-200">
      <Canvas
        camera={{ position: HOME_CAM.toArray(), fov: 38 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onPointerMissed={() => !inTour && setExploreFocus(null)}
      >
        <World
          hover={hover}
          setHover={setHover}
          focusId={focusId}
          onSelect={setExploreFocus}
          interactive={!inTour}
          anchor={anchor}
          diveShift={inTour ? 0 : DIVE_SHIFT}
          diveDist={inTour ? 9 : DIVE_DIST}
          onUserInteract={() => {
            if (inTour) setPlaying(false);
          }}
        />
      </Canvas>

      {/* LAB badge — marks this as the experimental copy */}
      <div className="pointer-events-none absolute left-1/2 top-[60px] z-20 -translate-x-1/2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-300">
        Lab copy
      </div>

      {/* ---- OS chrome ---- */}
      {/* brand */}
      <div className={`pointer-events-none absolute left-5 top-4 flex items-center gap-3 transition-opacity duration-500 ${chromeFade(!exploreFocusActive)}`}>
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-sky-400/40 bg-sky-400/10 text-sky-300">◆</div>
        <div>
          <div className="text-sm font-semibold tracking-wide text-white">MATERIALS SCIENCE MAP</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Interactive playground</div>
        </div>
      </div>

      {/* mode switcher */}
      <div className={`absolute left-1/2 top-4 -translate-x-1/2 transition-opacity duration-500 ${chromeFade(!exploreFocusActive)}`}>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[rgba(8,12,22,0.72)] p-1 backdrop-blur-md">
          {(["tour", "explore"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => enterMode(m)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition ${
                mode === m ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {m === "tour" ? "▶ Tour" : "✦ Explore"}
            </button>
          ))}
        </div>
      </div>

      {/* ground-anchor prototype switcher */}
      <div className={`absolute left-5 top-[72px] flex flex-col gap-1.5 rounded-xl border border-white/10 bg-[rgba(8,12,22,0.6)] p-2.5 backdrop-blur-md transition-opacity duration-500 ${chromeFade(!exploreFocusActive)}`}>
        <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Ground anchor</div>
        <div className="flex items-center gap-1">
          {(["none", "disc", "ring"] as Anchor[]).map((a) => (
            <button
              key={a}
              onClick={() => setAnchor(a)}
              className={`rounded-md px-2.5 py-1 text-[11px] capitalize transition ${
                anchor === a ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* orbit hint (Explore overview only) */}
      <div className={`pointer-events-none absolute bottom-5 left-5 text-[11px] text-slate-500 transition-opacity duration-500 ${chromeFade(exploreChrome)}`}>
        Drag to orbit · scroll to zoom · hover a stage to focus · click to fly in · ← → to step stages
      </div>

      {/* ---- Tour overlay: caption + transport controls ---- */}
      <AnimatePresence>
        {inTour && (
          <motion.div
            key="tour-bar"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="absolute bottom-7 left-1/2 z-10 w-[min(620px,86vw)] -translate-x-1/2"
          >
            <div className="rounded-2xl border border-white/10 bg-[rgba(7,10,18,0.74)] p-4 backdrop-blur-xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tourIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: stop.accent }}>
                    {stop.title}
                  </div>
                  <p className="mt-1 text-[13.5px] leading-snug text-slate-200">{stop.caption}</p>
                </motion.div>
              </AnimatePresence>

              <div className="mt-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goStop(tourIdx - 1)}
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-slate-300 transition hover:bg-white/10"
                    aria-label="Previous"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setPlaying((p) => !p)}
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                    aria-label={playing ? "Pause" : "Play"}
                  >
                    {playing ? "❚❚" : "▶"}
                  </button>
                  <button
                    onClick={() => goStop(tourIdx + 1)}
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-slate-300 transition hover:bg-white/10"
                    aria-label="Next"
                  >
                    ›
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {TOUR_STOPS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => goStop(i)}
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: i === tourIdx ? 22 : 8,
                        background: i === tourIdx ? s.accent : "rgba(148,163,184,0.4)",
                      }}
                      aria-label={`Go to ${s.title}`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => enterMode("explore")}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-slate-300 transition hover:bg-white/10"
                >
                  Explore freely →
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* in-place region inspector — Explore mode, alongside the zoomed-in hero */}
      <AnimatePresence>
        {focusRegion && (
          <>
            <motion.button
              key="back"
              onClick={() => setExploreFocus(null)}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="absolute left-6 top-5 z-10 rounded-full border border-white/15 bg-[rgba(8,12,22,0.7)] px-3.5 py-1.5 text-sm text-slate-200 backdrop-blur-md transition hover:bg-white/10"
            >
              ← Back to map
            </motion.button>

            <motion.div
              key={focusRegion.id}
              initial={{ opacity: 0, x: -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="absolute left-6 top-1/2 z-10 w-[min(400px,40vw)] -translate-y-1/2"
            >
              <div
                className="max-h-[80vh] overflow-y-auto rounded-2xl border bg-[rgba(7,10,18,0.74)] p-5 backdrop-blur-xl"
                style={{ borderColor: `${focusRegion.node.accent ?? "#5fa8ff"}40` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold"
                    style={{ background: focusRegion.node.accent ?? "#5fa8ff", color: "#03040a" }}
                  >
                    {focusRegion.num}
                  </span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: focusRegion.node.accent ?? "#5fa8ff" }}
                  >
                    {REGION_TAG[focusRegion.id] ?? "Stage"}
                  </span>
                </div>

                <h2 className="mt-2 text-3xl font-semibold leading-tight text-white">{focusRegion.node.title}</h2>
                {focusRegion.node.subtitle && (
                  <div className="mt-0.5 text-sm text-slate-400">{focusRegion.node.subtitle}</div>
                )}
                {focusRegion.node.essence && (
                  <p className="mt-3 text-[13px] leading-snug text-slate-300">{focusRegion.node.essence}</p>
                )}

                {focusRegion.node.children && focusRegion.node.children.length > 0 && (
                  <div className="mt-5">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Inside this stage
                    </div>
                    <div className="space-y-1.5">
                      {focusRegion.node.children.map((c) => {
                        const hasAsset = !!ringNodeById(c.id);
                        return (
                          <button
                            key={c.id}
                            disabled={!hasAsset}
                            onClick={() => hasAsset && navigate(`/n/${c.id}`)}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition ${
                              hasAsset ? "hover:border-white/25 hover:bg-white/[0.07]" : "opacity-60"
                            }`}
                          >
                            <span>
                              <span className="block text-[13px] font-medium text-slate-200">{c.title}</span>
                              {c.essence && <span className="block text-[11px] text-slate-500">{c.essence}</span>}
                            </span>
                            <span
                              className="shrink-0 text-[10px]"
                              style={{ color: hasAsset ? (c.accent ?? "#5fa8ff") : "#475569" }}
                            >
                              {hasAsset ? "open ↗" : "soon"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-5 text-[11px] text-slate-500">Esc · click empty space to exit</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
