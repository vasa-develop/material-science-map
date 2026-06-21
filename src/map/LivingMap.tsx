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
 * The live L0 page (served at "/"): three floating, glowing hero "regions" of the
 * materials loop — Discovery → Synthesis → Characterization — wired by gradient
 * conduits carrying meaningful knowledge packets. Hover brightens + grows a
 * region; click flies the camera in and slides an inspector alongside it. The
 * visual config below was locked in from the /lab playground. Region layout
 * (positions / scales / lift / spin) lives locally; content metadata (titles,
 * essences, accents) is shared via regionById().
 */

const EASE = [0.22, 1, 0.36, 1] as const;

// ground-anchor style under each floating hero
type Anchor = "none" | "disc" | "ring";

// characterize hero using the cohesive crystal-chunk sample instead of the lattice
const CharacterizeChunkScene = () => <CharacterizationMapScene sample="chunk" />;

// ── Region layout ──
const L0_REGIONS: RegionVis[] = [
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

const regionByIdL0 = (id: string): RegionVis | undefined => L0_REGIONS.find((r) => r.id === id);

// region ground positions (x, z), aligned with L0_REGIONS order.
const POS: [number, number][] = L0_REGIONS.map((r) => r.pos);

const HOME_CAM = new THREE.Vector3(0, 16.5, -21);
const HOME_TGT = new THREE.Vector3(0, 0.8, 2.8);

// dive framing: keep the iso viewing direction, fly close, and push the region
// to screen-right so the inspector can sit alongside it on the left.
const ISO_DIR = HOME_CAM.clone().sub(HOME_TGT).normalize();
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const SCREEN_RIGHT = new THREE.Vector3().crossVectors(WORLD_UP, ISO_DIR).normalize();
const DIVE_DIST = 6.6;
const DIVE_SHIFT = 1.5; // how far to push the region off-center toward screen-right (clears the left inspector panel while staying near center)
// Master switch for user camera control. When true, Explore lets the user drag to
// orbit + scroll to zoom (overview releases to free orbit; re-centering only when
// leaving a focused stage). When false, the camera is fully curated/locked and the
// orbit + zoom interactions are disabled. Flip this one flag to toggle the feature.
const EXPLORE_FREE_ORBIT = false;

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

// ── packet glyphs (prototype) ──────────────────────────────────────────────
// Each leg of the loop carries a different payload. Drawn white on transparent
// so the sprite color (the per-position accent gradient) tints them.
//   candidate → predicted structure handed to synthesis (wireframe gem)
//   material  → the synthesized sample handed to characterization (solid gem)
//   data      → measured ground truth fed back to discovery (mini spectrum)
type Glyph = "candidate" | "material" | "data";
const _glyphTex: Partial<Record<Glyph, THREE.Texture>> = {};
function glyphTex(kind: Glyph): THREE.Texture {
  const cached = _glyphTex[kind];
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  x.clearRect(0, 0, 128, 128);
  x.strokeStyle = "#ffffff";
  x.fillStyle = "#ffffff";
  x.lineJoin = "round";
  x.lineCap = "round";

  // cut-gem silhouette shared by candidate/material
  const gem = () => {
    x.beginPath();
    x.moveTo(44, 32);
    x.lineTo(84, 32);
    x.lineTo(104, 54);
    x.lineTo(64, 108);
    x.lineTo(24, 54);
    x.closePath();
  };

  if (kind === "candidate") {
    x.lineWidth = 6;
    gem();
    x.stroke();
    // facet lines for a wireframe read
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(24, 54);
    x.lineTo(104, 54);
    x.moveTo(44, 32);
    x.lineTo(64, 108);
    x.moveTo(84, 32);
    x.lineTo(64, 108);
    x.stroke();
  } else if (kind === "material") {
    gem();
    x.fill();
    // darker facet creases so the solid gem reads faceted once tinted
    x.strokeStyle = "rgba(0,0,0,0.22)";
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(24, 54);
    x.lineTo(104, 54);
    x.moveTo(64, 54);
    x.lineTo(64, 108);
    x.stroke();
  } else {
    // mini spectrum / bar chart
    const bars = [
      [26, 58],
      [48, 30],
      [70, 74],
      [92, 44],
    ];
    bars.forEach(([bx, h]) => {
      x.beginPath();
      // rounded-top bar from baseline 104 up by h, width 16
      const w = 16;
      const top = 104 - h;
      x.moveTo(bx - w / 2, 104);
      x.lineTo(bx - w / 2, top + 6);
      x.quadraticCurveTo(bx - w / 2, top, bx, top);
      x.quadraticCurveTo(bx + w / 2, top, bx + w / 2, top + 6);
      x.lineTo(bx + w / 2, 104);
      x.closePath();
      x.fill();
    });
  }

  const tex = new THREE.CanvasTexture(c);
  _glyphTex[kind] = tex;
  return tex;
}

function AutoSpin({ speed, children }: { speed: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * speed;
  });
  return <group ref={ref}>{children}</group>;
}

// unit-cell edges reused by the 3D candidate packet
const CELL_EDGES = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));

// neutral packet color used when the gradient tint is toggled off
const NEUTRAL_PKT = new THREE.Color(0xbfe6ff);

// deterministic faceted blocks for the crystal-chunk packet (mirrors the
// chunk in CharacterizationAsset so the synthesized sample reads consistently)
const CHUNK_BLOCKS = (() => {
  const out: { p: [number, number, number]; s: number; rx: number; ry: number; rz: number }[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 26; i++) {
    const u = rnd() * 2 - 1;
    const phi = rnd() * Math.PI * 2;
    const sp = Math.sqrt(1 - u * u);
    const r = 0.62 * Math.cbrt(rnd());
    out.push({
      p: [r * sp * Math.cos(phi), r * sp * Math.sin(phi), r * u],
      s: 0.16 + rnd() * 0.2,
      rx: rnd() * Math.PI,
      ry: rnd() * Math.PI,
      rz: rnd() * Math.PI,
    });
  }
  return out;
})();

// ---- data-packet (characterize→discover) variants ------------------------
// the loop's return leg carries measured results / learnings; these are the
// alternative ways to depict that payload, switchable from the lab panel.
type DataGlyph = "rings" | "bars" | "card" | "trace" | "db" | "scatter";

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const DISK_GEO = new THREE.CylinderGeometry(0.62, 0.62, 0.16, 24);
const DOT_GEO = new THREE.SphereGeometry(0.1, 10, 10);

// spectrum bars: evenly spaced columns of varying height (mini bar chart)
const BAR_HEIGHTS = [0.55, 1.0, 0.7, 1.3, 0.85, 0.45];
const BAR_W = 0.16;
const BAR_GAP = 0.26;

// a peaked "spectrum trace" polyline (two gaussian-ish peaks over a baseline)
const traceGeo = (() => {
  const N = 40;
  const pos = new Float32Array(N * 3);
  const peak = (x: number, c: number, w: number, h: number) =>
    h * Math.exp(-((x - c) * (x - c)) / (2 * w * w));
  for (let i = 0; i < N; i++) {
    const x = -1 + (2 * i) / (N - 1);
    const y = -0.55 + peak(x, -0.35, 0.16, 1.0) + peak(x, 0.42, 0.1, 0.7) + 0.04 * Math.sin(x * 9);
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = 0;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return g;
})();

// a zig-zag mini plot drawn on the data card
const cardPlotGeo = (() => {
  const ys = [-0.18, 0.12, -0.05, 0.22, 0.0, 0.28];
  const pos = new Float32Array(ys.length * 3);
  ys.forEach((y, i) => {
    pos[i * 3] = -0.5 + (i / (ys.length - 1)) * 1.0;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = 0.06;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return g;
})();
const cardPanelEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.5, 1.05, 0.06));

// scatter cloud of measured datapoints (deterministic)
const SCATTER_PTS = (() => {
  const out: [number, number, number][] = [];
  let seed = 19;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 8; i++) {
    const x = -0.8 + (i / 7) * 1.6;
    const y = -0.55 + x * 0.55 + (rnd() - 0.5) * 0.45; // loose upward trend
    out.push([x, y, (rnd() - 0.5) * 0.2]);
  }
  return out;
})();
// scatter fit line (the trend the datapoints feed)
const scatterFitGeo = (() => {
  const pos = new Float32Array(2 * 3);
  pos.set([-0.85, -0.55 + -0.85 * 0.55, 0], 0);
  pos.set([0.85, -0.55 + 0.85 * 0.55, 0], 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return g;
})();

// ---- L0 polish prototypes (toggleable) -----------------------------------
// number of comet puffs in each packet's trailing blaze
const TRAIL_N = 7;

// "balance heroes": per-region hero footprint + halo (size, rest opacity) so the
// three stages read as equal peers and Discovery's halo stops bleeding outward.
const BALANCED: Record<string, { heroScale: number; haloScale: number; haloRest: number }> = {
  discover: { heroScale: 0.15, haloScale: 3.9, haloRest: 0.15 },
  synthesis: { heroScale: 0.64, haloScale: 4.4, haloRest: 0.18 },
  characterize: { heroScale: 0.32, haloScale: 5.9, haloRest: 0.4 },
};

// deterministic phase jitter so evenly-spaced packets stop reading as a "fence"
const pktJitter = (si: number, k: number, K: number) => {
  const r = Math.sin(si * 12.9898 + k * 78.233) * 43758.5453;
  const f = r - Math.floor(r);
  return (((k + (f - 0.5) * 0.7) / K) % 1 + 1) % 1;
};

/**
 * 3D payload packet (prototype) — one per leg, slowly spinning, tinted by the
 * per-position accent gradient. The mesh language encodes the payload's state:
 *   candidate → holographic wireframe unit cell (predicted, in-silico)
 *   material  → solid faceted crystal (the real synthesized sample)
 *   data      → glowing diffraction rings (the measurement fed back)
 */
function Packet3D({
  seg,
  kind,
  dimRef,
  gradient,
  sizeMul,
  spin,
  floatY,
  offset = 0,
  dataGlyph = "rings",
  cellBoost = false,
  trails = false,
  trailLen = 1,
  trailGlow = 0.7,
}: {
  seg: { a: THREE.Vector3; b: THREE.Vector3; ca: THREE.Color; cb: THREE.Color };
  kind: Glyph;
  dimRef: React.MutableRefObject<number>;
  gradient: boolean;
  sizeMul: number;
  spin: number;
  floatY: number;
  offset?: number;
  dataGlyph?: DataGlyph;
  cellBoost?: boolean;
  trails?: boolean;
  trailLen?: number;
  trailGlow?: number;
}) {
  const grp = useRef<THREE.Group>(null);
  // payload (spinning meshes) lives in an inner group so the comet trail can
  // stay aligned to the direction of travel instead of orbiting with the spin
  const spinRef = useRef<THREE.Group>(null);
  // flat data glyphs (trace/card) face the camera instead of spinning edge-on
  const billboardRef = useRef<THREE.Group>(null);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const white = useMemo(() => new THREE.Color(0xffffff), []);
  // comet "blaze" puffs trailing behind the packet, oriented along the leg
  const trailTex = useMemo(() => glowTex(), []);
  const trailRefs = useRef<THREE.Sprite[]>([]);
  const trailQuat = useMemo(() => {
    const dir = seg.b.clone().sub(seg.a).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  }, [seg]);
  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    []
  );
  const glowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    []
  );
  const solidMat = useMemo(
    () => new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.32, metalness: 0.12, emissiveIntensity: 0.4 }),
    []
  );
  // dark translucent backing for the "data card" variant
  const panelMat = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false }),
    []
  );
  const cornerGeo = useMemo(() => new THREE.SphereGeometry(0.12, 10, 10), []);
  const blockGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  // polylines rendered as THREE.Line primitives (the <line> JSX tag collides
  // with the SVG line element type, so we build the objects explicitly)
  const traceLine = useMemo(() => new THREE.Line(traceGeo, lineMat), [lineMat]);
  const traceLine2 = useMemo(() => {
    const l = new THREE.Line(traceGeo, lineMat);
    l.position.set(0, 0.012, 0);
    return l;
  }, [lineMat]);
  const cardPlotLine = useMemo(() => new THREE.Line(cardPlotGeo, lineMat), [lineMat]);
  const scatterFitLine = useMemo(() => new THREE.Line(scatterFitGeo, lineMat), [lineMat]);
  const corners = useMemo(() => {
    const o = 0.5;
    const pts: [number, number, number][] = [];
    for (const x of [-o, o]) for (const y of [-o, o]) for (const z of [-o, o]) pts.push([x, y, z]);
    return pts;
  }, []);
  const tori = [0.45, 0.72, 1.0];

  useFrame((state) => {
    if (!grp.current) return;
    const t = state.clock.elapsedTime;
    let u = (t * 0.1 + offset) % 1;
    if (u < 0) u += 1;
    grp.current.position.lerpVectors(seg.a, seg.b, u);
    grp.current.position.y = floatY;
    const fade = 1 - dimRef.current * 0.92;
    const pktScale = Math.max(0.0001, 1 - dimRef.current);
    if (spinRef.current) {
      spinRef.current.rotation.y = t * spin;
      spinRef.current.scale.setScalar(0.5 * sizeMul * pktScale);
    }
    if (gradient) col.copy(seg.ca).lerp(seg.cb, u).lerp(white, 0.15);
    else col.copy(NEUTRAL_PKT);
    lineMat.color.copy(col);
    lineMat.opacity = 0.95 * fade;
    glowMat.color.copy(col);
    glowMat.opacity = 0.9 * fade;
    solidMat.color.copy(col);
    solidMat.emissive.copy(col);
    solidMat.transparent = fade < 0.99;
    solidMat.opacity = fade;
    panelMat.color.copy(col).multiplyScalar(0.16);
    panelMat.opacity = 0.55 * fade;
    if (billboardRef.current && spinRef.current) {
      // local orientation that makes inner content face the camera in world space
      spinRef.current.getWorldQuaternion(tmpQ).invert();
      billboardRef.current.quaternion.copy(tmpQ).multiply(state.camera.quaternion);
    }
    if (trails) {
      const spacing = 0.26 * trailLen; // world units between puffs
      for (let j = 0; j < TRAIL_N; j++) {
        const sp = trailRefs.current[j];
        if (!sp) continue;
        sp.position.x = -(j + 1) * spacing; // -X is "behind" after trailQuat aligns +X to travel dir
        const decay = 1 - j / TRAIL_N;
        const s = 0.62 * sizeMul * (0.45 + 0.55 * decay) * pktScale;
        sp.scale.set(s, s, 1);
        const m = sp.material as THREE.SpriteMaterial;
        m.color.copy(col);
        m.opacity = trailGlow * decay * decay * fade;
      }
    }
  });

  return (
    <group ref={grp}>
      {trails && (
        <group quaternion={trailQuat}>
          {Array.from({ length: TRAIL_N }, (_, j) => (
            <sprite
              key={j}
              ref={(el) => {
                if (el) trailRefs.current[j] = el;
              }}
            >
              <spriteMaterial map={trailTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
            </sprite>
          ))}
        </group>
      )}
      <group ref={spinRef}>
        {kind === "candidate" && (
          <group scale={cellBoost ? 1.5 : 1}>
            <lineSegments geometry={CELL_EDGES} material={lineMat} />
            {corners.map((p, i) => (
              <mesh key={i} geometry={cornerGeo} material={glowMat} position={p} scale={cellBoost ? 1.35 : 1} />
            ))}
            <mesh geometry={cornerGeo} material={glowMat} scale={cellBoost ? 1.9 : 1.3} />
          </group>
        )}
        {kind === "material" &&
          CHUNK_BLOCKS.map((b, i) => (
            <mesh
              key={i}
              geometry={blockGeo}
              material={solidMat}
              position={b.p}
              rotation={[b.rx, b.ry, b.rz]}
              scale={b.s}
            />
          ))}
        {kind === "data" && dataGlyph === "rings" && (
          <group rotation={[-Math.PI / 2 + 0.4, 0, 0]}>
            {tori.map((r, i) => (
              <mesh key={i} material={glowMat}>
                <torusGeometry args={[r, 0.035, 8, 48]} />
              </mesh>
            ))}
          </group>
        )}
        {kind === "data" && dataGlyph === "bars" &&
          BAR_HEIGHTS.map((h, i) => {
            const x = (i - (BAR_HEIGHTS.length - 1) / 2) * BAR_GAP;
            return (
              <mesh
                key={i}
                geometry={UNIT_BOX}
                material={glowMat}
                position={[x, -0.6 + h / 2, 0]}
                scale={[BAR_W, h, BAR_W]}
              />
            );
          })}
        {kind === "data" && dataGlyph === "trace" && (
          <group ref={billboardRef}>
            <primitive object={traceLine} />
            <primitive object={traceLine2} />
          </group>
        )}
        {kind === "data" && dataGlyph === "card" && (
          <group ref={billboardRef}>
            <mesh geometry={UNIT_BOX} material={panelMat} scale={[1.5, 1.05, 0.06]} />
            <lineSegments geometry={cardPanelEdges} material={lineMat} />
            <primitive object={cardPlotLine} />
          </group>
        )}
        {kind === "data" && dataGlyph === "db" &&
          [-0.36, 0, 0.36].map((y, i) => (
            <mesh key={i} geometry={DISK_GEO} material={solidMat} position={[0, y, 0]} />
          ))}
        {kind === "data" && dataGlyph === "scatter" && (
          <>
            <primitive object={scatterFitLine} />
            {SCATTER_PTS.map((p, i) => (
              <mesh key={i} geometry={DOT_GEO} material={glowMat} position={p} />
            ))}
          </>
        )}
      </group>
    </group>
  );
}

function RegionTotem({
  region,
  pos,
  hovered,
  focused,
  anyHover,
  focusActive,
  anchor,
  balance,
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
  balance: boolean;
  onOver: () => void;
  onOut: () => void;
  onSelect: () => void;
}) {
  const accent = region.node.accent ?? "#5fa8ff";
  const bal = balance ? BALANCED[region.id] : undefined;
  const heroScaleEff = bal?.heroScale ?? region.heroScale;
  const haloScaleVal = bal?.haloScale ?? 5.2;
  const haloRest = bal?.haloRest ?? 0.28;
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
    if (heroRef.current) heroRef.current.scale.setScalar(heroScaleEff * cur.current);
    if (haloRef.current) {
      const m = haloRef.current.material as THREE.SpriteMaterial;
      const tHalo = focused ? 0.95 : mutedByFocus ? 0.03 : hovered ? 0.85 : dim ? 0.05 : haloRest;
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
      <sprite ref={haloRef} position={[0, region.heroLift * 0.9, 0]} scale={[haloScaleVal, haloScaleVal, 1]}>
        <spriteMaterial map={halo} color={accentCol} transparent opacity={haloRest} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* floating hero */}
      <group ref={heroRef} position={[0, region.heroLift, 0]} scale={heroScaleEff}>
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

// payload glyph carried on each leg of the loop (matches segment order:
// discover→synthesis, synthesis→characterize, characterize→discover)
const SEG_GLYPH: Glyph[] = ["candidate", "material", "data"];

type PacketMode = "dots" | "glyphs" | "3d";

function Conduits({
  dimRef,
  mode,
  gradient,
  activeOnly,
  focusId,
  size,
  spin,
  floatY,
  count,
  dataGlyph,
  cellBoost,
  trails,
  trailLen,
  trailGlow,
}: {
  dimRef: React.MutableRefObject<number>;
  mode: PacketMode;
  gradient: boolean;
  activeOnly: boolean;
  focusId: string | null;
  size: number;
  spin: number;
  floatY: number;
  count: number;
  dataGlyph: DataGlyph;
  cellBoost: boolean;
  trails: boolean;
  trailLen: number;
  trailGlow: number;
}) {
  const glyph = mode === "glyphs";
  // each segment carries the accent of the stage at each end, so the line and
  // its packets bleed from one stage's color into the next along their length.
  const segs = useMemo(
    () =>
      POS.map((_, i) => {
        const a = POS[i];
        const b = POS[(i + 1) % POS.length];
        const ca = new THREE.Color(L0_REGIONS[i].node.accent ?? "#5fa8ff");
        const cb = new THREE.Color(L0_REGIONS[(i + 1) % L0_REGIONS.length].node.accent ?? "#5fa8ff");
        return { a: new THREE.Vector3(a[0], 0.2, a[1]), b: new THREE.Vector3(b[0], 0.2, b[1]), ca, cb };
      }),
    []
  );

  // a leg is "active" when the focused stage is one of its two endpoints
  const activeIdx = focusId ? L0_REGIONS.findIndex((r) => r.id === focusId) : -1;
  const isActive = (si: number) => activeIdx >= 0 && (si === activeIdx || (si + 1) % segs.length === activeIdx);
  const segVisible = (si: number) => !activeOnly || isActive(si);

  // packets carried per leg (tunable from the lab panel)
  const K = Math.max(1, Math.round(count));
  const total = segs.length * K;
  const inst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pktCol = useMemo(() => new THREE.Color(), []);
  const white = useMemo(() => new THREE.Color(0xffffff), []);
  const lineRefs = useRef<Array<{ material?: THREE.Material & { opacity: number } }>>([]);
  const glyphRefs = useRef<THREE.Sprite[]>([]);

  // flat list of glyph packets (segment index + phase offset), glyph mode only
  const glyphPackets = useMemo(() => {
    const arr: { si: number; off: number; kind: Glyph }[] = [];
    segs.forEach((_, si) => {
      for (let k = 0; k < K; k++) arr.push({ si, off: k / K, kind: SEG_GLYPH[si] ?? "candidate" });
    });
    return arr;
  }, [segs, K]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const fade = 1 - dimRef.current * 0.92;
    const pktScale = Math.max(0.0001, 1 - dimRef.current);
    lineRefs.current.forEach((l) => {
      if (l?.material) l.material.opacity = 0.62 * fade;
    });

    if (inst.current) {
      let idx = 0;
      for (let si = 0; si < segs.length; si++) {
        const seg = segs[si];
        const vis = segVisible(si);
        for (let k = 0; k < K; k++) {
          let u = (t * 0.12 + k / K) % 1;
          if (u < 0) u += 1;
          dummy.position.lerpVectors(seg.a, seg.b, u);
          dummy.scale.setScalar(vis ? size * pktScale : 0);
          dummy.updateMatrix();
          inst.current.setMatrixAt(idx, dummy.matrix);
          if (gradient) pktCol.copy(seg.ca).lerp(seg.cb, u).lerp(white, 0.12);
          else pktCol.copy(NEUTRAL_PKT);
          inst.current.setColorAt(idx, pktCol);
          idx++;
        }
      }
      inst.current.instanceMatrix.needsUpdate = true;
      if (inst.current.instanceColor) inst.current.instanceColor.needsUpdate = true;
    }

    if (glyph) {
      for (let i = 0; i < glyphPackets.length; i++) {
        const sp = glyphRefs.current[i];
        if (!sp) continue;
        const g = glyphPackets[i];
        const seg = segs[g.si];
        let u = (t * 0.12 + g.off) % 1;
        if (u < 0) u += 1;
        sp.position.lerpVectors(seg.a, seg.b, u);
        sp.position.y = 0.55; // float just above the conduit
        const s = segVisible(g.si) ? 0.85 * size * pktScale : 0;
        sp.scale.set(s, s, 1);
        const m = sp.material as THREE.SpriteMaterial;
        if (gradient) pktCol.copy(seg.ca).lerp(seg.cb, u).lerp(white, 0.1);
        else pktCol.copy(NEUTRAL_PKT);
        m.color.copy(pktCol);
        m.opacity = 0.97 * fade;
      }
    }
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

      {mode === "dots" && (
        <instancedMesh ref={inst} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, total]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color={0xffffff} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
        </instancedMesh>
      )}

      {mode === "glyphs" &&
        glyphPackets.map((g, i) => (
          <sprite
            key={i}
            ref={(el) => {
              if (el) glyphRefs.current[i] = el;
            }}
            scale={[0.85, 0.85, 1]}
          >
            <spriteMaterial map={glyphTex(g.kind)} transparent opacity={0.95} depthWrite={false} />
          </sprite>
        ))}

      {mode === "3d" &&
        segs.map((seg, i) =>
          segVisible(i)
            ? Array.from({ length: K }, (_, k) => (
                <Packet3D
                  key={`${i}-${k}`}
                  seg={seg}
                  kind={SEG_GLYPH[i] ?? "candidate"}
                  dimRef={dimRef}
                  gradient={gradient}
                  sizeMul={size}
                  spin={spin}
                  floatY={floatY}
                  offset={cellBoost ? pktJitter(i, k, K) : k / K}
                  dataGlyph={dataGlyph}
                  cellBoost={cellBoost}
                  trails={trails}
                  trailLen={trailLen}
                  trailGlow={trailGlow}
                />
              ))
            : null
        )}
    </group>
  );
}

function CameraRig({ focus, focusId, shift, dist, lift, freeHome }: { focus: THREE.Vector3 | null; focusId: string | null; shift: number; dist: number; lift: number; freeHome: boolean }) {
  const { camera } = useThree();
  const three = useThree() as unknown as { controls?: { target: THREE.Vector3; update: () => void; enabled: boolean } };
  const goalPos = useMemo(() => new THREE.Vector3(), []);
  const goalTgt = useMemo(() => new THREE.Vector3(), []);
  const arrived = useRef(false);
  const homed = useRef(false);

  useEffect(() => {
    arrived.current = false;
    homed.current = false;
  }, [focusId]);

  useFrame(() => {
    const c = three.controls;
    if (!c) return;
    if (focus) {
      // shift left (room for a side panel) and drop the look-at point (lift the
      // asset toward the top of the frame, clearing a bottom sheet on mobile).
      goalTgt.copy(focus).addScaledVector(SCREEN_RIGHT, -shift).addScaledVector(WORLD_UP, -lift);
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
    } else if (freeHome) {
      // overview: glide back to the home framing once, then hand control to the
      // user for free orbit + zoom (don't keep yanking it back).
      if (!homed.current) {
        c.enabled = false;
        camera.position.lerp(HOME_CAM, 0.12);
        c.target.lerp(HOME_TGT, 0.12);
        c.update();
        if (camera.position.distanceTo(HOME_CAM) < 0.6) {
          homed.current = true;
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
  packetMode,
  packetGradient,
  packetActiveOnly,
  packetSize,
  packetSpin,
  packetFloat,
  packetCount,
  packetDataGlyph,
  balanceHeroes,
  cellBoost,
  trails,
  trailLen,
  trailGlow,
  diveShift,
  diveDist,
  diveLift,
  freeHome,
  onUserInteract,
}: {
  hover: string | null;
  setHover: (id: string | null) => void;
  focusId: string | null;
  onSelect: (id: string) => void;
  interactive: boolean;
  anchor: Anchor;
  packetMode: PacketMode;
  packetGradient: boolean;
  packetActiveOnly: boolean;
  packetSize: number;
  packetSpin: number;
  packetFloat: number;
  packetCount: number;
  packetDataGlyph: DataGlyph;
  balanceHeroes: boolean;
  cellBoost: boolean;
  trails: boolean;
  trailLen: number;
  trailGlow: number;
  diveShift: number;
  diveDist: number;
  diveLift: number;
  freeHome: boolean;
  onUserInteract: () => void;
}) {
  const focusActive = focusId !== null;
  const dimRef = useRef(0);
  useFrame(() => {
    dimRef.current += ((focusActive ? 1 : 0) - dimRef.current) * 0.08;
  });

  const focusPos = useMemo(() => {
    if (!focusId) return null;
    const i = L0_REGIONS.findIndex((r) => r.id === focusId);
    if (i < 0) return null;
    return new THREE.Vector3(POS[i][0], L0_REGIONS[i].heroLift, POS[i][1]);
  }, [focusId]);

  return (
    <>
      <color attach="background" args={["#04060d"]} />
      <fog attach="fog" args={["#04060d", 30, 72]} />

      <ambientLight intensity={0.55} />
      <hemisphereLight args={[0x88aaff, 0x202838, 0.45]} />
      <directionalLight position={[6, 12, 6]} intensity={0.7} />

      <Conduits
        dimRef={dimRef}
        mode={packetMode}
        gradient={packetGradient}
        activeOnly={packetActiveOnly}
        focusId={focusId}
        size={packetSize}
        spin={packetSpin}
        floatY={packetFloat}
        count={packetCount}
        dataGlyph={packetDataGlyph}
        cellBoost={cellBoost}
        trails={trails}
        trailLen={trailLen}
        trailGlow={trailGlow}
      />

      {L0_REGIONS.map((region, i) => (
        <RegionTotem
          key={region.id}
          region={region}
          pos={POS[i]}
          hovered={hover === region.id}
          focused={focusId === region.id}
          anyHover={hover !== null}
          focusActive={focusActive}
          anchor={anchor}
          balance={balanceHeroes}
          onOver={() => interactive && !focusActive && setHover(region.id)}
          onOut={() => setHover(null)}
          onSelect={() => interactive && onSelect(region.id)}
        />
      ))}

      <OrbitControls
        makeDefault
        enablePan={false}
        enableRotate={EXPLORE_FREE_ORBIT}
        enableZoom={EXPLORE_FREE_ORBIT}
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={40}
        minPolarAngle={0.15}
        maxPolarAngle={1.42}
        target={[0, 0.8, 2.8]}
        onStart={onUserInteract}
      />
      <CameraRig focus={focusPos} focusId={focusId} shift={diveShift} dist={diveDist} lift={diveLift} freeHome={freeHome} />
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

// True on phone-sized viewports — used to switch to a Tour-first, bottom-sheet layout.
function useIsCompact() {
  const [compact, setCompact] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setCompact(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return compact;
}

// Widen the camera FOV on narrow / portrait viewports so the wide loop still fits the frame.
function FovFit() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    cam.fov = aspect >= 1.2 ? 38 : aspect >= 0.85 ? 48 : 60;
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

export default function LivingMap() {
  const navigate = useNavigate();
  const isCompact = useIsCompact();
  const [showMobileNote, setShowMobileNote] = useState(true);
  const [mode, setMode] = useState<Mode>("tour");
  const [hover, setHover] = useState<string | null>(null);
  const [exploreFocus, setExploreFocus] = useState<string | null>(null);
  const [tourIdx, setTourIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  // L0 visual config — locked in from the /lab playground
  const anchor: Anchor = "disc";
  const packets: PacketMode = "3d";
  const packetGradient = true;
  const packetActiveOnly = false;
  const packetSize = 0.5;
  const packetSpin = 0.6;
  const packetFloat = 0.78;
  const packetCount = 4;
  const packetDataGlyph: DataGlyph = "trace";
  const balanceHeroes = false;
  const cellBoost = false;
  const trails = false;
  const trailLen = 1.15;
  const trailGlow = 0.5;

  const inTour = mode === "tour";
  const stop = TOUR_STOPS[tourIdx];
  // the camera target: tour-driven in Tour mode, click-driven in Explore mode
  const focusId = inTour ? stop.focusId : exploreFocus;
  const focusActive = focusId !== null;
  const exploreFocusActive = !inTour && exploreFocus !== null;
  const focusRegion = !inTour && exploreFocus ? regionByIdL0(exploreFocus) : undefined;

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
    const order = L0_REGIONS.map((r) => r.id);
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
        dpr={isCompact ? [1, 1.5] : [1, 2]}
        gl={{ antialias: true }}
        onPointerMissed={() => !inTour && setExploreFocus(null)}
      >
        <FovFit />
        <World
          hover={hover}
          setHover={setHover}
          focusId={focusId}
          onSelect={setExploreFocus}
          interactive={!inTour}
          anchor={anchor}
          packetMode={packets}
          packetGradient={packetGradient}
          packetActiveOnly={packetActiveOnly}
          packetSize={packetSize}
          packetSpin={packetSpin}
          packetFloat={packetFloat}
          packetCount={packetCount}
          packetDataGlyph={packetDataGlyph}
          balanceHeroes={balanceHeroes}
          cellBoost={cellBoost}
          trails={trails}
          trailLen={trailLen}
          trailGlow={trailGlow}
          diveShift={inTour || isCompact ? 0 : DIVE_SHIFT}
          diveDist={inTour ? 9 : DIVE_DIST}
          diveLift={!inTour && isCompact ? 1.15 : 0}
          freeHome={EXPLORE_FREE_ORBIT && !inTour && focusId === null}
          onUserInteract={() => {
            if (inTour) setPlaying(false);
          }}
        />
      </Canvas>

      {/* ---- OS chrome ---- */}
      {/* brand */}
      <div className={`pointer-events-none absolute left-5 top-4 flex items-center gap-3 transition-opacity duration-500 ${chromeFade(!exploreFocusActive)}`}>
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-sky-400/40 bg-sky-400/10 text-sky-300">◆</div>
        <div className="hidden sm:block">
          <div className="text-sm font-semibold tracking-wide text-white">MATERIALS SCIENCE MAP</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Discover ⇄ Synthesize ⇄ Characterize</div>
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

      {/* best-on-desktop nudge (compact screens only, dismissible) */}
      {isCompact && showMobileNote && (
        <div className="absolute left-1/2 top-[68px] z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-[rgba(8,12,22,0.82)] px-3 py-1.5 text-[11px] text-slate-300 backdrop-blur-md">
          <span>Best viewed on a larger screen</span>
          <button
            onClick={() => setShowMobileNote(false)}
            aria-label="Dismiss"
            className="grid h-4 w-4 place-items-center rounded-full text-slate-500 transition hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* orbit hint (Explore overview only) */}
      <div className={`pointer-events-none absolute bottom-5 left-5 text-[11px] text-slate-500 transition-opacity duration-500 ${chromeFade(exploreChrome)}`}>
        {isCompact ? "Tap a stage to open" : "Hover a stage to focus · click to fly in · ← → to step stages"}
      </div>

      {/* credit */}
      <a
        href="https://x.com/vasa_develop"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-5 right-5 z-10 text-[11px] text-slate-500 transition-colors hover:text-slate-300"
      >
        made by vasa
      </a>

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
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, y: 28 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="absolute inset-x-3 bottom-3 z-10 sm:inset-x-auto sm:bottom-auto sm:left-6 sm:top-1/2 sm:w-[min(400px,40vw)] sm:-translate-y-1/2"
            >
              <div
                className="max-h-[52vh] overflow-y-auto rounded-2xl border bg-[rgba(7,10,18,0.82)] p-4 backdrop-blur-xl sm:max-h-[80vh] sm:bg-[rgba(7,10,18,0.74)] sm:p-5"
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

                <h2 className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-3xl">{focusRegion.node.title}</h2>
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
