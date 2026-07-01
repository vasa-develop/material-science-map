import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Asset: the energy-landscape search game.
 * The reader clicks anywhere on a terrain to "guess" nuclei positions; a walker descends
 * step by step (probe left/right → step downhill) with a live energy readout, and settles
 * at the bottom. Single-valley mode matches the essay's §3 simplification; multi-valley
 * mode is the future hull/metastability payoff (local traps).
 */

const W = 640;
const H = 340;
const PAD = 40;

type Mode = "single" | "multi";

function terrain(x: number, mode: Mode): number {
  // x in [0,1] → height in [0,1] (0 = deepest)
  if (mode === "single") {
    const d = x - 0.52;
    return 0.12 + 3.1 * d * d + 0.035 * Math.sin(x * 18);
  }
  // multi: several valleys of different depths; global min near x=0.72
  return (
    0.5 +
    0.34 * Math.sin(x * 11 + 1.4) * Math.sin(x * 4.4 + 0.4) -
    0.22 * Math.exp(-((x - 0.72) ** 2) / 0.004) -
    0.1 * Math.exp(-((x - 0.24) ** 2) / 0.003)
  );
}

function toPx(x: number, mode: Mode): { px: number; py: number } {
  // SVG y grows downward, so invert: low energy = visually low (a valley, not a peak)
  return {
    px: PAD + x * (W - PAD * 2),
    py: PAD + (1 - terrain(x, mode)) * (H - PAD * 2.2),
  };
}

function terrainPath(mode: Mode): string {
  const pts: string[] = [];
  for (let i = 0; i <= 160; i++) {
    const x = i / 160;
    const { px, py } = toPx(x, mode);
    pts.push(`${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`);
  }
  return pts.join(" ");
}

const STEP = 0.006;

export default function EnergyLandscapeGameAsset() {
  const [mode, setMode] = useState<Mode>("single");
  const [x, setX] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);
  const [probing, setProbing] = useState<0 | -1 | 1>(0);
  const raf = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);

  const stop = useCallback(() => cancelAnimationFrame(raf.current), []);

  const descend = useCallback(
    (x0: number) => {
      stop();
      setSettled(false);
      // precompute the full downhill path (deterministic), then animate along it
      const path: number[] = [x0];
      let cur = x0;
      for (let i = 0; i < 2000; i++) {
        const here = terrain(cur, mode);
        const left = terrain(Math.max(0, cur - STEP), mode);
        const right = terrain(Math.min(1, cur + STEP), mode);
        if (left < here - 1e-6 && left <= right) cur = Math.max(0, cur - STEP);
        else if (right < here - 1e-6) cur = Math.min(1, cur + STEP);
        else break;
        path.push(cur);
      }
      const t0 = performance.now();
      const dur = Math.min(3800, 500 + path.length * 22);
      const tick = (t: number) => {
        const f = Math.min(1, (t - t0) / dur);
        const idx = Math.min(path.length - 1, Math.floor(f * path.length));
        setX(path[idx]);
        setProbing(f >= 1 ? 0 : Math.floor(t / 350) % 3 === 0 ? -1 : Math.floor(t / 350) % 3 === 1 ? 1 : 0);
        if (f >= 1) {
          setSettled(true);
          return;
        }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    },
    [mode, stop],
  );

  useEffect(() => stop, [stop]);
  useEffect(() => {
    stop();
    setX(null);
    setSettled(false);
  }, [mode, stop]);

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const gx = ((e.clientX - r.left) / r.width) * W;
    const x0 = Math.max(0, Math.min(1, (gx - PAD) / (W - PAD * 2)));
    setX(x0);
    descend(x0);
  };

  const pos = x !== null ? toPx(x, mode) : null;
  const energy = x !== null ? terrain(x, mode) : null;
  // is this the global minimum? (sample-based check)
  let globalMin = Infinity;
  for (let i = 0; i <= 300; i++) globalMin = Math.min(globalMin, terrain(i / 300, mode));
  const trapped = settled && energy !== null && energy > globalMin + 0.03;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#06070d] px-4">
      <div className="text-sm text-slate-300">
        The search game — <span className="text-slate-500">click anywhere to drop a guess; watch it walk downhill</span>
      </div>

      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        onClick={onClick}
        className="max-w-full cursor-crosshair rounded-xl border border-white/10 bg-white/[0.02]"
      >
        <defs>
          <linearGradient id="elg-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(56,189,248,0.12)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0.01)" />
          </linearGradient>
        </defs>

        <path d={`${terrainPath(mode)} L${W - PAD},${H} L${PAD},${H} Z`} fill="url(#elg-fill)" />
        <path d={terrainPath(mode)} fill="none" stroke="rgba(148,163,184,0.7)" strokeWidth="2" />

        {/* axis hints */}
        <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#475569">
          nuclei arrangement (each point = one guess) →
        </text>
        <text x={14} y={H / 2} fontSize="10" fill="#475569" transform={`rotate(-90 14 ${H / 2})`} textAnchor="middle">
          energy (lower = more settled)
        </text>

        {pos && (
          <g>
            {/* probe arrows */}
            {probing !== 0 && !settled && (
              <motion.path
                d={`M${pos.px + probing * 14},${pos.py - 18} l${probing * 10},0 l${-probing * 4},-4 m${probing * 4},4 l${-probing * 4},4`}
                stroke="rgba(251,191,36,0.9)"
                strokeWidth="1.5"
                fill="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            )}
            {/* walker */}
            <circle cx={pos.px} cy={pos.py - 9} r={8} fill={settled ? (trapped ? "#fbbf24" : "#4ade80") : "#38bdf8"} />
            <circle cx={pos.px} cy={pos.py - 9} r={13} fill="none" stroke="rgba(255,255,255,0.25)" strokeDasharray="2 4" />
          </g>
        )}
      </svg>

      <div className="flex h-10 items-center">
        <AnimatePresence mode="wait">
          {energy !== null && (
            <motion.div
              key={`${settled}-${trapped}`}
              className="flex items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-sm tabular-nums text-slate-400">
                energy: <span className="font-semibold text-sky-300">{energy.toFixed(3)}</span>
              </div>
              {settled && !trapped && (
                <div className="text-sm font-medium text-green-400">settled — nothing lowers it further. This is the answer.</div>
              )}
              {settled && trapped && (
                <div className="text-sm font-medium text-amber-400">
                  stuck in a shallower valley — a deeper one exists, but every step out goes uphill first.
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        {(["single", "multi"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              mode === m ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            {m === "single" ? "one valley (the essay's simplification)" : "real landscape (many valleys)"}
          </button>
        ))}
      </div>

      {mode === "multi" && (
        <div className="max-w-md text-center text-xs leading-relaxed text-slate-500">
          Try dropping guesses in different places — where you start decides which valley you end up in. Getting stuck in a
          shallow valley is not a bug: it's how diamond exists at all.
        </div>
      )}
    </div>
  );
}
