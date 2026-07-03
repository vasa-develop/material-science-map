import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAmbient } from "./useAmbient";

/**
 * Asset: "16 boxes, 16 numbers" — the single-electron likelihood map for the
 * rough-draft's shrunken 2D world.
 *
 * Left: the 4×4 world, one number per box ("if we go looking for the
 * electron, how likely are we to find it inside this box?"), heat-shaded.
 * Right: the same sixteen numbers written out as an addition that totals
 * 100% — deliberately NOT framed as "a list" (the prose hasn't introduced
 * that yet); it's just the receipt proving the map is one complete forecast.
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

  // ambient walk: visit each box in reading order, then rest on the total
  useEffect(() => {
    if (!ambient) return;
    const iv = window.setInterval(
      () => setPhase((ph) => (ph + 1) % (CELLS + 4)),
      1150,
    );
    return () => window.clearInterval(iv);
  }, [ambient]);

  const focus = hover ?? (ambient && phase < CELLS ? phase : null);
  const sumHot = hover === null && ambient && phase >= CELLS;

  const enter = (i: number) => {
    notifyInteraction();
    setHover(i);
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-[#06070d] px-4">
      {/* caption */}
      <p className="max-w-[620px] text-center text-[13.5px] leading-relaxed text-slate-300">
        One electron, sixteen boxes. For each box we ask the same question —{" "}
        <i>
          "if we go looking for the electron, how likely are we to find it inside{" "}
          <b>this</b> box?"
        </i>{" "}
        — and write the answer down.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-10">
        {/* ——— the world ——— */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            the 2D region — 4 × 4 = 16 boxes
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
                      fill: `rgba(56,189,248,${sumHot ? a + 0.12 : a})`,
                      opacity: focus === null || hot ? 1 : 0.35,
                    }}
                    transition={{ duration: 0.3 }}
                    stroke={hot ? "#7dd3fc" : "transparent"}
                    strokeWidth={1.5}
                  />
                  <text
                    x={x * CELL + 9}
                    y={y * CELL + 17}
                    fontSize="9"
                    fill="rgba(148,163,184,0.55)"
                  >
                    #{i + 1}
                  </text>
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
                </g>
              );
            })}
            {/* nucleus */}
            <circle cx={SIZE / 2} cy={SIZE / 2} r={6} fill="#f8fafc" opacity={0.85} />
          </svg>
          <div className="text-[11px] text-slate-500">
            ⚪ the nucleus — boxes near it are likelier
          </div>
        </div>

        {/* ——— the receipt ——— */}
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
      </div>
    </div>
  );
}
