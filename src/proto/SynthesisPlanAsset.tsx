import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Synthesis Planning. A retrosynthesis route map — a glowing target
 * crystal at the apex branches down through reaction edges into precursor
 * formulas. One root-to-leaves path lights up as the chosen recipe (two
 * precursors converge through an intermediate into the target) while a dim
 * alternative route sits beside it. Verb: turn a target into a recipe.
 */

const AMBER = "#fbbf24";
const HOT = new THREE.Color("#ffd97a");
const DIM = new THREE.Color(AMBER).multiplyScalar(0.26);

type Node = { id: string; pos: [number, number, number]; formula?: string };

const NODES: Record<string, Node> = {
  target: { id: "target", pos: [0, 1.4, 0] },
  i0: { id: "i0", pos: [-0.95, 0.12, 0] }, // alternative intermediate (dim)
  i1: { id: "i1", pos: [0.95, 0.12, 0] }, // chosen intermediate (hot)
  p0: { id: "p0", pos: [-1.6, -1.3, 0], formula: "TiO2" },
  p1: { id: "p1", pos: [-0.55, -1.3, 0], formula: "LiOH" },
  p2: { id: "p2", pos: [0.45, -1.3, 0], formula: "Li2CO3" },
  p3: { id: "p3", pos: [1.65, -1.3, 0], formula: "Co3O4" },
};

// edges: [from, to, hot]
const EDGES: [string, string, boolean][] = [
  ["target", "i0", false],
  ["target", "i1", true],
  ["i0", "p0", false],
  ["i0", "p1", false],
  ["i1", "p2", true],
  ["i1", "p3", true],
];

// hot edges, oriented child -> parent (recipe flows upward toward the target)
const FLOW: [string, string][] = [
  ["p2", "i1"],
  ["p3", "i1"],
  ["i1", "target"],
];

const N_PACKETS = 7;

const GLYPH_W = 200;
const GLYPH_H = 80;
const GLYPH_ASPECT = GLYPH_W / GLYPH_H;

function glyphTexture(text: string): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = GLYPH_W;
  cv.height = GLYPH_H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#fde9b8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur = 10;
  ctx.font = "bold 46px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(text, GLYPH_W / 2, GLYPH_H / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

function v3(n: Node) {
  return new THREE.Vector3(...n.pos);
}

function RouteGraph({ billboard }: { billboard: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();

  // edge lines with per-vertex colour (hot vs dim)
  const edgeGeo = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    for (const [a, b, hot] of EDGES) {
      const pa = NODES[a].pos;
      const pb = NODES[b].pos;
      pos.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]);
      const c = hot ? HOT : DIM;
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
    return g;
  }, []);

  // packets travelling up the hot path
  const packets = useMemo(
    () =>
      new Array(N_PACKETS).fill(0).map((_, i) => ({
        edge: i % FLOW.length,
        offset: Math.random(),
      })),
    []
  );
  const packetRefs = useRef<THREE.Mesh[]>([]);

  const targetRef = useRef<THREE.Mesh>(null);
  const targetMat = useRef<THREE.MeshStandardMaterial>(null);
  const haloRef = useRef<THREE.Sprite>(null);

  const soft = useMemo(() => {
    const s = 128;
    const cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const ctx = cv.getContext("2d")!;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(cv);
  }, []);

  const formulaTex = useMemo(() => {
    const out: Record<string, THREE.Texture> = {};
    for (const n of Object.values(NODES)) if (n.formula) out[n.id] = glyphTexture(n.formula);
    return out;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (billboard && group.current) group.current.quaternion.copy(camera.quaternion);

    const pulse = 0.5 + 0.5 * Math.sin(t * 1.8);
    if (targetRef.current) {
      const s = 0.2 * (1 + 0.08 * pulse);
      targetRef.current.scale.setScalar(s);
      targetRef.current.rotation.y = t * 0.5;
      targetRef.current.rotation.x = t * 0.22;
    }
    if (targetMat.current) targetMat.current.emissiveIntensity = 0.9 + 0.6 * pulse;
    if (haloRef.current) {
      const m = haloRef.current.material as THREE.SpriteMaterial;
      m.opacity = 0.4 + 0.25 * pulse;
      const hs = 0.95 + 0.12 * pulse;
      haloRef.current.scale.set(hs, hs, 1);
    }

    for (let i = 0; i < packets.length; i++) {
      const mesh = packetRefs.current[i];
      if (!mesh) continue;
      const p = packets[i];
      const [from, to] = FLOW[p.edge];
      let u = (t * 0.45 + p.offset) % 1;
      if (u < 0) u += 1;
      const a = v3(NODES[from]);
      const b = v3(NODES[to]);
      mesh.position.lerpVectors(a, b, u);
      const m = mesh.material as THREE.MeshBasicMaterial;
      // fade in/out at the ends so packets don't pop
      m.opacity = Math.sin(Math.min(1, u / 0.12) * Math.PI * 0.5) * (1 - Math.max(0, (u - 0.88) / 0.12));
    }
  });

  return (
    <group ref={group}>
      {/* reaction edges */}
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      {/* intermediate nodes */}
      {(["i0", "i1"] as const).map((id) => (
        <mesh key={id} position={NODES[id].pos}>
          <sphereGeometry args={[id === "i1" ? 0.1 : 0.08, 20, 20]} />
          <meshStandardMaterial
            color={AMBER}
            emissive={AMBER}
            emissiveIntensity={id === "i1" ? 1.1 : 0.35}
            roughness={0.4}
            metalness={0.2}
            transparent
            opacity={id === "i1" ? 1 : 0.55}
          />
        </mesh>
      ))}

      {/* precursor nodes + formula tokens */}
      {(["p0", "p1", "p2", "p3"] as const).map((id) => {
        const hot = id === "p2" || id === "p3";
        const n = NODES[id];
        return (
          <group key={id}>
            <mesh position={n.pos}>
              <sphereGeometry args={[0.07, 18, 18]} />
              <meshStandardMaterial
                color={AMBER}
                emissive={AMBER}
                emissiveIntensity={hot ? 0.9 : 0.3}
                roughness={0.5}
                metalness={0.1}
                transparent
                opacity={hot ? 1 : 0.5}
              />
            </mesh>
            <sprite position={[n.pos[0], n.pos[1] - 0.34, n.pos[2]]} scale={[0.62 * GLYPH_ASPECT * 0.42, 0.62 * 0.42, 1]}>
              <spriteMaterial map={formulaTex[id]} transparent opacity={hot ? 0.95 : 0.4} depthWrite={false} />
            </sprite>
          </group>
        );
      })}

      {/* flowing recipe packets */}
      {packets.map((_, i) => (
        <mesh key={i} ref={(m) => (packetRefs.current[i] = m!)}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color={"#fff1c2"} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}

      {/* target crystal + halo */}
      <sprite ref={haloRef} position={NODES.target.pos} scale={[1, 1, 1]}>
        <spriteMaterial map={soft} color={AMBER} transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh ref={targetRef} position={NODES.target.pos}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          ref={targetMat}
          color={"#fff4cf"}
          emissive={AMBER}
          emissiveIntensity={1.1}
          roughness={0.25}
          metalness={0.5}
          flatShading
        />
      </mesh>
    </group>
  );
}

/** Content only (no lights/camera), for embedding as a node in the shared map. */
export function SynthesisPlanMapScene() {
  return <RouteGraph billboard />;
}

export default function SynthesisPlanAsset() {
  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0.5, 7.4], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={0.7} />
        <pointLight position={[-3, -2, 2]} intensity={0.35} color={0xffd27a} />
        <RouteGraph billboard={false} />
        <OrbitControls enablePan={false} enableZoom minDistance={2.5} maxDistance={12} target={[0, 0.5, 0]} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 text-sm text-slate-300">
          Synthesis Planning — target branches into a chosen recipe
        </div>
      </div>
    </>
  );
}
