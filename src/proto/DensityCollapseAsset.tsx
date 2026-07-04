import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Asset: "tear up the pairing" — the density, performed as a mutilation.
 *
 * DFT section, beat 1 (the dumb move). Opens on the familiar pile of 10,000
 * recorded pairs from pair-run / slice-pile. One button tears every pair in
 * half; the 20,000 loose clicks pour into a single communal tally — the
 * sixteen-numbers batch animation again, but fed by torn-up pairs. End state:
 * one amber map plus the normalization strip ("20,000 clicks ÷ 10,000 runs =
 * 2 clicks' worth of electron-stuff per run").
 *
 * Deliberate constraints:
 *  · Same joint structure as pair-run / slice-pile (marginal × conditional),
 *    so this is visibly the SAME pile the reader just spent a section
 *    slicing — the loss is real, not staged.
 *  · The pour happens in shuffled click order with honest partial tallies,
 *    so the shares jump early and settle late, exactly like the
 *    sixteen-numbers attempt animation the reader already trusts.
 *  · NO ambient auto-tour (same reasoning as slice-pile): the prose asks the
 *    reader to press "tear up the pairing" — the asset must be resting on
 *    the intact pile when they arrive.
 */

const N = 4;
const CELLS = N * N;
const CELL = 64;
const SIZE = N * CELL;
const PILE = 10000; // same pile size as slice-pile
const CLICKS = PILE * 2;

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

/** second electron given the first clicked box b: same shape as slice-pile */
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

type Phase = "pile" | "tearing" | "pouring" | "map";

export default function DensityCollapseAsset() {
  const pile = useMemo(() => {
    const marg = marginal();
    const conds = Array.from({ length: CELLS }, (_, b) => conditional(b));
    return Array.from({ length: PILE }, (): [number, number] => {
      const a = draw(marg);
      const b = draw(conds[a]);
      return a <= b ? [a, b] : [b, a];
    });
  }, []);

  // every pair torn in half, then shuffled — so the pour has no memory of
  // who arrived with whom, which is the entire point
  const clicksShuffled = useMemo(() => {
    const arr: number[] = [];
    for (const [a, b] of pile) arr.push(a, b);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [pile]);

  const [phase, setPhase] = useState<Phase>("pile");
  const [tally, setTally] = useState<number[]>(() => Array(CELLS).fill(0));
  const [poured, setPoured] = useState(0);
  const iv = useRef<number | null>(null);
  const tearT = useRef<number | null>(null);

  const clearTimers = () => {
    if (iv.current !== null) window.clearInterval(iv.current);
    if (tearT.current !== null) window.clearTimeout(tearT.current);
    iv.current = null;
    tearT.current = null;
  };
  useEffect(() => clearTimers, []);

  const shares = useMemo(
    () => tally.map((c) => (poured > 0 ? (c / poured) * 100 : 0)),
    [tally, poured],
  );
  const maxShare = Math.max(...shares, 0.0001);

  const sampleRows = useMemo(() => pile.slice(0, 7), [pile]);

  const startPour = () => {
    const local = Array(CELLS).fill(0);
    let done = 0;
    iv.current = window.setInterval(() => {
      // ramp: single clicks first, then bigger and bigger gulps (~4s total)
      const chunk =
        done < 10 ? 1 : done < 50 ? 4 : done < 200 ? 14 : done < 800 ? 50 : done < 3000 ? 200 : 700;
      const k = Math.min(chunk, CLICKS - done);
      for (let i = 0; i < k; i++) local[clicksShuffled[done + i]]++;
      done += k;
      setTally([...local]);
      setPoured(done);
      if (done >= CLICKS) {
        clearTimers();
        setPhase("map");
      }
    }, 45);
  };

  const tear = () => {
    if (phase !== "pile") return;
    setPhase("tearing");
    tearT.current = window.setTimeout(() => {
      setPhase("pouring");
      startPour();
    }, 1500);
  };

  const reset = () => {
    clearTimers();
    setTally(Array(CELLS).fill(0));
    setPoured(0);
    setPhase("pile");
  };

  const torn = phase !== "pile";
  const showNumbers = phase === "pouring" || phase === "map";

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#06070d] px-4">
      <p className="max-w-[620px] text-center text-[13.5px] leading-relaxed text-slate-300">
        The <b>pile of {PILE.toLocaleString()} recorded pairs</b> again — and the crudest thing
        we could possibly do to it: tear every pair in half and dump all{" "}
        {CLICKS.toLocaleString()} clicks into <b className="text-amber-300">one communal tally</b>.
      </p>

      <div className="flex flex-wrap items-start justify-center gap-9">
        {/* ——— the grid ——— */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-4 text-[11px] uppercase tracking-wider text-slate-500">
            {phase === "pile"
              ? "the 16 boxes"
              : phase === "map"
                ? "the density — where the electron-stuff piles up"
                : "one communal tally — every click counts the same"}
          </div>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="rounded-lg border border-white/10"
          >
            {shares.map((s, i) => {
              const { x, y } = pos(i);
              return (
                <g key={i}>
                  <rect
                    x={x * CELL + 2}
                    y={y * CELL + 2}
                    width={CELL - 4}
                    height={CELL - 4}
                    rx={6}
                    fill="#0b0e18"
                    stroke="rgba(148,163,184,0.18)"
                  />
                  {showNumbers && (
                    <motion.rect
                      x={x * CELL + 2}
                      y={y * CELL + 2}
                      width={CELL - 4}
                      height={CELL - 4}
                      rx={6}
                      initial={{ fill: "rgba(251,191,36,0)" }}
                      animate={{ fill: `rgba(251,191,36,${0.04 + (s / maxShare) * 0.42})` }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                  <text x={x * CELL + 9} y={y * CELL + 17} fontSize="9" fill="rgba(148,163,184,0.55)">
                    #{i + 1}
                  </text>
                  {showNumbers && (
                    <text
                      x={x * CELL + CELL / 2}
                      y={y * CELL + CELL / 2 + 9}
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight={600}
                      fill="#fde68a"
                    >
                      {poured > 0 ? fmt(s) : "—"}
                    </text>
                  )}
                </g>
              );
            })}
            <circle cx={SIZE / 2} cy={SIZE / 2} r={5.5} fill="#f8fafc" opacity={0.85} />
          </svg>
          {/* the normalization, made felt — pinned to the finished map */}
          <div className="h-12 w-[276px]">
            <AnimatePresence>
              {phase === "map" && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-md border border-amber-300/25 bg-amber-400/[0.07] px-2.5 py-1 text-center text-[10.5px] leading-snug text-amber-100/90"
                >
                  {CLICKS.toLocaleString()} clicks ÷ {PILE.toLocaleString()} runs = on an average
                  run, <b>2 clicks' worth of electron-stuff</b>, spread like this
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ——— the records ——— */}
        <div className="flex w-[235px] flex-col items-center gap-2.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">the records</div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[12.5px] text-slate-200">
            <span className="mr-2 text-[10.5px] uppercase tracking-wider text-slate-500">pile:</span>
            <b className="tabular-nums">{PILE.toLocaleString()}</b> pairs
          </div>
          <div className="h-8">
            <AnimatePresence>
              {torn && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-1.5 text-[12.5px] text-amber-100"
                >
                  <span className="mr-2 text-[10.5px] uppercase tracking-wider text-amber-300/70">
                    tallied:
                  </span>
                  <b className="tabular-nums">{poured.toLocaleString()}</b>
                  <span className="ml-1 text-[10.5px] text-amber-200/60">
                    / {CLICKS.toLocaleString()} clicks
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex w-full flex-col gap-1">
            {sampleRows.map(([a, b], row) => (
              <div key={row} className="flex h-[25px] items-center justify-center">
                {!torn ? (
                  <div className="rounded-md bg-white/[0.03] px-3 py-0.5 text-center text-[12px] tabular-nums text-slate-400">
                    (#{a + 1} &amp; #{b + 1})
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <motion.span
                      initial={{ x: 14, opacity: 1 }}
                      animate={{
                        x: 0,
                        opacity: phase === "tearing" ? 1 : 0.35,
                      }}
                      transition={{ delay: row * 0.13, duration: 0.4 }}
                      className="rounded-md bg-amber-400/15 px-2.5 py-0.5 text-[12px] tabular-nums text-amber-100"
                    >
                      #{a + 1}
                    </motion.span>
                    <motion.span
                      initial={{ x: -14, opacity: 1 }}
                      animate={{
                        x: 0,
                        opacity: phase === "tearing" ? 1 : 0.35,
                      }}
                      transition={{ delay: row * 0.13, duration: 0.4 }}
                      className="rounded-md bg-amber-400/15 px-2.5 py-0.5 text-[12px] tabular-nums text-amber-100"
                    >
                      #{b + 1}
                    </motion.span>
                  </div>
                )}
              </div>
            ))}
            <div className="text-center text-[10.5px] text-slate-600">
              {torn
                ? `…and ${(PILE - sampleRows.length).toLocaleString()} more pairs, all torn`
                : `…and ${(PILE - sampleRows.length).toLocaleString()} more records`}
            </div>
          </div>
        </div>
      </div>

      {/* ——— controls ——— */}
      <div className="flex items-center gap-2">
        {phase === "pile" && (
          <button
            onClick={tear}
            className="rounded-full bg-amber-400/15 px-4 py-2 text-[13px] font-medium text-amber-200 transition hover:bg-amber-400/25"
          >
            tear up the pairing
          </button>
        )}
        {(phase === "tearing" || phase === "pouring") && (
          <button
            disabled
            className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] text-slate-400 opacity-70"
          >
            {phase === "tearing" ? "tearing…" : "tallying…"}
          </button>
        )}
        {phase === "map" && (
          <button
            onClick={reset}
            className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] text-slate-300 transition hover:bg-white/10"
          >
            start over
          </button>
        )}
      </div>

      <div className="h-9 max-w-[540px] text-center text-[12px] leading-snug text-slate-400">
        {phase === "pile" && (
          <p className="text-slate-500">
            every record is one run: two clicks, one pair — the pairing still intact
          </p>
        )}
        {phase === "tearing" && (
          <p>
            tearing… every pair splits into <b className="text-amber-200">two loose clicks</b> —
            nobody remembers who arrived with whom
          </p>
        )}
        {phase === "pouring" && (
          <p>
            {poured < 500 ? (
              <>pouring the loose clicks into the tally — the shares jump around at first…</>
            ) : (
              <>…and settle as the clicks pile up. one tally, no pairing anywhere in it</>
            )}
          </p>
        )}
        {phase === "map" && (
          <p>
            sixteen numbers — and <b>sixteen forever</b>, no matter how many electrons feed the
            tally. <span className="text-slate-500">that cheapness is the whole point — and so is
            what it just threw away.</span>
          </p>
        )}
      </div>
    </div>
  );
}
