import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAmbient } from "./useAmbient";

/**
 * Asset: "the million-number table" — a 3b1b-style self-narrating animation
 * showing WHY two electrons need N×N numbers, not N+N.
 *
 * We shrink the world to a flat 4×4 patch (16 boxes) so every number fits on
 * screen, then build the joint table row by row: for each box blue might be
 * in, amber needs a fresh 16-number list → 16 rows of 16 = 256. Finally we
 * un-shrink back to the real 1,000-box world → 1,000,000.
 *
 * Interactive only where it serves: hover a table cell to ask its concrete
 * question; click a world box to place blue there and see its row light up.
 */

const N = 4;
const CELLS = N * N;
const WCELL = 52;
const WSIZE = N * WCELL;
const TCELL = 15;
const TSIZE = CELLS * TCELL;

const pos = (i: number) => ({ x: i % N, y: Math.floor(i / N) });
const CX = (N - 1) / 2;
const CY = (N - 1) / 2;

function normalize(w: number[]): number[] {
  const t = w.reduce((a, b) => a + b, 0);
  return w.map((v) => (v / t) * 100);
}

/** blue's own likelihoods: prefers boxes near the nucleus (center) */
function marginal(): number[] {
  return normalize(
    Array.from({ length: CELLS }, (_, i) => {
      const { x, y } = pos(i);
      return Math.exp(-((x - CX) ** 2 + (y - CY) ** 2) / (2 * 1.15 ** 2));
    }),
  );
}

/** amber's likelihoods GIVEN blue sits in box b: near nucleus but away from blue */
function conditional(b: number): number[] {
  const bp = pos(b);
  return normalize(
    Array.from({ length: CELLS }, (_, i) => {
      const { x, y } = pos(i);
      const nuc = Math.exp(-((x - CX) ** 2 + (y - CY) ** 2) / (2 * 1.6 ** 2));
      const rep = 1 - 0.93 * Math.exp(-((x - bp.x) ** 2 + (y - bp.y) ** 2) / (2 * 1.05 ** 2));
      return nuc * rep;
    }),
  );
}

const fmtPct = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1)) + "%";

/** rolling count-up for the big counter */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const v0 = from.current;
    const dur = Math.abs(value - v0) > 5000 ? 1600 : 450;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - (1 - k) ** 3;
      setShown(Math.round(v0 + (value - v0) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="tabular-nums">{shown.toLocaleString()}</span>;
}

const CAPTIONS = [
  <>Our real box was 10 × 10 × 10 — a <b>thousand</b> little boxes. Too many to draw. So let's shrink the world down to a flat 4 × 4 patch: <b>sixteen boxes</b>. Nothing important changes — we'll scale back up at the end.</>,
  <>One electron — call it <b className="text-sky-300">blue</b>. One number per box: how likely a look is to <b>find</b> it there. <b>Sixteen numbers</b>, adding up to 100%. Easy.</>,
  <>Add a second electron — <b className="text-amber-300">amber</b> — and try the tempting move: give it its own sixteen numbers. 16 + 16 = 32, done? …except amber's numbers <b>depend on where blue turns up</b>.</>,
  <>So let's cover every case, honestly. <b>Suppose</b> a look finds blue in box #1 — not a claim that it <i>is</i> there, just one way the look could turn out. Amber's list <i>for that case</i>: <b>row #1</b>. Found in box #2 instead? A different list — <b>row #2</b>. Box #3 → <b>row #3</b>…</>,
  <>And there's nothing special about the first three boxes — blue could turn up in <b>any</b> of the sixteen. Sixteen rows, sixteen numbers each: <b>16 × 16 = 256</b>.</>,
  <>Look at what we've built: every cell answers one very concrete question — <i>"how likely is a look to find <b className="text-sky-300">blue</b> in box A <b>and</b> <b className="text-amber-300">amber</b> in box B?"</i> One big joint list, not lists-of-lists. (<b>Hover the table</b> to ask a question; <b>click a world box</b> to place blue.)</>,
  <>Now <b>un-shrink</b> the world. With 1,000 boxes, the very same table becomes 1,000 rows × 1,000 columns: <b>one million numbers</b>. And every extra electron multiplies the pile by another thousand.</>,
] as const;

const DUR = [5600, 5600, 7200, 9600, 7200, 9000, 16000];

export default function JointTableAsset() {
  const [beat, setBeat] = useState(0);
  const [rows, setRows] = useState(0);
  const [blue, setBlue] = useState<number | null>(null);
  const [hover, setHover] = useState<{ a: number; b: number } | null>(null);

  const { ambient, notifyInteraction } = useAmbient(12000);

  const p1 = useMemo(marginal, []);
  const conds = useMemo(() => Array.from({ length: CELLS }, (_, b) => conditional(b)), []);
  const joint = useMemo(
    () => conds.map((row, b) => row.map((v) => (p1[b] * v) / 100)),
    [conds, p1],
  );
  const maxJoint = useMemo(() => Math.max(...joint.flat()), [joint]);
  const maxCond = useMemo(() => Math.max(...conds.flat()), [conds]);
  const maxP1 = useMemo(() => Math.max(...p1), [p1]);

  // auto-advance beats while in attract mode
  useEffect(() => {
    if (!ambient) return;
    const t = window.setTimeout(
      () => setBeat((b) => (b >= CAPTIONS.length - 1 ? 0 : b + 1)),
      DUR[beat],
    );
    return () => window.clearTimeout(t);
  }, [beat, ambient]);

  // row-stamping choreography
  useEffect(() => {
    if (beat < 3) {
      setRows(0);
      setBlue(null);
      return;
    }
    if (beat === 3) {
      if (!ambient) return;
      setRows(0);
      let r = 0;
      const iv = window.setInterval(() => {
        r += 1;
        setRows(r);
        setBlue(r - 1);
        if (r >= 3) window.clearInterval(iv);
      }, 2500);
      return () => window.clearInterval(iv);
    }
    if (beat === 4) {
      if (!ambient) {
        setRows(16);
        return;
      }
      let r = 3;
      setRows((c) => Math.max(c, 3));
      const iv = window.setInterval(() => {
        r += 1;
        setRows(r);
        setBlue(r - 1);
        if (r >= CELLS) {
          window.clearInterval(iv);
          window.setTimeout(() => setBlue(null), 600);
        }
      }, 180);
      return () => window.clearInterval(iv);
    }
    setRows(CELLS);
  }, [beat, ambient]);

  // beat 5's guided example cell (when the user isn't hovering one)
  const focus = hover ?? (beat === 5 && blue === null ? { a: 5, b: 10 } : null);

  const jumpTo = (b: number) => {
    notifyInteraction();
    setBeat(b);
    setHover(null);
    if (b === 3) {
      setRows(3);
      setBlue(2);
    } else if (b >= 4) {
      setRows(CELLS);
    }
    if (b < 3) setBlue(null);
  };

  const placeBlue = (i: number) => {
    if (beat < 3) return;
    notifyInteraction();
    setBlue(i);
    setHover(null);
    if (rows < i + 1) setRows(i + 1);
  };

  const counter =
    beat === 0 ? 0 : beat === 1 ? CELLS : beat === 2 ? CELLS * 2 : beat === 6 ? 1_000_000 : rows * CELLS;
  const counterLabel =
    beat <= 1
      ? "numbers written"
      : beat === 2
        ? "numbers written (…so we hoped)"
        : beat === 6
          ? "numbers needed — real box, 2 electrons"
          : "numbers written";

  // what the world-grid shows
  const showBlueHeat = beat === 1 || beat === 2 || (beat >= 4 && blue === null && !focus);
  const showAmberHeat = beat === 2;
  const condRow = focus ? conds[focus.a] : blue !== null ? conds[blue] : null;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#06070d] px-4">
      {/* caption */}
      <div className="flex h-[76px] max-w-[660px] items-center text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={beat}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="text-[13.5px] leading-relaxed text-slate-300"
          >
            {CAPTIONS[beat]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-start justify-center gap-10">
        {/* ——— the world ——— */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">the world — 16 boxes</div>
          <svg width={WSIZE} height={WSIZE} viewBox={`0 0 ${WSIZE} ${WSIZE}`} className="rounded-lg border border-white/10">
            {Array.from({ length: CELLS }, (_, i) => {
              const { x, y } = pos(i);
              const blueA = showBlueHeat ? 0.08 + (p1[i] / maxP1) * 0.6 : 0;
              const amberA = showAmberHeat
                ? 0.05 + (conds[7][i] / maxCond) * 0.4
                : condRow
                  ? 0.06 + (condRow[i] / maxCond) * 0.62
                  : 0;
              const isBlueDot = focus ? focus.a === i : blue === i;
              const isAmberDot = focus ? focus.b === i : false;
              return (
                <g key={i} onClick={() => placeBlue(i)} className={beat >= 3 ? "cursor-pointer" : ""}>
                  <rect
                    x={x * WCELL + 1.5}
                    y={y * WCELL + 1.5}
                    width={WCELL - 3}
                    height={WCELL - 3}
                    rx={5}
                    fill="#0b0e18"
                    stroke="rgba(148,163,184,0.18)"
                  />
                  {blueA > 0 && (
                    <motion.rect
                      x={x * WCELL + 1.5}
                      y={y * WCELL + 1.5}
                      width={WCELL - 3}
                      height={WCELL - 3}
                      rx={5}
                      animate={{ fill: `rgba(56,189,248,${blueA})` }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                  {amberA > 0 && (
                    <motion.rect
                      x={x * WCELL + (showAmberHeat ? 13 : 1.5)}
                      y={y * WCELL + (showAmberHeat ? 13 : 1.5)}
                      width={WCELL - (showAmberHeat ? 26 : 3)}
                      height={WCELL - (showAmberHeat ? 26 : 3)}
                      rx={5}
                      animate={{ fill: `rgba(251,191,36,${showAmberHeat ? amberA + 0.25 : amberA})` }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                  {/* box number or likelihood value */}
                  <text
                    x={x * WCELL + 7}
                    y={y * WCELL + 14}
                    fontSize="8"
                    fill="rgba(148,163,184,0.55)"
                  >
                    #{i + 1}
                  </text>
                  {beat === 1 && (
                    <text x={x * WCELL + WCELL / 2} y={y * WCELL + WCELL / 2 + 9} textAnchor="middle" fontSize="11" fontWeight={600} fill="#bae6fd">
                      {fmtPct(p1[i])}
                    </text>
                  )}
                  {condRow && !isBlueDot && (
                    <text x={x * WCELL + WCELL / 2} y={y * WCELL + WCELL / 2 + 9} textAnchor="middle" fontSize="11" fontWeight={600} fill="#fde68a">
                      {fmtPct(condRow[i])}
                    </text>
                  )}
                  {isBlueDot && (
                    <circle cx={x * WCELL + WCELL / 2} cy={y * WCELL + WCELL / 2 + 4} r={9} fill="#38bdf8" />
                  )}
                  {isAmberDot && (
                    <circle cx={x * WCELL + WCELL / 2} cy={y * WCELL + WCELL / 2 + 4} r={9} fill="#fbbf24" />
                  )}
                </g>
              );
            })}
            {/* nucleus */}
            <circle cx={WSIZE / 2} cy={WSIZE / 2} r={5.5} fill="#f8fafc" opacity={0.85} />
          </svg>
          <div className="h-4 text-[11px] text-slate-500">
            {beat === 1 && "blue's sixteen numbers — Σ = 100%"}
            {beat === 2 && "…and amber's own sixteen. done?"}
            {blue !== null && !focus && `if blue is found in box #${blue + 1}: amber's fresh list — Σ = 100%`}
            {focus && `find blue in #${focus.a + 1} and amber in #${focus.b + 1}?`}
          </div>
        </div>

        {/* ——— the table / scale-up ——— */}
        <div className="flex flex-col items-center gap-1.5">
          {beat < 6 ? (
            <>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">
                the honest answer sheet
              </div>
              <div className="flex items-start gap-1">
                {/* row axis label */}
                <div
                  className="mt-10 text-[10px] text-sky-300/80"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: TSIZE - 40 }}
                >
                  where blue might be found — one row per box ↓
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-center text-[10px] text-amber-300/80">where amber might be found →</div>
                  <svg
                    width={TSIZE}
                    height={TSIZE}
                    viewBox={`0 0 ${TSIZE} ${TSIZE}`}
                    className="rounded-md border border-white/10"
                    onPointerLeave={() => setHover(null)}
                  >
                    {joint.map((row, a) =>
                      row.map((v, b) => {
                        const stamped = a < rows;
                        const hot = focus && focus.a === a && focus.b === b;
                        const inCross = focus && (focus.a === a || focus.b === b);
                        return (
                          <motion.rect
                            key={`${a}-${b}`}
                            x={b * TCELL + 0.75}
                            y={a * TCELL + 0.75}
                            width={TCELL - 1.5}
                            height={TCELL - 1.5}
                            rx={2}
                            initial={false}
                            animate={{
                              fill: stamped
                                ? `rgba(125,211,252,${0.08 + (v / maxJoint) * 0.85})`
                                : "rgba(30,41,59,0.35)",
                              opacity: stamped ? (inCross ? 1 : focus ? 0.45 : 1) : 0.5,
                            }}
                            transition={{ duration: 0.25 }}
                            stroke={hot ? "#fbbf24" : blue === a && stamped ? "rgba(56,189,248,0.5)" : "transparent"}
                            strokeWidth={hot ? 1.5 : 1}
                            onPointerEnter={() => {
                              if (a < rows) {
                                notifyInteraction();
                                setHover({ a, b });
                              }
                            }}
                          />
                        );
                      }),
                    )}
                  </svg>
                </div>
              </div>
              <div className="h-8 max-w-[300px] text-center text-[11px] leading-snug text-slate-400">
                {focus ? (
                  <>
                    find blue in box #{focus.a + 1} <b>and</b> amber in box #{focus.b + 1} →{" "}
                    <span className="font-semibold text-sky-200">{joint[focus.a][focus.b].toFixed(2)}%</span>
                  </>
                ) : rows > 0 && rows < CELLS ? (
                  <>
                    row #{rows}: amber's list, <i>if</i> blue is found in box #{rows}
                  </>
                ) : rows >= CELLS ? (
                  <>16 rows × 16 columns — every pairing accounted for</>
                ) : (
                  <span className="text-slate-600">empty — we haven't written anything honest yet</span>
                )}
              </div>
            </>
          ) : (
            /* beat 6: the un-shrink */
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">the real answer sheet</div>
              <div className="relative" style={{ width: 300, height: 300 }}>
                <motion.div
                  className="absolute inset-0 rounded-md border border-sky-400/50"
                  initial={{ scale: TSIZE / 300, opacity: 0.4 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1.6, ease: "easeInOut" }}
                  style={{
                    background:
                      "radial-gradient(circle at 50% 45%, rgba(125,211,252,0.28), rgba(125,211,252,0.05) 70%)",
                  }}
                />
                {/* the toy table, to scale */}
                <motion.div
                  className="absolute left-1/2 top-1/2 rounded-[1px] bg-sky-300"
                  initial={{ width: TSIZE, height: TSIZE, x: "-50%", y: "-50%", opacity: 1 }}
                  animate={{ width: 300 * (16 / 1000), height: 300 * (16 / 1000), opacity: 0.95 }}
                  transition={{ duration: 1.6, ease: "easeInOut" }}
                />
                <div className="absolute inset-x-0 top-2 text-center text-[10px] text-slate-400">
                  1,000 columns →
                </div>
                <div className="absolute bottom-2 right-2 text-[10px] text-slate-500">
                  ▪ = our 16 × 16 toy table, to scale
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* counter + controls */}
      <div className="flex flex-col items-center gap-2.5">
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-slate-200">
          <span className="mr-2 text-[11px] uppercase tracking-wider text-slate-500">{counterLabel}:</span>
          <b>
            <CountUp value={counter} />
          </b>
        </div>
        <div className="flex items-center gap-1.5">
          {CAPTIONS.map((_, i) => (
            <button
              key={i}
              onClick={() => jumpTo(i)}
              aria-label={`beat ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                beat === i ? "w-6 bg-sky-400" : "w-2 bg-white/15 hover:bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
