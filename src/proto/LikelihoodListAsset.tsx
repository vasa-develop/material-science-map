import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAmbient } from "./useAmbient";

/**
 * Asset: "what do the 1,000 numbers actually look like?"
 * Scene 1 — one electron's list: the naive pin-point guess (100% in one box,
 * zeros everywhere else) vs the honest spread (every box gets a sliver of
 * maybe; the whole list sums to 100%). Hover any box to read its number.
 * Scene 2 — the tempting move with two electrons: two separate lists in the
 * same grid, 2,000 numbers, "done?" — the setup for the multiplication trap.
 */

const N = 10;
const CELL = 34;
const SIZE = N * CELL;
const MID = Math.floor(N / 2);
const PIN = { x: 6, y: 4 };

/** 3D gaussian over the full 10×10×10 cube, normalized to 100%; we display the middle slice. */
function gaussSlice(cx: number, cy: number, sigma: number): number[][] {
  let total = 0;
  const w: number[][][] = [];
  for (let x = 0; x < N; x++) {
    w.push([]);
    for (let y = 0; y < N; y++) {
      w[x].push([]);
      for (let z = 0; z < N; z++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - MID) ** 2;
        const v = Math.exp(-d2 / (2 * sigma * sigma));
        w[x][y].push(v);
        total += v;
      }
    }
  }
  return Array.from({ length: N }, (_, x) =>
    Array.from({ length: N }, (_, y) => (w[x][y][MID] / total) * 100),
  );
}

function fmt(v: number): string {
  if (v >= 100) return "100%";
  if (v >= 0.1) return `${v.toFixed(1)}%`;
  if (v >= 0.01) return `${v.toFixed(2)}%`;
  return `${v.toFixed(3)}%`;
}

/** Box numbering as if reading the full cube: this slice is boxes 501–600. */
function boxId(x: number, y: number): number {
  return MID * N * N + y * N + x + 1;
}

type Mode = "pin" | "spread";

function SceneOne() {
  const spread = useMemo(() => gaussSlice(MID - 0.5, MID - 0.5, 2.1), []);
  const maxP = useMemo(() => Math.max(...spread.flat()), [spread]);
  const [mode, setMode] = useState<Mode>("spread");
  const [pick, setPick] = useState<{ x: number; y: number } | null>(null);

  const { ambient, notifyInteraction } = useAmbient();

  // attract mode: alternate the two lists, and wander a "reading finger" over boxes
  useEffect(() => {
    if (!ambient) return;
    const modeIv = window.setInterval(() => setMode((m) => (m === "pin" ? "spread" : "pin")), 5200);
    const pickIv = window.setInterval(
      () => setPick({ x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }),
      1300,
    );
    return () => {
      window.clearInterval(modeIv);
      window.clearInterval(pickIv);
    };
  }, [ambient]);

  const valueAt = (x: number, y: number) =>
    mode === "pin" ? (x === PIN.x && y === PIN.y ? 100 : 0) : spread[x][y];

  const current = pick ?? { x: MID, y: MID };
  const currentV = valueAt(current.x, current.y);

  return (
    <div className="flex flex-wrap items-start justify-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="rounded-lg border border-white/10"
          onPointerLeave={() => setPick(null)}
        >
          {spread.map((col, x) =>
            col.map((_, y) => {
              const v = valueAt(x, y);
              const on = v > 0;
              const alpha = mode === "pin" ? (on ? 0.95 : 0) : 0.06 + (v / maxP) * 0.85;
              const hot = pick && pick.x === x && pick.y === y;
              return (
                <motion.rect
                  key={`${x}-${y}`}
                  x={x * CELL + 1}
                  y={y * CELL + 1}
                  width={CELL - 2}
                  height={CELL - 2}
                  rx={3}
                  animate={{ fill: `rgba(56,189,248,${on || mode === "spread" ? alpha : 0})` }}
                  transition={{ duration: 0.5 }}
                  stroke={hot ? "rgba(251,191,36,0.95)" : "rgba(148,163,184,0.15)"}
                  strokeWidth={hot ? 2 : 1}
                  onPointerEnter={() => {
                    notifyInteraction();
                    setPick({ x, y });
                  }}
                />
              );
            }),
          )}
          {/* nucleus */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={7} fill="#fbbf24" />
          <text x={SIZE / 2} y={SIZE / 2 + 3} textAnchor="middle" fontSize="8" fontWeight={700} fill="#1c1917">
            +
          </text>
        </svg>
        <div className="h-5 text-xs tabular-nums text-slate-400">
          {pick ? (
            <>
              box #{boxId(current.x, current.y)} → <span className="font-semibold text-sky-300">{fmt(currentV)}</span>
              {mode === "pin" && currentV === 0 && <span className="text-slate-600"> (impossible certainty)</span>}
            </>
          ) : (
            <span className="text-slate-600">hover any box to read its number</span>
          )}
        </div>
        <div className="text-[10px] text-slate-600">(showing the middle slice of the 10 × 10 × 10 cube — boxes #501–600)</div>
      </div>

      <div className="flex w-[240px] flex-col gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => {
              notifyInteraction();
              setMode("pin");
            }}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              mode === "pin" ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            the naive guess
          </button>
          <button
            onClick={() => {
              notifyInteraction();
              setMode("spread");
            }}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              mode === "spread" ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            the honest list
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === "pin" ? (
            <motion.div
              key="pin"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-xl border border-red-400/30 bg-red-400/[0.05] p-3 text-xs leading-relaxed text-slate-300"
            >
              <div className="mb-1 font-mono text-[11px] text-slate-400">
                box #{boxId(PIN.x, PIN.y)} → <span className="text-red-300">100%</span>
                <br />
                every other box → 0%
              </div>
              But look at what this list is claiming: that we know <em>exactly</em> which box the electron is in. That's
              pin-pointing — the very thing nature just told us is off the table.
            </motion.div>
          ) : (
            <motion.div
              key="spread"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-xl border border-sky-400/30 bg-sky-400/[0.05] p-3 text-xs leading-relaxed text-slate-300"
            >
              <div className="mb-1 font-mono text-[11px] text-slate-400">
                box #501 → {fmt(spread[0][0])}
                <br />
                box #545 → {fmt(spread[4][4])}
                <br />
                box #600 → {fmt(spread[9][9])}
                <br />⋮ (one number for every box)
              </div>
              Every box gets a sliver of <em>maybe</em> — big slivers near the nucleus, vanishing ones out at the edges. No
              box says "never," no box says "certainly here."
              <div className="mt-2 rounded-md bg-white/[0.06] px-2 py-1 text-center text-[11px] font-semibold text-sky-200">
                Σ all 1,000 numbers = exactly 100%
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                …because the electron has to be <em>somewhere</em>.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SceneTwo() {
  const a = useMemo(() => gaussSlice(2.6, 5.2, 1.7), []);
  const b = useMemo(() => gaussSlice(6.9, 3.8, 1.7), []);
  const maxA = useMemo(() => Math.max(...a.flat()), [a]);
  const maxB = useMemo(() => Math.max(...b.flat()), [b]);

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="rounded-lg border border-white/10">
        {a.map((col, x) =>
          col.map((_, y) => (
            <rect
              key={`${x}-${y}`}
              x={x * CELL + 1}
              y={y * CELL + 1}
              width={CELL - 2}
              height={CELL - 2}
              rx={3}
              fill={`rgba(56,189,248,${0.04 + (a[x][y] / maxA) * 0.75})`}
              stroke="rgba(148,163,184,0.12)"
            />
          )),
        )}
        {b.map((col, x) =>
          col.map((_, y) => (
            <rect
              key={`b${x}-${y}`}
              x={x * CELL + 1}
              y={y * CELL + 1}
              width={CELL - 2}
              height={CELL - 2}
              rx={3}
              fill={`rgba(251,191,36,${(b[x][y] / maxB) * 0.6})`}
            />
          )),
        )}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={7} fill="#f8fafc" opacity={0.9} />
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="rounded-xl border border-sky-400/40 bg-sky-400/[0.06] px-3 py-2 text-xs text-sky-200">
          electron 1's own list — 1,000 numbers
        </div>
        <span className="text-slate-500">+</span>
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-200">
          electron 2's own list — 1,000 numbers
        </div>
        <span className="text-slate-500">=</span>
        <div className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200">
          2,000 numbers. Done?
        </div>
      </div>
      <div className="max-w-md text-center text-xs leading-relaxed text-slate-500">
        Both electrons live in the <em>same</em> box of space — each just carries its own private list. Feels reasonable…
        hold that thought. (The next visual is where the trap springs.)
      </div>
    </div>
  );
}

const TABS = ["one electron's list", "two electrons — the tempting move"] as const;

export default function LikelihoodListAsset() {
  const [tab, setTab] = useState(0);
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-[#06070d] px-4">
      <div className="text-sm text-slate-300">
        What do the 1,000 numbers actually look like?
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {tab === 0 ? <SceneOne /> : <SceneTwo />}
        </motion.div>
      </AnimatePresence>
      <div className="flex items-center gap-2">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              tab === i ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
