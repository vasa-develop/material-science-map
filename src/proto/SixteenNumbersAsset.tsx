import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAmbient } from "./useAmbient";

/**
 * Asset: "16 boxes, 16 numbers" — the single-electron likelihood map for the
 * rough-draft's shrunken 2D world.
 *
 * Two views:
 *  · "the odds" — the 4×4 world, one number per box ("if we go looking for
 *    the electron, how likely are we to find it inside this box?"), plus the
 *    sixteen numbers written as an addition totalling 100% (a receipt, not
 *    "a list" — the prose hasn't introduced lists yet).
 *  · "flip the detectors on" — every box wired with its own detector; each
 *    run gives exactly one click, and the click-shares converge onto the
 *    computed odds. Cashes out what the numbers MEAN (the pile, not the next
 *    click) — sampling verifies the map, it is not where the map came from.
 *
 * Uses the same marginal distribution as JointTableAsset so the reader meets
 * the identical map again when the two-electron table shows up.
 */

const N = 4;
const CELLS = N * N;
const CELL = 64;
const SIZE = N * CELL;

const pos = (i: number) => ({ x: i % N, y: Math.floor(i / N) });
const C = (N - 1) / 2;

/** same shape as JointTableAsset's marginal(): likelier near the nucleus */
function marginal(): number[] {
  const w = Array.from({ length: CELLS }, (_, i) => {
    const { x, y } = pos(i);
    return Math.exp(-((x - C) ** 2 + (y - C) ** 2) / (2 * 1.15 ** 2));
  });
  const t = w.reduce((a, b) => a + b, 0);
  return w.map((v) => (v / t) * 100);
}

/** round to 1 decimal so the printed terms visibly sum to exactly 100.0 */
function roundTo100(vals: number[]): number[] {
  const r = vals.map((v) => Math.round(v * 10) / 10);
  const diff = Math.round((100 - r.reduce((a, b) => a + b, 0)) * 10) / 10;
  const iMax = r.indexOf(Math.max(...r));
  r[iMax] = Math.round((r[iMax] + diff) * 10) / 10;
  return r;
}

const fmt = (v: number) => v.toFixed(1) + "%";

export default function SixteenNumbersAsset() {
  const p = useMemo(() => roundTo100(marginal()), []);
  const maxP = useMemo(() => Math.max(...p), [p]);

  const { ambient, notifyInteraction } = useAmbient(9000);
  const [hover, setHover] = useState<number | null>(null);
  const [phase, setPhase] = useState(0);
  const [mode, setMode] = useState<"odds" | "detect">("odds");
  const [counts, setCounts] = useState<number[]>(() => Array(CELLS).fill(0));
  const [runs, setRuns] = useState(0);
  const [lastClick, setLastClick] = useState<number | null>(null);

  const sample = () => {
    const r = Math.random() * 100;
    let acc = 0;
    for (let i = 0; i < CELLS; i++) {
      acc += p[i];
      if (r < acc) return i;
    }
    return CELLS - 1;
  };

  const run = (n: number) => {
    setCounts((prev) => {
      const next = [...prev];
      let last = 0;
      for (let k = 0; k < n; k++) {
        last = sample();
        next[last] += 1;
      }
      setLastClick(last);
      return next;
    });
    setRuns((r) => r + n);
  };

  const reset = () => {
    setCounts(Array(CELLS).fill(0));
    setRuns(0);
    setLastClick(null);
  };

  // ambient walk: visit each box in reading order, then rest on the total
  useEffect(() => {
    if (!ambient || mode !== "odds") return;
    const iv = window.setInterval(
      () => setPhase((ph) => (ph + 1) % (CELLS + 4)),
      1150,
    );
    return () => window.clearInterval(iv);
  }, [ambient, mode]);

  // in detector view, idle = the experiment keeps running itself
  useEffect(() => {
    if (!ambient || mode !== "detect") return;
    const iv = window.setInterval(() => run(1), 420);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient, mode]);

  const focus = hover ?? (ambient && mode === "odds" && phase < CELLS ? phase : null);
  const sumHot = hover === null && mode === "odds" && ambient && phase >= CELLS;

  const shares = useMemo(
    () => counts.map((c) => (runs > 0 ? (c / runs) * 100 : 0)),
    [counts, runs],
  );
  const maxShare = Math.max(...shares, 1e-9);

  const enter = (i: number) => {
    notifyInteraction();
    setHover(i);
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-[#06070d] px-4">
      {/* caption */}
      <p className="max-w-[620px] text-center text-[13.5px] leading-relaxed text-slate-300">
        {mode === "odds" ? (
          <>
            One electron, sixteen boxes. For each box we ask the same question —{" "}
            <i>
              "if we go looking for the electron, how likely are we to find it inside{" "}
              <b>this</b> box?"
            </i>{" "}
            — and write the answer down.
          </>
        ) : (
          <>
            Now wire every box with its own tiny <b>electron detector</b>. Each run: a fresh
            electron, detectors on — <b>exactly one click</b>. No single run can be predicted; but
            watch what the <i>pile</i> of runs does.
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-10">
        {/* ——— the world ——— */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            {mode === "odds"
              ? "the 2D region — 4 × 4 = 16 boxes"
              : "sixteen detectors — % of clicks each has caught"}
          </div>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="rounded-lg border border-white/10"
            onPointerLeave={() => setHover(null)}
          >
            {p.map((v, i) => {
              const { x, y } = pos(i);
              const hot = focus === i;
              const a = 0.07 + (v / maxP) * 0.6;
              const sa = 0.06 + (shares[i] / maxShare) * 0.55;
              return (
                <g key={i} onPointerEnter={() => enter(i)}>
                  <rect
                    x={x * CELL + 2}
                    y={y * CELL + 2}
                    width={CELL - 4}
                    height={CELL - 4}
                    rx={6}
                    fill="#0b0e18"
                    stroke="rgba(148,163,184,0.18)"
                  />
                  <motion.rect
                    x={x * CELL + 2}
                    y={y * CELL + 2}
                    width={CELL - 4}
                    height={CELL - 4}
                    rx={6}
                    initial={false}
                    animate={{
                      fill:
                        mode === "odds"
                          ? `rgba(56,189,248,${sumHot ? a + 0.12 : a})`
                          : runs > 0
                            ? `rgba(251,191,36,${sa})`
                            : "rgba(251,191,36,0)",
                      opacity: focus === null || hot ? 1 : 0.35,
                    }}
                    transition={{ duration: 0.3 }}
                    stroke={hot ? (mode === "odds" ? "#7dd3fc" : "#fde68a") : "transparent"}
                    strokeWidth={1.5}
                  />
                  {/* click flash */}
                  {mode === "detect" && lastClick === i && (
                    <motion.rect
                      key={runs}
                      x={x * CELL + 2}
                      y={y * CELL + 2}
                      width={CELL - 4}
                      height={CELL - 4}
                      rx={6}
                      initial={{ fill: "rgba(248,250,252,0.75)" }}
                      animate={{ fill: "rgba(248,250,252,0)" }}
                      transition={{ duration: 0.55 }}
                    />
                  )}
                  <text
                    x={x * CELL + 9}
                    y={y * CELL + 17}
                    fontSize="9"
                    fill="rgba(148,163,184,0.55)"
                  >
                    #{i + 1}
                  </text>
                  {mode === "odds" ? (
                    <text
                      x={x * CELL + CELL / 2}
                      y={y * CELL + CELL / 2 + 10}
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight={600}
                      fill="#bae6fd"
                    >
                      {fmt(v)}
                    </text>
                  ) : (
                    <>
                      <text
                        x={x * CELL + CELL / 2}
                        y={y * CELL + CELL / 2 + 6}
                        textAnchor="middle"
                        fontSize="13"
                        fontWeight={600}
                        fill="#fde68a"
                      >
                        {runs > 0 ? fmt(shares[i]) : "—"}
                      </text>
                      <text
                        x={x * CELL + CELL / 2}
                        y={y * CELL + CELL / 2 + 22}
                        textAnchor="middle"
                        fontSize="8.5"
                        fill="rgba(125,211,252,0.7)"
                      >
                        odds {fmt(v)}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
            {/* nucleus */}
            <circle cx={SIZE / 2} cy={SIZE / 2} r={6} fill="#f8fafc" opacity={0.85} />
          </svg>
          <div className="text-[11px] text-slate-500">
            {mode === "odds"
              ? "⚪ the nucleus — boxes near it are likelier"
              : "amber = share of clicks so far · blue = the computed odds"}
          </div>
        </div>

        {/* ——— right panel ——— */}
        {mode === "odds" ? (
          <div className="flex w-[320px] flex-col items-center gap-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              the sixteen answers, added up
            </div>
            <div
              className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1.5"
              onPointerLeave={() => setHover(null)}
            >
              {p.map((v, i) => {
                const hot = focus === i;
                return (
                  <span key={i} className="flex items-center gap-1">
                    <motion.span
                      onPointerEnter={() => enter(i)}
                      initial={false}
                      animate={{
                        backgroundColor: `rgba(56,189,248,${0.06 + (v / maxP) * 0.32})`,
                        opacity: focus === null || hot ? 1 : 0.4,
                      }}
                      transition={{ duration: 0.25 }}
                      className={`cursor-default rounded-md px-1.5 py-0.5 text-[12px] tabular-nums text-sky-100 ring-1 ${
                        hot ? "ring-sky-300" : "ring-transparent"
                      }`}
                    >
                      {fmt(v)}
                    </motion.span>
                    {i < CELLS - 1 && (
                      <span className="text-[11px] text-slate-600">+</span>
                    )}
                  </span>
                );
              })}
              <span className="ml-1 text-[12px] text-slate-500">=</span>
              <motion.span
                initial={false}
                animate={{
                  backgroundColor: sumHot
                    ? "rgba(56,189,248,0.22)"
                    : "rgba(255,255,255,0.05)",
                  scale: sumHot ? 1.08 : 1,
                }}
                transition={{ duration: 0.35 }}
                className="rounded-md px-2 py-0.5 text-[13px] font-bold tabular-nums text-sky-200"
              >
                100%
              </motion.span>
            </div>

            {/* status line */}
            <p className="h-9 max-w-[300px] text-center text-[11.5px] leading-snug text-slate-400">
              {focus !== null ? (
                <>
                  box #{focus + 1}: if we go looking, there's a{" "}
                  <b className="text-sky-200">{fmt(p[focus])}</b> chance we find the
                  electron there
                </>
              ) : sumHot ? (
                <>
                  the electron will be found <b>somewhere</b> — so the sixteen numbers
                  must add up to 100%
                </>
              ) : (
                <span className="text-slate-600">
                  hover a box — or one of the numbers — to read it
                </span>
              )}
            </p>
          </div>
        ) : (
          <div className="flex w-[320px] flex-col items-center gap-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              the experiment, rerun
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-slate-200">
              <span className="mr-2 text-[11px] uppercase tracking-wider text-slate-500">
                runs:
              </span>
              <b className="tabular-nums">{runs.toLocaleString()}</b>
              <span className="ml-2 text-[11px] text-slate-500">one click each</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  notifyInteraction();
                  run(1);
                }}
                className="rounded-full bg-amber-400/15 px-3.5 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-400/25"
              >
                one run
              </button>
              <button
                onClick={() => {
                  notifyInteraction();
                  run(100);
                }}
                className="rounded-full bg-amber-400/15 px-3.5 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-400/25"
              >
                ×100 runs
              </button>
              <button
                onClick={() => {
                  notifyInteraction();
                  reset();
                }}
                className="rounded-full bg-white/[0.06] px-3.5 py-1.5 text-xs text-slate-400 transition hover:bg-white/10"
              >
                reset
              </button>
            </div>
            <p className="h-9 max-w-[300px] text-center text-[11.5px] leading-snug text-slate-400">
              {focus !== null ? (
                <>
                  detector #{focus + 1}: computed{" "}
                  <b className="text-sky-200">{fmt(p[focus])}</b> · saw{" "}
                  <b className="text-amber-200">
                    {runs > 0 ? fmt(shares[focus]) : "—"}
                  </b>{" "}
                  of {runs.toLocaleString()} clicks
                </>
              ) : runs === 0 ? (
                <span className="text-slate-600">
                  no runs yet — press <b>one run</b> and watch a single detector click
                </span>
              ) : (
                <>
                  no run's click was predictable — but the shares are settling onto the
                  computed odds
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* mode switch */}
      <div className="flex items-center gap-1.5">
        {(
          [
            ["odds", "the odds"],
            ["detect", "flip the detectors on"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => {
              notifyInteraction();
              setMode(m);
              setHover(null);
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs transition ${
              mode === m
                ? "bg-white/15 font-medium text-white"
                : "bg-white/[0.05] text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
