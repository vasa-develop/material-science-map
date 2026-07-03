import { useMemo, useState } from "react";
import { motion } from "framer-motion";

/**
 * Asset: "two slices, two lists" — the dependence made concrete.
 *
 * PAIR-CLICKS FRAMING (2026-07-03): with two electrons, every run ends with
 * TWO clicks — a pair of boxes. Each panel shows one SLICE of the big pile of
 * recorded runs: keep only the runs where a given box clicked (blue), then
 * tally where the OTHER click landed (amber). Click any box to slice the pile
 * a different way and watch the whole amber list reshuffle.
 *
 * Deliberately NO ambient auto-tour: the prose names box #1 and box #11 for
 * the two panels, so the defaults must still be showing when the reader
 * arrives. Same conditional distribution as JointTableAsset, so these panels
 * are literally rows of the joint table the reader is about to meet.
 */

const N = 4;
const CELLS = N * N;
const CELL = 58;
const SIZE = N * CELL;

const pos = (i: number) => ({ x: i % N, y: Math.floor(i / N) });
const C = (N - 1) / 2;

/** second electron's likelihoods GIVEN the first turned up in box b */
function conditional(b: number): number[] {
  const bp = pos(b);
  const w = Array.from({ length: CELLS }, (_, i) => {
    const { x, y } = pos(i);
    const nuc = Math.exp(-((x - C) ** 2 + (y - C) ** 2) / (2 * 1.6 ** 2));
    const rep = 1 - 0.93 * Math.exp(-((x - bp.x) ** 2 + (y - bp.y) ** 2) / (2 * 1.05 ** 2));
    return nuc * rep;
  });
  const t = w.reduce((a, b2) => a + b2, 0);
  return w.map((v) => (v / t) * 100);
}

const fmt = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1)) + "%";

function CasePanel({
  title,
  blue,
  onPick,
}: {
  title: string;
  blue: number;
  onPick: (i: number) => void;
}) {
  const cond = useMemo(() => conditional(blue), [blue]);
  const maxC = Math.max(...cond);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{title}</div>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="rounded-lg border border-white/10"
      >
        {cond.map((v, i) => {
          const { x, y } = pos(i);
          const isBlue = i === blue;
          return (
            <g key={i} onClick={() => onPick(i)} className="cursor-pointer">
              <rect
                x={x * CELL + 2}
                y={y * CELL + 2}
                width={CELL - 4}
                height={CELL - 4}
                rx={6}
                fill="#0b0e18"
                stroke={isBlue ? "rgba(56,189,248,0.6)" : "rgba(148,163,184,0.18)"}
              />
              {!isBlue && (
                <motion.rect
                  x={x * CELL + 2}
                  y={y * CELL + 2}
                  width={CELL - 4}
                  height={CELL - 4}
                  rx={6}
                  initial={false}
                  animate={{ fill: `rgba(251,191,36,${0.05 + (v / maxC) * 0.5})` }}
                  transition={{ duration: 0.5 }}
                />
              )}
              <text x={x * CELL + 8} y={y * CELL + 16} fontSize="8.5" fill="rgba(148,163,184,0.55)">
                #{i + 1}
              </text>
              {!isBlue && (
                <text
                  x={x * CELL + CELL / 2}
                  y={y * CELL + CELL / 2 + 9}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight={600}
                  fill="#fde68a"
                >
                  {fmt(v)}
                </text>
              )}
              {isBlue && (
                <>
                  <circle cx={x * CELL + CELL / 2} cy={y * CELL + CELL / 2 + 4} r={10} fill="#38bdf8" />
                  <text
                    x={x * CELL + CELL / 2}
                    y={y * CELL + CELL / 2 + 8}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight={700}
                    fill="#06070d"
                  >
                    ✓
                  </text>
                </>
              )}
            </g>
          );
        })}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={5.5} fill="#f8fafc" opacity={0.85} />
      </svg>
      <div className="h-8 max-w-[250px] text-center text-[11px] leading-snug text-slate-400">
        runs where <b className="text-sky-300">box #{blue + 1}</b> clicked → where the{" "}
        <b className="text-amber-300">other click</b> landed, Σ = 100%
      </div>
    </div>
  );
}

export default function TwoCasesAsset() {
  const [blueA, setBlueA] = useState(0); // box #1 — matches the prose's first case
  const [blueB, setBlueB] = useState(10); // box #11 — matches the prose's second case

  const pick = (which: "a" | "b") => (i: number) =>
    (which === "a" ? setBlueA : setBlueB)(i);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-[#06070d] px-4">
      <p className="max-w-[640px] text-center text-[13.5px] leading-relaxed text-slate-300">
        Two electrons, so every run ends with <b>two clicks</b> — a pair of boxes. Below: the
        same big pile of runs, sliced two ways. Keep only the runs where{" "}
        <b className="text-sky-300">a given box clicked</b>, and tally where the{" "}
        <b className="text-amber-300">other click</b> landed.
      </p>

      <div className="flex flex-wrap items-start justify-center gap-8">
        <CasePanel title="slice one" blue={blueA} onPick={pick("a")} />
        <CasePanel title="slice two" blue={blueB} onPick={pick("b")} />
      </div>

      <p className="max-w-[560px] text-center text-[11.5px] leading-snug text-slate-400">
        Slice the pile by a different box, and the other electron's <b>entire list</b> changes —
        low numbers hugging the blue box, higher ones far from it.{" "}
        <span className="text-slate-500">Click any box to slice by it.</span>
      </p>
    </div>
  );
}
