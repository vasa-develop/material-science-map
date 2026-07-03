import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAmbient } from "./useAmbient";

/**
 * Asset: "two clicks, one pair" — the two-electron experiment, run visibly.
 *
 * Sits between "each run hands us a pair of boxes" and the slicing beat
 * (two-cases). Its only job: MAKE THE PILE REAL. One press = one run = two
 * simultaneous clicks = one ledger row; the ×1,000 button grows the pile
 * fast, enacting "rerun it a few thousand times."
 *
 * Deliberate constraints (see chat, 2026-07-04):
 *  · Both clicks the SAME color — tinting them differently would
 *    reintroduce "first/second electron," which the pair framing avoids.
 *    Ledger rows print the pair sorted, reinforcing unorderedness.
 *  · No sorting/filtering/percentages — slicing belongs to two-cases.
 *  · Same-box pairs are ALLOWED (vasa's catch, 2026-07-04): the boxes are
 *    coarse regions, so both electrons landing in one box is a valid, rare
 *    outcome — and the joint table's 16×16 count includes the diagonal, so
 *    the pile must be able to produce it. Rendered as two side-by-side dots
 *    with an explanatory status line, so it teaches instead of confusing.
 *  · Pairs are sampled from the same joint structure as two-cases /
 *    joint-table, so the repulsion is IN the data: dots are rarely
 *    neighbors, pre-seeding the dependence beat.
 */

const N = 4;
const CELLS = N * N;
const CELL = 64;
const SIZE = N * CELL;

const pos = (i: number) => ({ x: i % N, y: Math.floor(i / N) });
const C = (N - 1) / 2;

/** first electron: same marginal shape as sixteen-numbers / joint-table */
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

type Phase = "idle" | "armed" | "clicked";

export default function PairRunAsset() {
  const marg = useMemo(() => marginal(), []);
  const conds = useMemo(() => Array.from({ length: CELLS }, (_, b) => conditional(b)), []);
  const { ambient, notifyInteraction } = useAmbient(9000);

  const [phase, setPhase] = useState<Phase>("idle");
  const [pair, setPair] = useState<[number, number] | null>(null);
  const [ledger, setLedger] = useState<[number, number][]>([]);
  const [runs, setRuns] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [fast, setFast] = useState(false);
  const [justFast, setJustFast] = useState(false);
  const fastIv = useRef<number | null>(null);

  const samplePair = (): [number, number] => {
    const a = draw(marg);
    const b = draw(conds[a]);
    return a <= b ? [a, b] : [b, a];
  };

  const record = (p: [number, number]) => {
    setPair(p);
    setLedger((prev) => [p, ...prev].slice(0, 8));
    setRuns((r) => r + 1);
    setRunKey((k) => k + 1);
  };

  const runOnce = () => {
    if (phase === "armed" || fast) return;
    setPhase("armed");
    setPair(null);
    window.setTimeout(() => {
      record(samplePair());
      setPhase("clicked");
      setJustFast(false);
    }, 650);
  };

  const runFast = (n = 1000) => {
    if (fast || phase === "armed") return;
    setFast(true);
    setPhase("clicked");
    let done = 0;
    fastIv.current = window.setInterval(() => {
      const chunk = Math.min(done < 40 ? 2 : done < 200 ? 10 : 40, n - done);
      let last: [number, number] = samplePair();
      for (let i = 1; i < chunk; i++) last = samplePair();
      done += chunk;
      // record chunk: bump totals, show only the latest pair
      setLedger((prev) => [last, ...prev].slice(0, 8));
      setPair(last);
      setRuns((r) => r + chunk);
      setRunKey((k) => k + 1);
      if (done >= n) {
        if (fastIv.current !== null) window.clearInterval(fastIv.current);
        fastIv.current = null;
        setFast(false);
        setJustFast(true);
      }
    }, 45);
  };

  useEffect(
    () => () => {
      if (fastIv.current !== null) window.clearInterval(fastIv.current);
    },
    [],
  );

  // ambient: quietly demo single runs
  useEffect(() => {
    if (!ambient) return;
    const iv = window.setInterval(() => runOnce(), 4200);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-[#06070d] px-4">
      <p className="max-w-[600px] text-center text-[13.5px] leading-relaxed text-slate-300">
        Same tiny world, but now <b>two</b> electrons are in there — somewhere. Flip the
        detectors on: <b>two clicks</b>, one per electron. Every run adds one <i>pair</i> of
        boxes to the records.
      </p>

      <div className="flex flex-wrap items-start justify-center gap-10">
        {/* ——— the world ——— */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-4 text-[11px] uppercase tracking-wider text-slate-500">
            {phase === "armed" ? "detectors on…" : "the tiny world"}
          </div>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="rounded-lg border border-white/10"
          >
            {marg.map((_, i) => {
              const { x, y } = pos(i);
              const hitCount =
                phase === "clicked" && pair !== null
                  ? (pair[0] === i ? 1 : 0) + (pair[1] === i ? 1 : 0)
                  : 0;
              const isHit = hitCount > 0;
              return (
                <g key={i}>
                  <rect
                    x={x * CELL + 2}
                    y={y * CELL + 2}
                    width={CELL - 4}
                    height={CELL - 4}
                    rx={6}
                    fill="#0b0e18"
                    stroke={
                      isHit
                        ? "rgba(251,191,36,0.75)"
                        : phase === "armed"
                          ? "rgba(125,211,252,0.35)"
                          : "rgba(148,163,184,0.18)"
                    }
                    strokeWidth={isHit ? 1.5 : 1}
                  />
                  {isHit && (
                    <motion.rect
                      key={runKey}
                      x={x * CELL + 2}
                      y={y * CELL + 2}
                      width={CELL - 4}
                      height={CELL - 4}
                      rx={6}
                      initial={{ fill: "rgba(248,250,252,0.85)" }}
                      animate={{ fill: "rgba(251,191,36,0.28)" }}
                      transition={{ duration: 0.6 }}
                    />
                  )}
                  <text x={x * CELL + 9} y={y * CELL + 17} fontSize="9" fill="rgba(148,163,184,0.55)">
                    #{i + 1}
                  </text>
                  {isHit &&
                    Array.from({ length: hitCount }, (_, d) => (
                      <motion.circle
                        key={`dot-${runKey}-${i}-${d}`}
                        cx={x * CELL + CELL / 2 + (hitCount === 2 ? (d === 0 ? -9 : 9) : 0)}
                        cy={y * CELL + CELL / 2 + 4}
                        r={7}
                        fill="#fbbf24"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.25, delay: d * 0.08 }}
                      />
                    ))}
                </g>
              );
            })}
            <circle cx={SIZE / 2} cy={SIZE / 2} r={6} fill="#f8fafc" opacity={0.85} />
          </svg>
          <div className="h-4 text-[11px] text-slate-500">
            ⚪ the nucleus · two electrons in there — we can't say where
          </div>
        </div>

        {/* ——— the records ——— */}
        <div className="flex w-[220px] flex-col items-center gap-2.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            the records — one pair per run
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-slate-200">
            <span className="mr-2 text-[11px] uppercase tracking-wider text-slate-500">runs:</span>
            <b className="tabular-nums">{runs.toLocaleString()}</b>
          </div>
          <div className="flex min-h-[176px] w-full flex-col gap-1">
            <AnimatePresence initial={false}>
              {ledger.map(([a, b], idx) => (
                <motion.div
                  key={`${runs}-${idx}`}
                  initial={idx === 0 ? { opacity: 0, y: -6 } : false}
                  animate={{ opacity: idx === 0 ? 1 : 0.45 + 0.4 / (idx + 1), y: 0 }}
                  className={`rounded-md px-3 py-0.5 text-center text-[12.5px] tabular-nums ${
                    idx === 0 ? "bg-amber-400/15 text-amber-100" : "bg-white/[0.03] text-slate-400"
                  }`}
                >
                  (#{a + 1} &amp; #{b + 1})
                </motion.div>
              ))}
            </AnimatePresence>
            {ledger.length === 0 && (
              <div className="px-3 py-0.5 text-center text-[12px] text-slate-600">no runs yet</div>
            )}
            {runs > 8 && (
              <div className="text-center text-[11px] text-slate-600">
                …and {(runs - 8).toLocaleString()} more
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            notifyInteraction();
            runOnce();
          }}
          disabled={phase === "armed" || fast}
          className="rounded-full bg-amber-400/15 px-4 py-2 text-[13px] font-medium text-amber-200 transition hover:bg-amber-400/25 disabled:opacity-50"
        >
          {phase === "idle"
            ? "flip the detectors on"
            : phase === "armed"
              ? "detectors listening…"
              : "prepare fresh electrons · run again"}
        </button>
        <button
          onClick={() => {
            notifyInteraction();
            runFast(1000);
          }}
          disabled={fast || phase === "armed"}
          className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
        >
          {fast ? "running…" : "run ×1,000"}
        </button>
      </div>

      <div className="h-9 max-w-[460px] text-center text-[12px] leading-snug text-slate-400">
        {fast ? (
          <p>piling up pairs…</p>
        ) : justFast && runs > 500 ? (
          <p>
            a big pile of pairs — the raw data for what comes next. (notice the two clicks are
            rarely next-door neighbors…)
          </p>
        ) : phase === "clicked" && pair !== null && pair[0] === pair[1] ? (
          <p>
            <b className="text-amber-200">click-click!</b> — both from box{" "}
            <b>#{pair[0] + 1}</b>! rare, but a perfectly valid pair: the boxes are roomy
            enough for both electrons to turn up in the same one.
          </p>
        ) : phase === "clicked" && pair !== null ? (
          <p>
            <b className="text-amber-200">click-click!</b> — boxes <b>#{pair[0] + 1}</b> and{" "}
            <b>#{pair[1] + 1}</b>. one run, two clicks, one pair for the records.
          </p>
        ) : (
          <p className="text-slate-600">press a button and watch what happens</p>
        )}
      </div>
    </div>
  );
}
