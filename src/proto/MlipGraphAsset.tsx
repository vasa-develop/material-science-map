import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Asset: MLIP (neural-graph view). A small molecule/cluster wrapped in a graph
 * neural network; message-passing pulses travel the edges in waves and light
 * up the nodes they reach. Verb: message-passing.
 */

const NODES = 16;

function Graph({ speed, spin }: { speed: number; spin: boolean }) {
  const group = useRef<THREE.Group>(null);
  const coreInst = useRef<THREE.InstancedMesh>(null);
  const haloInst = useRef<THREE.InstancedMesh>(null);
  const pulseInst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  // node positions: a compact cluster
  const { nodes, edges } = useMemo(() => {
    const nodes: THREE.Vector3[] = [];
    let seed = 11;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < NODES; i++) {
      const u = rnd() * 2 - 1;
      const phi = rnd() * Math.PI * 2;
      const sp = Math.sqrt(1 - u * u);
      const r = 0.5 + rnd() * 0.9;
      nodes.push(new THREE.Vector3(r * sp * Math.cos(phi), r * sp * Math.sin(phi), r * u));
    }
    // connect each node to its 3 nearest neighbours (dedup)
    const edgeSet = new Set<string>();
    const edges: { a: number; b: number; ph: number }[] = [];
    for (let i = 0; i < NODES; i++) {
      const d = nodes
        .map((p, j) => ({ j, dist: p.distanceTo(nodes[i]) }))
        .filter((o) => o.j !== i)
        .sort((x, y) => x.dist - y.dist)
        .slice(0, 3);
      for (const { j } of d) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ a: i, b: j, ph: Math.random() });
        }
      }
    }
    return { nodes, edges };
  }, []);

  const nodeGlow = useRef<number[]>(new Array(NODES).fill(0));

  // static edge lines
  const edgeGeo = useMemo(() => {
    const pos = new Float32Array(edges.length * 2 * 3);
    edges.forEach((e, k) => {
      pos[k * 6] = nodes[e.a].x;
      pos[k * 6 + 1] = nodes[e.a].y;
      pos[k * 6 + 2] = nodes[e.a].z;
      pos[k * 6 + 3] = nodes[e.b].x;
      pos[k * 6 + 4] = nodes[e.b].y;
      pos[k * 6 + 5] = nodes[e.b].z;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [edges, nodes]);

  const coreGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.1, 16, 16);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    return g;
  }, []);
  const haloGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.2, 14, 14);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    return g;
  }, []);
  const coreMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x1b3a5a, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2 }), []);
  const haloMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const pulseGeo = useMemo(() => new THREE.SphereGeometry(0.06, 10, 10), []);
  const pulseMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }), []);

  const NODE_COL = useMemo(() => new THREE.Color(0x5fb8ff), []);

  useLayoutEffect(() => {
    for (let i = 0; i < NODES; i++) {
      dummy.position.copy(nodes[i]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      coreInst.current?.setMatrixAt(i, dummy.matrix);
      haloInst.current?.setMatrixAt(i, dummy.matrix);
    }
    if (coreInst.current) coreInst.current.instanceMatrix.needsUpdate = true;
    if (haloInst.current) haloInst.current.instanceMatrix.needsUpdate = true;
  }, [nodes, dummy]);

  const prevP = useRef<number[]>(edges.map(() => 0));

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // decay node glow; pulses travel edges and flare the node they reach
    for (let i = 0; i < NODES; i++) nodeGlow.current[i] *= 0.93;

    if (pulseInst.current) {
      for (let k = 0; k < edges.length; k++) {
        const e = edges[k];
        const p = (t * speed * 0.25 + e.ph) % 1;
        if (prevP.current[k] > p) nodeGlow.current[e.b] = 1; // wrapped -> arrived at b
        prevP.current[k] = p;
        const a = nodes[e.a];
        const b = nodes[e.b];
        dummy.position.set(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, a.z + (b.z - a.z) * p);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        pulseInst.current.setMatrixAt(k, dummy.matrix);
      }
      pulseInst.current.instanceMatrix.needsUpdate = true;
    }

    if (coreInst.current && haloInst.current) {
      for (let i = 0; i < NODES; i++) {
        const g = nodeGlow.current[i];
        const base = 0.5 + 0.12 * Math.sin(t * 1.5 + i);
        scratch.copy(NODE_COL).multiplyScalar(base + g * 0.9);
        coreInst.current.setColorAt(i, scratch);
        scratch.copy(NODE_COL).multiplyScalar(0.4 + g);
        haloInst.current.setColorAt(i, scratch);
        const sc = 1 + g * 0.6;
        dummy.position.copy(nodes[i]);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        coreInst.current.setMatrixAt(i, dummy.matrix);
        haloInst.current.setMatrixAt(i, dummy.matrix);
      }
      coreInst.current.instanceMatrix.needsUpdate = true;
      haloInst.current.instanceMatrix.needsUpdate = true;
      if (coreInst.current.instanceColor) coreInst.current.instanceColor.needsUpdate = true;
      if (haloInst.current.instanceColor) haloInst.current.instanceColor.needsUpdate = true;
    }

    if (group.current && spin) group.current.rotation.y = t * 0.25;
  });

  return (
    <group ref={group}>
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color={0x4a78b0} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      <instancedMesh ref={coreInst} args={[coreGeo, coreMat, NODES]} />
      <instancedMesh ref={haloInst} args={[haloGeo, haloMat, NODES]} />
      <instancedMesh ref={pulseInst} args={[pulseGeo, pulseMat, edges.length]} />
    </group>
  );
}

export default function MlipGraphAsset() {
  const [speed, setSpeed] = useState(1);
  const [spin, setSpin] = useState(true);
  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs transition ${active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`;
  return (
    <>
      <Canvas className="absolute inset-0" camera={{ position: [0, 0.4, 4.6], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#06070d"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 5, 3]} intensity={0.7} />
        <pointLight position={[-3, 2, -2]} intensity={0.4} color={0x88aaff} />
        <Graph speed={speed} spin={spin} />
        <OrbitControls enablePan={false} enableZoom minDistance={3} maxDistance={11} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-5 left-5 flex flex-col gap-3">
          <div className="text-sm text-slate-300">MLIP (neural graph) — message-passing on the atomic graph</div>
          <div className="pointer-events-auto inline-flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgba(8,10,18,0.7)] p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-400">messages</span>
              <input type="range" min={0.2} max={3} step={0.05} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-36 accent-sky-400" />
              <span className="text-[11px] tabular-nums text-slate-500">{speed.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-400">spin</span>
              <button className={btn(spin)} onClick={() => setSpin((s) => !s)}>
                {spin ? "on" : "off"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
