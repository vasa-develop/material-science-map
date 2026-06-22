import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: Design Objective. The search space (a faint field of candidate points
 * inside a scope ring) gets narrowed: concentric constraint rings sweep inward
 * and snap onto a bright central core — a bullseye locking on the target. Verb:
 * narrow a vague wish down to one concrete, computable objective.
 */

const ACCENT = "#7dd3fc";
const LOCK = "#eaf6ff"; // near-white "locked" tint as rings reach the core

const N_RINGS = 5;
const R_OUT = 1.35;
const R_IN = 0.05;
const PERIOD = 3.4; // seconds for one ring to travel from edge to core

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

// soft radial sprite for the core glow
function softTex(): THREE.Texture {
  const s = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

function unitCircle(segments = 72): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function Reticle({ billboard }: { billboard: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const accentCol = useMemo(() => new THREE.Color(ACCENT), []);
  const lockCol = useMemo(() => new THREE.Color(LOCK), []);
  const soft = useMemo(() => softTex(), []);
  const circleGeo = useMemo(() => unitCircle(72), []);
  const tmpCol = useMemo(() => new THREE.Color(), []);

  // animated constraint rings (unit line-loops scaled per frame)
  const rings = useMemo(
    () =>
      new Array(N_RINGS).fill(0).map(() => {
        const mat = new THREE.LineBasicMaterial({
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0,
        });
        return new THREE.LineLoop(circleGeo, mat);
      }),
    [circleGeo]
  );

  // faint candidate field inside the scope (the space being narrowed)
  const candGeo = useMemo(() => {
    const N = 70;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = Math.sqrt(Math.random()) * R_OUT * 0.92;
      const a = Math.random() * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = Math.sin(a) * r;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  const coreRef = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloRef = useRef<THREE.Sprite>(null);
  const ticksRef = useRef<THREE.Group>(null);
  const candMat = useRef<THREE.PointsMaterial>(null);

  // 4 crosshair ticks at the cardinal directions, pointing inward
  const tickGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.26, 0, 0]), 3)
    );
    return g;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (billboard && group.current) group.current.quaternion.copy(camera.quaternion);

    let lock = 0;
    for (let i = 0; i < N_RINGS; i++) {
      let u = (t / PERIOD + i / N_RINGS) % 1;
      if (u < 0) u += 1;
      const e = smooth(u);
      const r = R_OUT - (R_OUT - R_IN) * e;
      const ring = rings[i];
      ring.scale.set(r, r, 1);
      // fade in from the edge, brighten while contracting, snap out at the core
      const fadeIn = clamp01(u / 0.12);
      const fadeOut = 1 - clamp01((u - 0.86) / 0.14);
      (ring.material as THREE.LineBasicMaterial).opacity = 0.85 * fadeIn * fadeOut;
      tmpCol.copy(accentCol).lerp(lockCol, smooth(u));
      (ring.material as THREE.LineBasicMaterial).color.copy(tmpCol);
      // contribution to the lock flash as a ring reaches the center
      const d = u - 0.9;
      lock += Math.exp(-(d * d) / 0.0016);
    }
    lock = Math.min(1, lock);

    if (coreRef.current && coreMat.current) {
      const s = 0.13 * (1 + lock * 0.6 + 0.06 * Math.sin(t * 2.2));
      coreRef.current.scale.setScalar(s);
      coreMat.current.opacity = 0.9;
      tmpCol.copy(accentCol).lerp(lockCol, 0.5 + 0.5 * lock);
      coreMat.current.color.copy(tmpCol);
    }
    if (haloRef.current) {
      const m = haloRef.current.material as THREE.SpriteMaterial;
      m.opacity = 0.35 + lock * 0.5;
      const hs = 1.1 + lock * 0.7;
      haloRef.current.scale.set(hs, hs, 1);
    }
    if (ticksRef.current) {
      // ticks nudge inward + brighten on each lock
      ticksRef.current.children.forEach((c) => {
        const ln = c as THREE.LineSegments;
        (ln.material as THREE.LineBasicMaterial).opacity = 0.3 + lock * 0.55;
      });
      ticksRef.current.scale.setScalar(1 - lock * 0.06);
    }
    if (candMat.current) {
      candMat.current.opacity = 0.12 + 0.16 * (0.5 + 0.5 * Math.sin(t * 1.3)) - lock * 0.12;
    }
  });

  return (
    <group ref={group}>
      {/* candidate field being narrowed */}
      <points geometry={candGeo}>
        <pointsMaterial
          ref={candMat}
          color={ACCENT}
          size={0.05}
          sizeAttenuation
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* static scope ring — the boundary of the search space */}
      <lineLoop geometry={circleGeo} scale={[R_OUT * 1.08, R_OUT * 1.08, 1]}>
        <lineBasicMaterial color={ACCENT} transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineLoop>

      {/* converging constraint rings */}
      {rings.map((r, i) => (
        <primitive key={i} object={r} />
      ))}

      {/* crosshair ticks (N / E / S / W), pointing inward */}
      <group ref={ticksRef}>
        {[0, 1, 2, 3].map((i) => (
          <lineSegments key={i} geometry={tickGeo} rotation={[0, 0, (i * Math.PI) / 2]} position={[Math.cos((i * Math.PI) / 2) * 1.18, Math.sin((i * Math.PI) / 2) * 1.18, 0]}>
            <lineBasicMaterial color={LOCK} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
          </lineSegments>
        ))}
      </group>

      {/* locked target core + glow */}
      <sprite ref={haloRef} scale={[1.2, 1.2, 1]}>
        <spriteMaterial map={soft} color={ACCENT} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial ref={coreMat} color={LOCK} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

/** Content only (no lights/camera), for embedding as a node in the shared map. */
export function DesignObjectiveMapScene() {
  return <Reticle billboard />;
}

export default function DesignObjectiveAsset() {
  const [billboard, setBillboard] = useState(true);
  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.6} />
        <Reticle billboard={billboard} />
        <OrbitControls enablePan={false} enableZoom minDistance={2.5} maxDistance={12} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">Design Objective — constraint rings lock the target</div>
          <button
            className={`pointer-events-auto w-fit rounded-md px-3 py-1 text-xs transition ${
              billboard ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
            }`}
            onClick={() => setBillboard((b) => !b)}
          >
            billboard {billboard ? "on" : "off"}
          </button>
        </div>
      </div>
    </>
  );
}
