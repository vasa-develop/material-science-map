import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAmbient } from "./useAmbient";

/**
 * Asset: "two ledgers" — the Kohn–Sham bookkeeping race.
 *
 * DFT section, after the fudge is named. One electron slider drives two
 * ledgers at once:
 *   · left, "the honest bookkeeping": 1,000^N — the written-out number
 *     overflows its card by N=5, and its bar on the shared cosmic ruler
 *     (comb-wall's mechanics) blows past every atom in the observable
 *     universe by N=27.
 *   · right, "the Kohn–Sham cheat": N × 1,000, a grocery list that grows by
 *     one line per electron — plus ONE glowing pot at the bottom, "the fudge
 *     (guessed)", size 1 forever.
 *
 * Both bars live on the SAME log ruler, which is the whole joke: the cheat's
 * bar never visibly leaves the start line.
 *
 * Layout (2026-07-06): cards side by side, ruler HORIZONTAL underneath.
 * The first cut used a vertical ruler as a third column; at embed widths
 * (~700px) the row wrapped and the stack overflowed the 660px iframe
 * (vasa's recording). Horizontal ruler keeps the whole asset ~560px tall
 * at any width down to ~520px.
 *
 * Ambient: auto-ramps the slider until the reader grabs it (same pattern as
 * comb-wall's solo beat 3).
 */

const REFS = [
  { exp: 19, label: "grains of sand on Earth" },
  { exp: 27, label: "atoms in your body" },
  { exp: 50, label: "atoms in Earth" },
  { exp: 80, label: "atoms in the observable universe" },
];

const MAX_N = 30;

/** 1,000^N written out: a 1 followed by N comma-separated "000" groups */
function writtenOut(n: number): string {
  return "1," + Array(n).fill("000").join(",");
}

function milestone(n: number): { text: string; hot: boolean } {
  if (n >= 27)
    return {
      hot: true,
      text: "past every atom in the observable universe — while the cheat's list still fits on one page.",
    };
  if (n >= 12)
    return {
      hot: false,
      text: "carbon atoms, plural — the honest ledger has gone astronomical; the cheat hasn't noticed.",
    };
  if (n >= 6)
    return {
      hot: false,
      text: "one carbon atom's worth of electrons: a billion billion numbers vs a few thousand.",
    };
  if (n >= 2)
    return {
      hot: false,
      text: "the honest ledger is already millions long; the cheat is a short grocery list.",
    };
  return { hot: false, text: "one electron: both ledgers agree — 1,000 numbers each." };
}

export default function TwoLedgersAsset() {
  const [n, setN] = useState(1);
  const { ambient, notifyInteraction } = useAmbient();
  const iv = useRef<number | null>(null);

  // ambient: ramp the slider hands-free until the reader grabs it
  useEffect(() => {
    if (!ambient) {
      if (iv.current !== null) window.clearInterval(iv.current);
      iv.current = null;
      return;
    }
    let k = 0;
    setN(1);
    iv.current = window.setInterval(() => {
      k++;
      const v = (k % (MAX_N + 6)) + 1; // linger a beat at the top before looping
      setN(Math.min(v, MAX_N));
    }, 450);
    return () => {
      if (iv.current !== null) window.clearInterval(iv.current);
      iv.current = null;
    };
  }, [ambient]);

  const grab = (v: number) => {
    notifyInteraction();
    setN(v);
  };

  const expHonest = 3 * n;
  const cheat = n * 1000;
  const expCheat = Math.log10(cheat);
  const over = expHonest > 80;
  const digits = useMemo(() => writtenOut(n), [n]);
  const m = milestone(n);

  // shared cosmic ruler — horizontal, so it never forces a wrap
  const ML = 56; // left margin for the bar labels
  const PW = 540; // plot width
  const RW = ML + PW + 24; // room for the overflow arrow
  const rx = (e: number) => ML + (Math.min(e, 100) / 100) * PW;

  // grocery list: first rows + ellipsis + last row once it gets long
  const listRows = useMemo(() => {
    if (n <= 5) return Array.from({ length: n }, (_, i) => i + 1);
    return [1, 2, 3, -1, n]; // -1 = ellipsis row
  }, [n]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#06070d] px-4">
      <p className="max-w-[640px] text-center text-[13.5px] leading-relaxed text-slate-300">
        Same system, two ways to keep the books. <b className="text-red-300">Honest</b>: track
        every pairing — the list <b>multiplies</b> by 1,000 per electron.{" "}
        <b className="text-sky-300">The Kohn–Sham cheat</b>: one private 1,000-number list per
        electron — the books just <b>add</b> — plus one guessed pot for everything tangled.
      </p>

      {/* slider */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">1</span>
        <input
          type="range"
          min={1}
          max={MAX_N}
          value={n}
          onChange={(e) => grab(parseInt(e.target.value))}
          onPointerDown={() => notifyInteraction()}
          className="w-56 accent-sky-400"
        />
        <span className="text-xs text-slate-500">{MAX_N}</span>
        <div className="ml-2 w-40 whitespace-nowrap text-sm text-slate-300">
          electrons: <b className="tabular-nums text-slate-100">{n}</b>
          {n % 6 === 0 && (
            <span className="text-slate-500">
              {" "}
              ({n / 6} carbon{n > 6 ? "s" : ""})
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-stretch justify-center gap-6">
        {/* ——— left: the honest monster ——— */}
        <div className="flex w-[250px] flex-col items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/[0.04] px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-red-300/80">
            the honest bookkeeping
          </div>
          <div className="text-[11px] text-slate-500">every pairing tracked</div>
          <div className={`text-3xl font-bold tabular-nums ${over ? "text-red-400" : "text-red-300"}`}>
            10<sup className="text-xl">{expHonest}</sup>
          </div>
          <div className="text-[11px] text-slate-500">= 1,000{n > 1 ? <sup>{n}</sup> : ""} numbers</div>
          {/* the number, written out — overflows its card by N=5 */}
          <div className="relative w-full overflow-hidden rounded-md border border-red-400/20 bg-[#0b0e18] px-2 py-1.5">
            <div className="whitespace-nowrap font-mono text-[12px] tabular-nums text-red-200/90">
              {digits}
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-[#0b0e18] to-transparent" />
          </div>
          <div className="h-4 text-[10.5px] text-slate-500">
            {n >= 5
              ? `${3 * n + 1} digits — it no longer fits on the card`
              : `${3 * n + 1} digits — still fits… for now`}
          </div>
          <div className="mt-auto flex min-h-[30px] items-center text-center text-[11px] leading-snug text-red-200/70">
            multiplies ×1,000 with every electron
          </div>
        </div>

        {/* ——— right: the Kohn–Sham cheat ——— */}
        <div className="flex w-[250px] flex-col items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/[0.05] px-4 py-3 shadow-[0_0_24px_rgba(56,189,248,0.10)]">
          <div className="text-[11px] uppercase tracking-wider text-sky-300/80">
            the kohn–sham cheat
          </div>
          <div className="text-[11px] text-slate-500">one private list per electron</div>
          <div className="text-3xl font-bold tabular-nums text-sky-300">
            {cheat.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">= {n} × 1,000 numbers</div>
          {/* the grocery list */}
          <div className="flex w-full flex-col gap-[3px]">
            <AnimatePresence initial={false}>
              {listRows.map((row) =>
                row === -1 ? (
                  <div key="ellipsis" className="text-center text-[10px] leading-3 text-slate-600">
                    ⋮
                  </div>
                ) : (
                  <motion.div
                    key={row}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-between rounded bg-sky-400/[0.08] px-2 py-[2px] text-[11px] tabular-nums text-sky-100/90"
                  >
                    <span>electron {row}</span>
                    <span className="text-sky-200/70">1,000</span>
                  </motion.div>
                ),
              )}
            </AnimatePresence>
          </div>
          {/* the fudge pot — size 1, forever */}
          <div className="mt-auto flex w-full items-center gap-2.5 rounded-lg border border-amber-300/30 bg-amber-400/[0.08] px-2.5 py-2">
            <motion.div
              className="h-3.5 w-3.5 shrink-0 rounded-full bg-amber-300"
              animate={{ boxShadow: [
                "0 0 6px 1px rgba(252,211,77,0.4)",
                "0 0 12px 3px rgba(252,211,77,0.7)",
                "0 0 6px 1px rgba(252,211,77,0.4)",
              ] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="text-[10.5px] leading-tight text-amber-100/90">
              <b>+ the fudge (guessed)</b>
              <br />
              <span className="text-amber-200/60">one pot — never grows</span>
            </div>
          </div>
        </div>
      </div>

      {/* ——— the shared cosmic ruler, horizontal ——— */}
      <svg width={RW} height={100} viewBox={`0 0 ${RW} 100`} className="max-w-full shrink-0">
        {REFS.map((r, i) => {
          const x = rx(r.exp);
          const level = i % 2 === 0 ? 26 : 10; // staggered so labels don't collide
          const passed = expHonest >= r.exp;
          return (
            <g key={r.exp}>
              <line
                x1={x}
                y1={level + 3}
                x2={x}
                y2={82}
                stroke={passed ? "rgba(248,113,113,0.5)" : "rgba(148,163,184,0.3)"}
                strokeDasharray="3 4"
              />
              <text
                x={Math.min(x, RW - 8)}
                y={level}
                textAnchor={x > RW - 130 ? "end" : "middle"}
                fontSize="9"
                fill={passed ? "#fca5a5" : "#94a3b8"}
              >
                10
                <tspan fontSize="7" dy="-3">
                  {r.exp}
                </tspan>
                <tspan fontSize="9" dy="3">
                  {" "}
                  {r.label}
                </tspan>
              </text>
            </g>
          );
        })}
        {/* honest bar */}
        <text x={ML - 6} y={47} textAnchor="end" fontSize="9.5" fill="#fca5a5">
          honest
        </text>
        <motion.rect
          x={ML}
          y={38}
          height={12}
          rx={3}
          animate={{ width: Math.max(rx(expHonest) - ML, 3) }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
          fill={over ? "rgba(248,113,113,0.8)" : "rgba(248,113,113,0.55)"}
        />
        {over && (
          <motion.text
            x={ML + PW + 4}
            y={48}
            fontSize="13"
            fill="#f87171"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            →
          </motion.text>
        )}
        {/* cheat bar — same scale; the joke is it never leaves the start line */}
        <text x={ML - 6} y={67} textAnchor="end" fontSize="9.5" fill="#7dd3fc">
          cheat
        </text>
        <motion.rect
          x={ML}
          y={58}
          height={12}
          rx={3}
          animate={{ width: Math.max(rx(expCheat) - ML, 3) }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
          fill="rgba(56,189,248,0.85)"
        />
        {/* baseline axis */}
        <line x1={ML} y1={82} x2={ML + PW} y2={82} stroke="rgba(255,255,255,0.25)" />
        <text x={ML} y={95} textAnchor="middle" fontSize="8.5" fill="#64748b">
          1
        </text>
        <text x={ML + PW} y={95} textAnchor="end" fontSize="8.5" fill="#64748b">
          10¹⁰⁰ numbers (log scale)
        </text>
      </svg>

      {/* milestone line */}
      <AnimatePresence mode="wait">
        <motion.div
          key={m.text}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className={`h-5 max-w-[560px] text-center text-[12.5px] leading-snug ${
            m.hot ? "text-red-300" : "text-slate-300"
          }`}
        >
          {m.text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
