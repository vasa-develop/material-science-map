import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAmbient } from "./useAmbient";

/**
 * Asset: two atoms finding the sweet spot.
 * Tab 1 — a single carbon atom: nucleus + fuzzy electron cloud (+ the 22,000× mass note).
 * Tab 2 — drag atom B toward atom A: force arrows flip from attraction to repulsion,
 * and an energy-vs-distance valley is quietly traced underneath by the reader's own hand.
 */

const W = 640;
const CANVAS_H = 240;
const PLOT_H = 170;
const PAD = 48;
const AX = 190; // atom A fixed x
const MIN_D = 60;
const MAX_D = 360;
const SWEET = 150; // equilibrium distance (px)

/** Morse-like energy: 0 at infinity, minimum at SWEET, steep wall up close. */
function energyAt(d: number): number {
  const r = d / SWEET;
  const e = Math.exp(-2.6 * (r - 1));
  return (e * e - 2 * e) * 0.9; // min ≈ -0.9 at r=1, → 0 as r→∞
}

function Cloud({ x, y, r, hue }: { x: number; y: number; r: number; hue: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={`url(#bss-${hue})`} />
      <circle cx={x} cy={y} r={4.5} fill="#f8fafc" />
    </g>
  );
}

export default function BondSweetSpotAsset() {
  const [tab, setTab] = useState<"one" | "two">("two");
  const [bx, setBx] = useState(AX + MAX_D * 0.85);
  const [trace, setTrace] = useState<Set<number>>(new Set());
  const dragging = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const d = bx - AX;
  const e = energyAt(d);
  const atSweet = Math.abs(d - SWEET) < 12;
  const tooClose = d < SWEET - 24;

  // attract mode: sweep the amber atom through the whole range, tracing the
  // valley hands-free, until the reader grabs it
  const { ambient, notifyInteraction } = useAmbient();
  const bxRef = useRef(bx);
  bxRef.current = bx;
  useEffect(() => {
    if (!ambient || tab !== "two") return;
    let raf = 0;
    const mid = (MIN_D + MAX_D) / 2;
    const amp = (MAX_D - MIN_D) / 2 - 6;
    // start the sine wherever the atom currently is, so resuming doesn't jump
    const phase0 = Math.asin(Math.max(-1, Math.min(1, (bxRef.current - AX - mid) / amp)));
    const t0 = performance.now();
    const loop = (t: number) => {
      const nd = mid + Math.sin(((t - t0) / 1000) * 0.5 + phase0) * amp;
      setBx(AX + nd);
      setTrace((tr) => {
        const next = new Set(tr);
        next.add(Math.round(nd / 4) * 4);
        return next;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ambient, tab]);

  const onMove = useCallback((ev: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    const nd = Math.max(MIN_D, Math.min(MAX_D, x - AX));
    setBx(AX + nd);
    setTrace((t) => new Set(t).add(Math.round(nd / 4) * 4));
  }, []);

  // slope of the energy curve: E rising with distance ⇒ pulled together (attraction);
  // E falling with distance ⇒ pushed apart (repulsion)
  const slope = (energyAt(d + 2) - energyAt(d - 2)) / 4;
  const fMag = Math.min(40, Math.abs(slope) * 900 + (Math.abs(slope) > 0.001 ? 8 : 0));
  const attract = slope > 0.0005;
  const repel = slope < -0.0005;

  // low (negative) energy should sit visually LOW — a valley, not a hill
  const plotY = (val: number) => 26 + (-val / 1.05) * (PLOT_H - 56);
  const plotX = (dist: number) => PAD + ((dist - MIN_D) / (MAX_D - MIN_D)) * (W - PAD * 2);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-[#06070d] px-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            notifyInteraction();
            setTab("one");
          }}
          className={`rounded-full px-3 py-1.5 text-xs transition ${tab === "one" ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}
        >
          one atom
        </button>
        <button
          onClick={() => {
            notifyInteraction();
            setTab("two");
          }}
          className={`rounded-full px-3 py-1.5 text-xs transition ${tab === "two" ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}
        >
          two atoms — find the sweet spot
        </button>
      </div>

      {tab === "one" ? (
        <div className="flex flex-col items-center gap-4">
          <svg width={420} height={300} viewBox="0 0 420 300" className="max-w-full">
            <defs>
              <radialGradient id="bss-one" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(56,189,248,0.55)" />
                <stop offset="55%" stopColor="rgba(56,189,248,0.18)" />
                <stop offset="100%" stopColor="rgba(56,189,248,0)" />
              </radialGradient>
            </defs>
            <motion.circle
              cx={210}
              cy={150}
              fill="url(#bss-one)"
              animate={{ r: [104, 112, 104] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* 6 electrons drifting in the cloud */}
            {Array.from({ length: 6 }, (_, i) => {
              const a = (i / 6) * Math.PI * 2;
              const rr = i < 2 ? 42 : 84;
              return (
                <motion.circle
                  key={i}
                  r={3.2}
                  fill="#7dd3fc"
                  animate={{
                    cx: [210 + Math.cos(a) * rr, 210 + Math.cos(a + 2.2) * rr, 210 + Math.cos(a + 4.4) * rr, 210 + Math.cos(a + 6.28) * rr],
                    cy: [150 + Math.sin(a) * rr, 150 + Math.sin(a + 2.2) * rr, 150 + Math.sin(a + 4.4) * rr, 150 + Math.sin(a + 6.28) * rr],
                  }}
                  transition={{ duration: 7 + i, repeat: Infinity, ease: "linear" }}
                />
              );
            })}
            <circle cx={210} cy={150} r={11} fill="#fbbf24" />
            <text x={210} y={154} textAnchor="middle" fontSize="9" fontWeight={700} fill="#1c1917">+6</text>
            <text x={210} y={278} textAnchor="middle" fontSize="11" fill="#94a3b8">
              a carbon atom: nucleus (+), 6 electrons (−) buzzing around it
            </text>
          </svg>
          <div className="max-w-md text-center text-sm leading-relaxed text-slate-300">
            The nucleus is <span className="font-semibold text-amber-300">≈22,000× heavier</span> than one electron — from an
            electron's point of view it's pinned in place. The featherweight electrons do all the fast moving.
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <svg
            ref={svgRef}
            width={W}
            height={CANVAS_H}
            viewBox={`0 0 ${W} ${CANVAS_H}`}
            className="max-w-full cursor-grab touch-none rounded-t-xl border border-b-0 border-white/10 bg-white/[0.02] active:cursor-grabbing"
            onPointerDown={(ev) => {
              notifyInteraction();
              dragging.current = true;
              (ev.target as Element).setPointerCapture?.(ev.pointerId);
              onMove(ev);
            }}
            onPointerMove={onMove}
            onPointerUp={() => (dragging.current = false)}
          >
            <defs>
              <radialGradient id="bss-a" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(56,189,248,0.5)" />
                <stop offset="60%" stopColor="rgba(56,189,248,0.15)" />
                <stop offset="100%" stopColor="rgba(56,189,248,0)" />
              </radialGradient>
              <radialGradient id="bss-b" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(251,191,36,0.5)" />
                <stop offset="60%" stopColor="rgba(251,191,36,0.15)" />
                <stop offset="100%" stopColor="rgba(251,191,36,0)" />
              </radialGradient>
            </defs>

            <Cloud x={AX} y={CANVAS_H / 2} r={54} hue="a" />
            <Cloud x={bx} y={CANVAS_H / 2} r={54} hue="b" />

            {/* force arrows on atom B */}
            {(attract || repel) && (
              <g stroke={attract ? "#4ade80" : "#f87171"} strokeWidth="2.5" fill="none">
                <line x1={bx + (attract ? 62 : 58)} y1={CANVAS_H / 2} x2={bx + (attract ? 62 - fMag : 58 + fMag)} y2={CANVAS_H / 2} />
                <path
                  d={
                    attract
                      ? `M${bx + 62 - fMag},${CANVAS_H / 2} l7,-4 m-7,4 l7,4`
                      : `M${bx + 58 + fMag},${CANVAS_H / 2} l-7,-4 m7,4 l-7,4`
                  }
                />
              </g>
            )}
            {atSweet && (
              <motion.circle
                cx={(AX + bx) / 2}
                cy={CANVAS_H / 2}
                r={20}
                fill="none"
                stroke="rgba(74,222,128,0.8)"
                strokeWidth="2"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              />
            )}

            <text x={W / 2} y={20} textAnchor="middle" fontSize="11" fill="#64748b">
              drag the amber atom {atSweet ? "— click! the forces balance here" : tooClose ? "— too close! shoved back hard" : attract ? "— it's being pulled in" : ""}
            </text>
          </svg>

          {/* energy trace plot */}
          <svg width={W} height={PLOT_H} viewBox={`0 0 ${W} ${PLOT_H}`} className="max-w-full rounded-b-xl border border-white/10 bg-white/[0.02]">
            {/* traced curve from visited distances */}
            {[...trace].sort((a, b) => a - b).map((td) => (
              <circle key={td} cx={plotX(td)} cy={plotY(energyAt(td))} r={1.8} fill="rgba(56,189,248,0.55)" />
            ))}
            {/* zero line */}
            <line x1={PAD} y1={plotY(0)} x2={W - PAD} y2={plotY(0)} stroke="rgba(148,163,184,0.25)" strokeDasharray="3 5" />
            {/* current marker */}
            <circle cx={plotX(d)} cy={plotY(e)} r={5} fill={atSweet ? "#4ade80" : "#fbbf24"} />
            <text x={PAD} y={16} fontSize="10" fill="#64748b">the curve you're drawing (kept unlabeled on purpose — remember its shape)</text>
            <text x={W - PAD} y={plotY(0) - 6} fontSize="9" fill="#475569" textAnchor="end">far apart</text>
            <text x={W / 2} y={PLOT_H - 8} fontSize="10" fill="#475569" textAnchor="middle">distance between the two atoms →</text>
          </svg>

          <div className="mt-3 max-w-lg text-center text-sm leading-relaxed text-slate-300">
            Pull them apart: a gentle tug inward. Shove them together: a hard push back. In between sits one distance where
            everything balances — the <span className="text-green-400">sweet spot</span>. Notice the <em>valley</em> you just traced.
          </div>
        </div>
      )}
    </div>
  );
}
