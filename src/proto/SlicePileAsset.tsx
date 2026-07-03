import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Asset: "slicing the pile" — conditional odds performed, not stated.
 *
 * Replaces the static two-panel two-cases embed in the dependence passage.
 * The three paragraphs there each perform a different OPERATION on the pile
 * of recorded pairs, and each operation gets its own embed of this asset via
 * `?stage=` (same pattern as comb-wall's `?beat=`):
 *
 *   stage=1 · FILTER — press "keep only runs where box #1 clicked"; the
 *             ledger visibly drops non-matching rows and the surviving runs'
 *             PARTNER clicks land on the grid as raw dots. No numbers yet.
 *   stage=2 · TALLY — starts with the dots already there; press "tally" and
 *             they collapse into 16 shares, with the fine print pinned to
 *             the map as a literal label.
 *   stage=3 · RE-SLICE — starts at the finished box-#1 map; press "slice by
 *             box #11 instead" and the SAME grid re-filters, re-tallies, and
 *             reshuffles in place, old numbers ghosted for comparison. Then
 *             any box is clickable.
 *
 * Deliberate constraints:
 *  · No new experiment happens here — the pile is fixed (5,000 pairs drawn
 *    once from the same joint structure as pair-run / two-cases /
 *    joint-table). This is a SORTING JOB on existing records, which is the
 *    whole pedagogical point (and what dissolved crime C10).
 *  · NO ambient auto-tour (same reasoning as two-cases): the prose names
 *    box #1 and box #11, so each stage must be resting where its paragraph
 *    expects when the reader arrives.
 *  · Empirical tallies, not the analytic conditional — so the numbers carry
 *    honest sampling wiggle, consistent with the sixteen-numbers beat.
 */

const N = 4;
const CELLS = N * N;
const CELL = 64;
const SIZE = N * CELL;
// 10,000 pairs — the same run count the reader accepted in the one-electron
// beat, and big enough that mirror-symmetric boxes (e.g. #4 vs #13 about a
// #1 slice) agree to within a dot or two. At 5,000 the raw-count dot display
// showed 2x asymmetries between boxes that are exactly equal in expectation
// (vasa's catch, 2026-07-04): a false signal, fixed by more data + the
// proportional dot display below — never by symmetrizing the samples.
const PILE = 10000;
const MAX_DOTS = 26; // dots per box scale ∝ count, hottest box ≈ this many

const pos = (i: number) => ({ x: i % N, y: Math.floor(i / N) });
const C = (N - 1) / 2;

/** first electron: same marginal shape as sixteen-numbers / pair-run */
function marginal(): number[] {
  const w = Array.from({ length: CELLS }, (_, i) => {
    const { x, y } = pos(i);
    return Math.exp(-((x - C) ** 2 + (y - C) ** 2) / (2 * 1.15 ** 2));
  });
  const t = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / t);
}

/** second electron given the first clicked box b: same shape as two-cases */
function conditional(b: number): number[] {
  const bp = pos(b);
  const w = Array.from({ length: CELLS }, (_, i) => {
    const { x, y } = pos(i);
    const nuc = Math.exp(-((x - C) ** 2 + (y - C) ** 2) / (2 * 1.6 ** 2));
    const rep = 1 - 0.93 * Math.exp(-((x - bp.x) ** 2 + (y - bp.y) ** 2) / (2 * 1.05 ** 2));
    return nuc * rep;
  });
  const t = w.reduce((a, b2) => a + b2, 0);
  return w.map((v) => v / t);
}

function draw(dist: number[]): number {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < dist.length; i++) {
    acc += dist[i];
    if (r < acc) return i;
  }
  return dist.length - 1;
}

const fmt = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1)) + "%";

/** deterministic sunflower scatter inside a cell, so dots don't jump around */
function dotOffset(box: number, k: number) {
  const golden = 2.399963;
  const r = 5 + 19.5 * Math.sqrt((k + 0.6) / MAX_DOTS);
  const th = k * golden + box * 1.7;
  return { dx: r * Math.cos(th), dy: r * Math.sin(th) };
}

type Phase = "pile" | "filtering" | "marks" | "tallying" | "map" | "free";

export default function SlicePileAsset() {
  const stage = useMemo(
    () => new URLSearchParams(window.location.search).get("stage") ?? "1",
    [],
  );

  const pile = useMemo(() => {
    const marg = marginal();
    const conds = Array.from({ length: CELLS }, (_, b) => conditional(b));
    return Array.from({ length: PILE }, (): [number, number] => {
      const a = draw(marg);
      const b = draw(conds[a]);
      return a <= b ? [a, b] : [b, a];
    });
  }, []);

  const [phase, setPhase] = useState<Phase>(
    stage === "3" ? "map" : stage === "2" ? "marks" : "pile",
  );
  const [slice, setSlice] = useState(0); // box #1 — matches the prose
  const [prog, setProg] = useState(stage === "1" ? 0 : 1);
  const [prevShares, setPrevShares] = useState<number[] | null>(null);
  const [prevSlice, setPrevSlice] = useState<number | null>(null);
  const iv = useRef<number | null>(null);
  const busy = phase === "filtering" || phase === "tallying";

  const { kept, counts } = useMemo(() => {
    const counts = Array(CELLS).fill(0);
    let kept = 0;
    for (const [a, b] of pile) {
      if (a === slice || b === slice) {
        kept++;
        counts[a === slice ? b : a]++;
      }
    }
    return { kept, counts };
  }, [pile, slice]);

  const shares = useMemo(
    () => counts.map((c) => (kept > 0 ? (c / kept) * 100 : 0)),
    [counts, kept],
  );
  const maxShare = Math.max(...shares, 0.0001);

  // 7 sample ledger rows with a guaranteed mix of kept/dropped for any slice
  const sampleRows = useMemo(() => {
    const rows: { pair: [number, number]; idx: number }[] = [];
    let keptSeen = 0;
    for (let i = 0; i < pile.length && rows.length < 7; i++) {
      const [a, b] = pile[i];
      const isKept = a === slice || b === slice;
      if (isKept) {
        if (keptSeen < 3) {
          rows.push({ pair: pile[i], idx: i });
          keptSeen++;
        }
      } else if (rows.length - keptSeen < 4) {
        rows.push({ pair: pile[i], idx: i });
      }
    }
    return rows;
  }, [pile, slice]);

  const ease = (p: number) => p * p * (3 - 2 * p);
  const shownKept = Math.floor(kept * ease(prog));

  const clearIv = () => {
    if (iv.current !== null) window.clearInterval(iv.current);
    iv.current = null;
  };
  useEffect(() => clearIv, []);

  /** filter animation; `andTally` chains straight into the tally (re-slice) */
  const startSlice = (b: number, andTally: boolean) => {
    if (busy) return;
    if (phase === "map" || phase === "free") {
      setPrevShares(shares);
      setPrevSlice(slice);
    }
    setSlice(b);
    setProg(0);
    setPhase("filtering");
    const ticks = andTally ? 22 : 40;
    let t = 0;
    clearIv();
    iv.current = window.setInterval(() => {
      t++;
      setProg(Math.min(1, t / ticks));
      if (t >= ticks) {
        clearIv();
        if (andTally) {
          setPhase("tallying");
          window.setTimeout(() => setPhase("free"), 700);
        } else {
          setPhase("marks");
        }
      }
    }, 50);
  };

  const startTally = () => {
    if (phase !== "marks") return;
    setPhase("tallying");
    window.setTimeout(() => setPhase("map"), 700);
  };

  const reset = () => {
    clearIv();
    setSlice(0);
    setProg(0);
    setPrevShares(null);
    setPrevSlice(null);
    setPhase("pile");
  };

  const showDots = phase === "filtering" || phase === "marks" || phase === "tallying";
  const showNumbers = phase === "tallying" || phase === "map" || phase === "free";
  const showSliceMark = phase !== "pile";
  const boxesClickable = phase === "map" || phase === "free";

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#06070d] px-4">
      <p className="max-w-[620px] text-center text-[13.5px] leading-relaxed text-slate-300">
        No new experiment here — just the <b>pile of {PILE.toLocaleString()} recorded pairs</b>{" "}
        from before, and a sorting job: keep only the runs where one box clicked, then look at
        where the <b className="text-amber-300">other click</b> landed.
      </p>

      <div className="flex flex-wrap items-start justify-center gap-9">
        {/* ——— the grid ——— */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-4 text-[11px] uppercase tracking-wider text-slate-500">
            {phase === "pile"
              ? "the 16 boxes"
              : showNumbers
                ? `the other click's odds — runs with a #${slice + 1} click`
                : `where the other click landed — runs with a #${slice + 1} click`}
          </div>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="rounded-lg border border-white/10"
          >
            {counts.map((c, i) => {
              const { x, y } = pos(i);
              const isSlice = i === slice;
              // dot count ∝ box count (a density picture, like the heat that
              // follows) — raw capped counts would saturate hot boxes while
              // leaving cold boxes' sampling noise on full display. Any
              // nonzero count shows at least one dot: the sliced box's own
              // rare same-box pairs (~0.9 expected per pile) must not be
              // rounded into invisibility.
              const maxCount = Math.max(...counts, 1);
              const target = c === 0 ? 0 : Math.max(1, Math.round(MAX_DOTS * (c / maxCount)));
              const nDots = Math.round(target * ease(prog));
              return (
                <g
                  key={i}
                  onClick={() => boxesClickable && !busy && startSlice(i, true)}
                  className={boxesClickable ? "cursor-pointer" : ""}
                >
                  <rect
                    x={x * CELL + 2}
                    y={y * CELL + 2}
                    width={CELL - 4}
                    height={CELL - 4}
                    rx={6}
                    fill="#0b0e18"
                    stroke={
                      isSlice && showSliceMark
                        ? "rgba(56,189,248,0.6)"
                        : "rgba(148,163,184,0.18)"
                    }
                    strokeWidth={isSlice && showSliceMark ? 1.5 : 1}
                  />
                  {showNumbers && !isSlice && (
                    <motion.rect
                      x={x * CELL + 2}
                      y={y * CELL + 2}
                      width={CELL - 4}
                      height={CELL - 4}
                      rx={6}
                      initial={{ fill: "rgba(251,191,36,0)" }}
                      animate={{ fill: `rgba(251,191,36,${0.04 + (shares[i] / maxShare) * 0.42})` }}
                      transition={{ duration: 0.55 }}
                    />
                  )}
                  <text x={x * CELL + 9} y={y * CELL + 17} fontSize="9" fill="rgba(148,163,184,0.55)">
                    #{i + 1}
                  </text>
                  {/* raw partner-click dots */}
                  {showDots &&
                    Array.from({ length: nDots }, (_, k) => {
                      const { dx, dy } = dotOffset(i, k);
                      return (
                        <motion.circle
                          key={`d-${i}-${k}`}
                          cx={x * CELL + CELL / 2 + dx}
                          cy={y * CELL + CELL / 2 + 2 + dy}
                          r={2.6}
                          fill="#fbbf24"
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{
                            opacity: phase === "tallying" ? 0 : 0.9,
                            scale: 1,
                          }}
                          transition={{ duration: 0.3 }}
                        />
                      );
                    })}
                  {/* tallied share */}
                  {showNumbers && (
                    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.55, delay: 0.25 }}>
                      <text
                        x={x * CELL + CELL / 2}
                        y={y * CELL + CELL / 2 + (prevShares ? 5 : 9)}
                        textAnchor="middle"
                        fontSize="13"
                        fontWeight={600}
                        fill="#fde68a"
                      >
                        {fmt(shares[i])}
                      </text>
                      {prevShares && (
                        <text
                          x={x * CELL + CELL / 2}
                          y={y * CELL + CELL / 2 + 19}
                          textAnchor="middle"
                          fontSize="8.5"
                          fill="rgba(148,163,184,0.75)"
                        >
                          was {fmt(prevShares[i])}
                        </text>
                      )}
                    </motion.g>
                  )}
                  {/* slice badge — corner, so the box's own share stays visible */}
                  {isSlice && showSliceMark && (
                    <g>
                      <circle cx={x * CELL + CELL - 12} cy={y * CELL + 13} r={7.5} fill="#38bdf8" />
                      <text
                        x={x * CELL + CELL - 12}
                        y={y * CELL + 16}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight={700}
                        fill="#06070d"
                      >
                        ✓
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            <circle cx={SIZE / 2} cy={SIZE / 2} r={5.5} fill="#f8fafc" opacity={0.85} />
          </svg>
          {/* the fine print, as a literal label pinned to the map */}
          <div className="h-9 w-[256px]">
            <AnimatePresence>
              {showNumbers && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-md border border-amber-300/25 bg-amber-400/[0.07] px-2.5 py-1 text-center text-[10.5px] leading-snug text-amber-100/90"
                >
                  fine print: tallied from <b>only</b> the {kept.toLocaleString()} runs where box
                  #{slice + 1} clicked
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ——— the records ——— */}
        <div className="flex w-[225px] flex-col items-center gap-2.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">the records</div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[12.5px] text-slate-200">
            <span className="mr-2 text-[10.5px] uppercase tracking-wider text-slate-500">pile:</span>
            <b className="tabular-nums">{PILE.toLocaleString()}</b> runs
          </div>
          <div className="h-8">
            <AnimatePresence>
              {phase !== "pile" && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-full border border-sky-300/25 bg-sky-400/10 px-4 py-1.5 text-[12.5px] text-sky-100"
                >
                  <span className="mr-2 text-[10.5px] uppercase tracking-wider text-sky-300/70">
                    kept:
                  </span>
                  <b className="tabular-nums">{shownKept.toLocaleString()}</b>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex w-full flex-col gap-1">
            {sampleRows.map(({ pair: [a, b], idx }, row) => {
              const isKept = a === slice || b === slice;
              const decided = phase !== "pile" && prog >= (row + 1) / (sampleRows.length + 1);
              const dropped = decided && !isKept;
              return (
                <div
                  key={idx}
                  className={`rounded-md px-3 py-0.5 text-center text-[12px] tabular-nums transition-all duration-300 ${
                    dropped
                      ? "bg-white/[0.02] text-slate-600 line-through opacity-45"
                      : decided && isKept
                        ? "bg-sky-400/10 text-sky-100"
                        : "bg-white/[0.03] text-slate-400"
                  }`}
                >
                  (#{a + 1} &amp; #{b + 1})
                </div>
              );
            })}
            <div className="text-center text-[10.5px] text-slate-600">
              …and {(PILE - sampleRows.length).toLocaleString()} more records
            </div>
          </div>
        </div>
      </div>

      {/* ——— controls ——— */}
      <div className="flex items-center gap-2">
        {phase === "pile" && (
          <button
            onClick={() => startSlice(0, false)}
            className="rounded-full bg-sky-400/15 px-4 py-2 text-[13px] font-medium text-sky-200 transition hover:bg-sky-400/25"
          >
            keep only the runs where box #1 clicked
          </button>
        )}
        {(phase === "filtering" || phase === "tallying") && (
          <button
            disabled
            className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] text-slate-400 opacity-70"
          >
            {phase === "filtering" ? "sorting the records…" : "counting the dots…"}
          </button>
        )}
        {phase === "marks" && (
          <button
            onClick={startTally}
            className="rounded-full bg-amber-400/15 px-4 py-2 text-[13px] font-medium text-amber-200 transition hover:bg-amber-400/25"
          >
            tally the dots → 16 numbers
          </button>
        )}
        {phase === "map" && (
          <button
            onClick={() => startSlice(10, true)}
            className="rounded-full bg-sky-400/15 px-4 py-2 text-[13px] font-medium text-sky-200 transition hover:bg-sky-400/25"
          >
            now slice by box #11 instead
          </button>
        )}
        {(phase === "map" || phase === "free") && (
          <button
            onClick={reset}
            className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] text-slate-300 transition hover:bg-white/10"
          >
            start over
          </button>
        )}
      </div>

      <div className="h-9 max-w-[520px] text-center text-[12px] leading-snug text-slate-400">
        {phase === "pile" && (
          <p className="text-slate-500">
            every record is one run: two clicks, one pair of boxes
          </p>
        )}
        {phase === "filtering" && (
          <p>
            sorting… <b className="text-amber-200">dots</b> pile up where the surviving runs'{" "}
            <b>other</b> clicks landed
          </p>
        )}
        {phase === "marks" && (
          <p>
            {kept.toLocaleString()} runs survived the cut. the{" "}
            <b className="text-amber-200">dots</b> show where their partner clicks landed —
            notice they keep their distance from the <b className="text-sky-300">✓ box</b>
          </p>
        )}
        {phase === "tallying" && <p>counting dots, box by box…</p>}
        {phase === "map" && (
          <p>
            16 odds for the other electron — <b>with fine print attached</b>
          </p>
        )}
        {phase === "free" && (
          <p>
            same pile, different slice — and the <b>whole list</b> reshuffled.{" "}
            <span className="text-slate-500">click any box to slice by it.</span>
          </p>
        )}
      </div>
    </div>
  );
}
