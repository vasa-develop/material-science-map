import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Enabling Foundations. Three intertwined glyph-rings — physics,
 * chemistry, computer science — slowly orbiting around a shared core, each
 * carrying its discipline's symbols. Verb: slow orbit.
 */

function glyph(text: string): { tex: THREE.Texture; aspect: number } {
  const px = 48;
  const cv = document.createElement("canvas");
  const tmp = cv.getContext("2d")!;
  tmp.font = `600 ${px}px ui-sans-serif, system-ui, sans-serif`;
  const w = Math.ceil(tmp.measureText(text).width) + 26;
  const h = px + 22;
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 10;
  ctx.font = `600 ${px}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return { tex, aspect: w / h };
}

interface RingDef {
  color: number;
  orient: [number, number, number];
  glyphs: string[];
  dir: number;
}

const RINGS: RingDef[] = [
  { color: 0x5fa8ff, orient: [0, 0, 0], glyphs: ["\u210f", "\u2207\u00b2", "\u03bb", "\u03c8", "\u2202"], dir: 1 },
  { color: 0x5fe089, orient: [Math.PI / 2.3, 0, 0], glyphs: ["\u269b", "H\u2082O", "NaCl", "mol", "pH"], dir: -1 },
  { color: 0xc08cff, orient: [-Math.PI / 2.3, Math.PI / 3, 0], glyphs: ["010", "{ }", "if", "\u2211", "\u2192"], dir: 1 },
];
const RR = 1.25;

function Ring({ def, speed }: { def: RingDef; speed: number }) {
  const spinner = useRef<THREE.Group>(null);
  const glyphs = useMemo(() => def.glyphs.map((g) => glyph(g)), [def.glyphs]);
  const tint = useMemo(() => new THREE.Color(def.color).lerp(new THREE.Color(0xffffff), 0.35), [def.color]);

  useFrame((state) => {
    if (spinner.current) spinner.current.rotation.z = state.clock.elapsedTime * 0.25 * def.dir * speed;
  });

  const n = def.glyphs.length;
  return (
    <group rotation={def.orient}>
      <mesh>
        <torusGeometry args={[RR, 0.025, 16, 96]} />
        <meshBasicMaterial color={def.color} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <group ref={spinner}>
        {glyphs.map((gl, i) => {
          const a = (i / n) * Math.PI * 2;
          const x = Math.cos(a) * RR;
          const y = Math.sin(a) * RR;
          return (
            <group key={i} position={[x, y, 0]}>
              <mesh>
                <sphereGeometry args={[0.05, 12, 12]} />
                <meshBasicMaterial color={def.color} />
              </mesh>
              <sprite position={[0, 0, 0.001]} scale={[gl.aspect * 0.36, 0.36, 1]}>
                <spriteMaterial map={gl.tex} transparent depthWrite={false} color={tint} />
              </sprite>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function Rig({ speed }: { speed: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.elapsedTime * 0.12 * speed;
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.15;
    }
  });
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshBasicMaterial color={0xffffff} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.34, 20, 20]} />
        <meshBasicMaterial color={0x9fd6ff} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {RINGS.map((r, i) => (
        <Ring key={i} def={r} speed={speed} />
      ))}
    </group>
  );
}

export default function FoundationsAsset() {
  const [speed, setSpeed] = useState(1);
  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0.4, 4.4], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.6} />
        <pointLight position={[3, 3, 4]} intensity={0.5} color={0x88aaff} />
        <Rig speed={speed} />
        <OrbitControls enablePan={false} enableZoom minDistance={3} maxDistance={10} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Enabling foundations — physics · chemistry · computer science</div>
          <div className="pointer-events-auto inline-flex items-center gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <span className="w-16 text-xs text-slate-400">orbit</span>
            <input type="range" min={0.2} max={3} step={0.05} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-36 accent-sky-400" />
            <span className="text-[11px] tabular-nums text-slate-500">{speed.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#5fa8ff" }} />physics</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#5fe089" }} />chemistry</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#c08cff" }} />CS</span>
          </div>
        </div>
      </div>
    </>
  );
}
