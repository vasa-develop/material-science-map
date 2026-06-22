import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Vapor & Thin-Film. Atoms condense out of a drifting vapor cloud and
 * snap into ordered crystalline layers on a substrate, the film thickening
 * layer by layer; once grown it sublimes away and the cycle repeats. Verb:
 * grow a film atom-layer by layer from the gas phase.
 */

const BLUE = "#38bdf8";
const VAPOR = new THREE.Color("#2b6f9e");
const FLASH = new THREE.Color("#cdeeff");
const SETTLED = new THREE.Color("#7dd3fc");

const GRID = 6;
const LAYERS = 4;
const CELLS = GRID * GRID;
const TOTAL = CELLS * LAYERS;

const SPACING = 0.2;
const ATOM_R = 0.062;
const BASE_Y = -0.42; // top surface of the substrate
const LAYER_H = 0.17;
const HALF = ((GRID - 1) * SPACING) / 2;

const PERIOD = 9; // full grow + sublime cycle

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

type Atom = {
  oi: number; // global deposition order
  target: THREE.Vector3;
  vapor: THREE.Vector3; // home position while still gaseous
  drift: number;
};

function buildAtoms(): Atom[] {
  const atoms: Atom[] = [];
  for (let ly = 0; ly < LAYERS; ly++) {
    const order = Array.from({ length: CELLS }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (let k = 0; k < CELLS; k++) {
      const cell = order[k];
      const gx = (cell / GRID) | 0;
      const gz = cell % GRID;
      const target = new THREE.Vector3(
        gx * SPACING - HALF,
        BASE_Y + ly * LAYER_H + ATOM_R,
        gz * SPACING - HALF
      );
      const vapor = new THREE.Vector3(
        (Math.random() * 2 - 1) * HALF * 1.5,
        BASE_Y + LAYERS * LAYER_H + 0.2 + Math.random() * 0.9,
        (Math.random() * 2 - 1) * HALF * 1.5
      );
      atoms.push({ oi: ly * CELLS + k, target, vapor, drift: Math.random() * 6.28 });
    }
  }
  return atoms;
}

function ThinFilm() {
  const inst = useRef<THREE.InstancedMesh>(null);
  const atoms = useMemo(() => buildAtoms(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const haloRef = useRef<THREE.Sprite>(null);

  const soft = useMemo(() => {
    const s = 128;
    const cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const ctx = cv.getContext("2d")!;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.5, "rgba(255,255,255,0.3)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(cv);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const mesh = inst.current;
    if (!mesh) return;

    const p = (t / PERIOD) % 1;
    const filledF = clamp01(p / 0.78) * TOTAL; // deposition completes by p=0.78
    const dissolve = clamp01((p - 0.84) / 0.16); // then sublime away

    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      const local = filledF - a.oi; // >1 settled, (0,1) landing, <=0 still vapor

      let scale: number;
      if (local >= 1) {
        // settled into the lattice
        tmp.copy(a.target);
        scale = ATOM_R * (1 - dissolve);
        if (dissolve > 0) tmp.y += dissolve * 0.5; // sublime upward as it fades
        col.copy(SETTLED);
      } else if (local > 0) {
        // condensing: fall from the vapor home onto its lattice site
        const f = smooth(local);
        tmp.copy(a.vapor).lerp(a.target, f);
        scale = ATOM_R * (0.5 + 0.5 * f);
        col.copy(VAPOR).lerp(FLASH, f);
      } else {
        // still gaseous — drift in the cloud above
        tmp.copy(a.vapor);
        tmp.x += Math.sin(t * 0.8 + a.drift) * 0.06;
        tmp.y += Math.sin(t * 0.6 + a.drift * 1.7) * 0.05;
        tmp.z += Math.cos(t * 0.7 + a.drift) * 0.06;
        scale = ATOM_R * 0.5;
        col.copy(VAPOR);
      }

      dummy.position.copy(tmp);
      dummy.scale.setScalar(Math.max(0.0001, scale));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    if (haloRef.current) {
      const grow = clamp01(p / 0.78) * (1 - dissolve);
      (haloRef.current.material as THREE.SpriteMaterial).opacity = 0.15 + 0.3 * grow;
    }
  });

  return (
    <group>
      {/* substrate */}
      <mesh position={[0, BASE_Y - 0.05, 0]}>
        <boxGeometry args={[HALF * 2 + 0.28, 0.08, HALF * 2 + 0.28]} />
        <meshStandardMaterial color={"#0e3550"} emissive={BLUE} emissiveIntensity={0.18} roughness={0.5} metalness={0.4} />
      </mesh>
      {/* glowing substrate rim */}
      <lineSegments position={[0, BASE_Y - 0.01, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(HALF * 2 + 0.28, 0.08, HALF * 2 + 0.28)]} />
        <lineBasicMaterial color={BLUE} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      {/* soft glow over the growing film */}
      <sprite ref={haloRef} position={[0, BASE_Y + 0.35, 0]} scale={[1.7, 1.1, 1]}>
        <spriteMaterial map={soft} color={BLUE} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      <instancedMesh ref={inst} args={[undefined, undefined, TOTAL]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color={"#ffffff"} emissive={BLUE} emissiveIntensity={0.4} roughness={0.3} metalness={0.2} />
      </instancedMesh>
    </group>
  );
}

/** Content only (no lights/camera), for embedding as a node in the shared map. */
export function ThinFilmGrowthMapScene() {
  return <ThinFilm />;
}

export default function ThinFilmGrowthAsset() {
  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0.7, 4.2], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 6, 4]} intensity={0.85} />
        <pointLight position={[-3, 1, 2]} intensity={0.5} color={0x7dd3fc} />
        <ThinFilm />
        <OrbitControls enablePan={false} enableZoom minDistance={2} maxDistance={10} target={[0, 0.1, 0]} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 text-sm text-slate-300">
          Vapor & Thin-Film — atoms stack into ordered layers
        </div>
      </div>
    </>
  );
}
