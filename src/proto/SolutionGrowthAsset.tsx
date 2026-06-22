import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Solution & Hydrothermal. A faceted crystal grows inside a soft glowing
 * droplet of liquid; dissolved ion specks drift in from the medium and attach
 * to its faces (fading as they're incorporated), while the crystal slowly
 * breathes/grows. Verb: crystallize a phase out of solution at mild temperature.
 */

const GREEN = "#34d399";
const TEAL = "#6ee7d0";
const WHITE = "#eafff7";

const R_MEDIUM = 1.2; // droplet radius
const R_EDGE = 1.06; // where ions spawn
const R_CORE = 0.32; // where ions attach to the crystal
const N_IONS = 30;

function softTex(): THREE.Texture {
  const s = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(cv);
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function CrystalInSolution() {
  const crystalRef = useRef<THREE.Group>(null);
  const crystalMat = useRef<THREE.MeshStandardMaterial>(null);
  const edgeMat = useRef<THREE.LineBasicMaterial>(null);
  const ionRefs = useRef<THREE.Mesh[]>([]);
  const haloRef = useRef<THREE.Sprite>(null);

  const soft = useMemo(() => softTex(), []);

  // crystal geometry: an elongated octahedron (bipyramid) + its glowing edges
  const crystalGeo = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(crystalGeo), [crystalGeo]);

  const ions = useMemo(
    () =>
      new Array(N_IONS).fill(0).map(() => {
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        return {
          dir: new THREE.Vector3(r * Math.cos(th), u * 0.7, r * Math.sin(th)).normalize(),
          offset: Math.random(),
          speed: 0.12 + Math.random() * 0.1,
          white: Math.random() < 0.3,
          spin: Math.random() * 6.28,
        };
      }),
    []
  );

  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // crystal slowly rotates and breathes (grows)
    const grow = 0.82 + 0.12 * Math.sin(t * 0.6);
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 0.35;
      crystalRef.current.rotation.x = 0.3 + 0.12 * Math.sin(t * 0.4);
      crystalRef.current.scale.set(grow * 0.55, grow * 0.82, grow * 0.55);
    }
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.5);
    if (crystalMat.current) crystalMat.current.emissiveIntensity = 0.4 + 0.3 * pulse;
    if (edgeMat.current) edgeMat.current.opacity = 0.7 + 0.3 * pulse;
    if (haloRef.current) {
      (haloRef.current.material as THREE.SpriteMaterial).opacity = 0.3 + 0.15 * pulse;
    }

    // ions drift inward from the medium and attach to the crystal
    for (let i = 0; i < ions.length; i++) {
      const m = ionRefs.current[i];
      if (!m) continue;
      const ion = ions[i];
      let u = (t * ion.speed + ion.offset) % 1;
      if (u < 0) u += 1;
      const rad = R_EDGE - (R_EDGE - R_CORE) * clamp01(u);
      // a little tangential swirl as they descend
      tmp.copy(ion.dir).multiplyScalar(rad);
      const sw = ion.spin + t * 1.2;
      m.position.set(tmp.x + Math.cos(sw) * 0.05 * (1 - u), tmp.y, tmp.z + Math.sin(sw) * 0.05 * (1 - u));
      const mat = m.material as THREE.MeshBasicMaterial;
      // fade in from the edge, then fade out as it's incorporated
      mat.opacity = clamp01(u / 0.15) * (1 - clamp01((u - 0.8) / 0.2));
      const sc = 0.035 * (1 - 0.4 * u);
      m.scale.setScalar(sc);
    }
  });

  return (
    <group>
      {/* liquid medium */}
      <mesh>
        <sphereGeometry args={[R_MEDIUM, 40, 40]} />
        <meshStandardMaterial
          color={GREEN}
          emissive={GREEN}
          emissiveIntensity={0.12}
          roughness={0.1}
          metalness={0}
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* faint rim to read as a droplet surface */}
      <mesh>
        <sphereGeometry args={[R_MEDIUM * 1.001, 40, 40]} />
        <meshBasicMaterial color={TEAL} transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
      </mesh>

      {/* soft glow behind the crystal */}
      <sprite ref={haloRef} scale={[1.5, 1.5, 1]}>
        <spriteMaterial map={soft} color={GREEN} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* the growing crystal */}
      <group ref={crystalRef}>
        <mesh geometry={crystalGeo}>
          <meshStandardMaterial
            ref={crystalMat}
            color={WHITE}
            emissive={GREEN}
            emissiveIntensity={0.5}
            roughness={0.15}
            metalness={0.3}
            transparent
            opacity={0.78}
            flatShading
          />
        </mesh>
        <lineSegments geometry={edgesGeo}>
          <lineBasicMaterial ref={edgeMat} color={TEAL} transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
        </lineSegments>
      </group>

      {/* dissolved ions */}
      {ions.map((ion, i) => (
        <mesh key={i} ref={(m) => (ionRefs.current[i] = m!)}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshBasicMaterial color={ion.white ? WHITE : TEAL} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

/** Content only (no lights/camera), for embedding as a node in the shared map. */
export function SolutionGrowthMapScene() {
  return <CrystalInSolution />;
}

export default function SolutionGrowthAsset() {
  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0.3, 5], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 4]} intensity={0.8} />
        <pointLight position={[-3, -2, 2]} intensity={0.5} color={0x6ee7d0} />
        <CrystalInSolution />
        <OrbitControls enablePan={false} enableZoom minDistance={2.5} maxDistance={12} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 text-sm text-slate-300">
          Solution & Hydrothermal — a crystal grows from solution
        </div>
      </div>
    </>
  );
}
