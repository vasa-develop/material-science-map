import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAmbient } from "./useAmbient";

/**
 * Asset: "every electron feels every other one, all at once."
 * Add atoms with a slider; every electron gets a shimmering line to every other electron
 * (and every nucleus). The pair-count readout grows quadratically — the visual argument
 * for why you can't solve the system one atom at a time.
 */

const W = 640;
const H = 380;
const CX = W / 2;
const CY = H / 2 - 10;

type P = { x: number; y: number; kind: "e" | "n" };

function layout(nAtoms: number): P[] {
  const pts: P[] = [];
  const R = nAtoms === 1 ? 0 : 118;
  for (let a = 0; a < nAtoms; a++) {
    const ang = (a / nAtoms) * Math.PI * 2 - Math.PI / 2;
    const cx = CX + Math.cos(ang) * R;
    const cy = CY + Math.sin(ang) * R;
    pts.push({ x: cx, y: cy, kind: "n" });
    // 2 electrons per atom (keeps the web readable; caption owns the honesty)
    for (let e = 0; e < 2; e++) {
      const ea = ang + e * Math.PI + 0.7;
      pts.push({ x: cx + Math.cos(ea) * 44, y: cy + Math.sin(ea) * 44, kind: "e" });
    }
  }
  return pts;
}

export default function CouplingWebAsset() {
  const [nAtoms, setNAtoms] = useState(2);
  const pts = useMemo(() => layout(nAtoms), [nAtoms]);

  // attract mode: breathe the atom count up and down until the reader grabs the slider
  const { ambient, notifyInteraction } = useAmbient();
  const dir = useRef(1);
  useEffect(() => {
    if (!ambient) return;
    const iv = window.setInterval(() => {
      setNAtoms((n) => {
        if (n >= 8) dir.current = -1;
        if (n <= 1) dir.current = 1;
        return Math.max(1, Math.min(8, n + dir.current));
      });
    }, 1500);
    return () => window.clearInterval(iv);
  }, [ambient]);

  const electrons = pts.filter((p) => p.kind === "e");
  const nuclei = pts.filter((p) => p.kind === "n");

  const pairs: [P, P, number][] = [];
  for (let i = 0; i < electrons.length; i++)
    for (let j = i + 1; j < electrons.length; j++) pairs.push([electrons[i], electrons[j], i * 31 + j]);
  const enLinks: [P, P, number][] = [];
  electrons.forEach((e, i) => nuclei.forEach((n, j) => enLinks.push([e, n, i * 17 + j + 1000])));

  const totalLinks = pairs.length + enLinks.length;
  // full count with all 6 electrons per carbon, for the caption
  const fullE = nAtoms * 6;
  const fullPairs = (fullE * (fullE - 1)) / 2 + fullE * nAtoms;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#06070d] px-4">
      <div className="text-sm text-slate-300">
        Every electron feels every other one — <span className="text-slate-500">all at once</span>
      </div>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="max-w-full rounded-xl border border-white/10 bg-white/[0.02]">
        {/* electron–electron web */}
        {pairs.map(([p, q, k]) => (
          <motion.line
            key={`ee${k}`}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke="rgba(56,189,248,0.5)"
            strokeWidth="1"
            animate={{ opacity: [0.15, 0.65, 0.15] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: (k % 12) * 0.2 }}
          />
        ))}
        {/* electron–nucleus links */}
        {enLinks.map(([p, q, k]) => (
          <motion.line
            key={`en${k}`}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke="rgba(251,191,36,0.32)"
            strokeWidth="0.8"
            animate={{ opacity: [0.08, 0.4, 0.08] }}
            transition={{ duration: 3.1, repeat: Infinity, delay: (k % 9) * 0.3 }}
          />
        ))}
        {nuclei.map((p, i) => (
          <g key={`n${i}`}>
            <circle cx={p.x} cy={p.y} r={9} fill="#fbbf24" />
            <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize="8" fontWeight={700} fill="#1c1917">+</text>
          </g>
        ))}
        {electrons.map((p, i) => (
          <motion.circle
            key={`e${i}`}
            cx={p.x}
            cy={p.y}
            r={4.5}
            fill="#7dd3fc"
            animate={{ r: [4, 5.2, 4] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </svg>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">1</span>
        <input
          type="range"
          min={1}
          max={8}
          value={nAtoms}
          onChange={(e) => {
            notifyInteraction();
            setNAtoms(parseInt(e.target.value));
          }}
          onPointerDown={notifyInteraction}
          className="w-52 accent-sky-400"
        />
        <span className="text-xs text-slate-500">8 atoms</span>
      </div>

      <div className="text-center">
        <div className="text-2xl font-bold tabular-nums text-sky-300">{totalLinks} connections</div>
        <div className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
          (drawing 2 of carbon's 6 electrons per atom to keep the web readable — with all 6, {nAtoms} atom{nAtoms > 1 ? "s" : ""} would
          be <span className="text-slate-300 tabular-nums">{fullPairs.toLocaleString()}</span> connections, every one active at the
          same time)
        </div>
        <div className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-300">
          There's no way to cut this web into independent pieces and solve them one at a time — moving <em>any</em> electron
          tugs on <em>all</em> of them. The system only exists as a whole.
        </div>
      </div>
    </div>
  );
}
