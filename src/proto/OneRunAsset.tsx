import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAmbient } from "./useAmbient";

/**
 * Asset: "one run" — the experiment, fired exactly once.
 *
 * Sits right after the prose builds the tiny world (2D region, nucleus,
 * 4×4 detector grid). Its only job: let the reader flip the detectors on and
 * watch ONE detector click. Then prepare a fresh electron and run again.
 *
 * Deliberate constraints (see chat, 2026-07-03):
 *  · NO odds, heatmaps, percentages, counters, or history — the tally beat
 *    belongs to the sixteen-numbers embed later. One run on screen at a time.
 *  · The electron is never drawn before detection ("it's in there —
 *    somewhere") — drawing it would redo the confessed pin-pointing crime.
 *  · The re-run button says "prepare a fresh electron" — quietly teaching
 *    that a click ends the run before the prose spells it out.
 *
 * Samples from the same marginal distribution as SixteenNumbersAsset /
 * JointTableAsset, so a reader who re-runs many times feels the same pattern
 * the tally will later make explicit.
 */

const N = 4;
const CELLS = N * N;
const CELL = 64;
const SIZE = N * CELL;

const pos = (i: number) => ({ x: i % N, y: Math.floor(i / N) });
const C = (N - 1) / 2;

function marginal(): number[] {
  const w = Array.from({ length: CELLS }, (_, i) => {
    const { x, y } = pos(i);
    return Math.exp(-((x - C) ** 2 + (y - C) ** 2) / (2 * 1.15 ** 2));
  });
  const t = w.reduce((a, b) => a + b, 0);
  return w.map((v) => (v / t) * 100);
}

type Phase = "idle" | "armed" | "clicked";

export default function OneRunAsset() {
  const p = useMemo(() => marginal(), []);
  const { ambient, notifyInteraction } = useAmbient(9000);

  const [phase, setPhase] = useState<Phase>("idle");
  const [hit, setHit] = useState<number | null>(null);
  const [runKey, setRunKey] = useState(0);

  const sample = () => {
    const r = Math.random() * 100;
    let acc = 0;
    for (let i = 0; i < CELLS; i++) {
      acc += p[i];
      if (r < acc) return i;
    }
    return CELLS - 1;
  };

  const runOnce = () => {
    setPhase("armed");
    setHit(null);
    // short "detectors on" beat before the click lands
    window.setTimeout(() => {
      setHit(sample());
      setPhase("clicked");
      setRunKey((k) => k + 1);
    }, 650);
  };

  // ambient: quietly demo a run every few seconds
  useEffect(() => {
    if (!ambient) return;
    const iv = window.setInterval(() => runOnce(), 3600);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient]);

  const press = () => {
    notifyInteraction();
    if (phase !== "armed") runOnce();
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-[#06070d] px-4">
      <p className="max-w-[560px] text-center text-[13.5px] leading-relaxed text-slate-300">
        One nucleus in the middle, one electron <i>somewhere</i> around it — and sixteen boxes,
        each wired with its own <b>electron detector</b>.
      </p>

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
          {p.map((_, i) => {
            const { x, y } = pos(i);
            const isHit = phase === "clicked" && hit === i;
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
                {/* click flash */}
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
                <text
                  x={x * CELL + 9}
                  y={y * CELL + 17}
                  fontSize="9"
                  fill="rgba(148,163,184,0.55)"
                >
                  #{i + 1}
                </text>
                {isHit && (
                  <motion.circle
                    key={`dot-${runKey}`}
                    cx={x * CELL + CELL / 2}
                    cy={y * CELL + CELL / 2 + 4}
                    r={7}
                    fill="#fbbf24"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.25 }}
                  />
                )}
              </g>
            );
          })}
          {/* nucleus */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={6} fill="#f8fafc" opacity={0.85} />
        </svg>
        <div className="h-4 text-[11px] text-slate-500">
          ⚪ the nucleus · the electron is in there — we just can't say where
        </div>
      </div>

      <button
        onClick={press}
        disabled={phase === "armed"}
        className="rounded-full bg-amber-400/15 px-4 py-2 text-[13px] font-medium text-amber-200 transition hover:bg-amber-400/25 disabled:opacity-50"
      >
        {phase === "idle"
          ? "flip the detectors on"
          : phase === "armed"
            ? "detectors listening…"
            : "prepare a fresh electron · run again"}
      </button>

      <div className="h-10 max-w-[440px] text-center text-[12px] leading-snug text-slate-400">
        <AnimatePresence mode="wait">
          {phase === "clicked" && hit !== null ? (
            <motion.p
              key={runKey}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <b className="text-amber-200">click!</b> — detector <b>#{(hit ?? 0) + 1}</b> caught
              the electron. one run, one click, one definite box. that run is now over — catching
              an electron disturbs it.
            </motion.p>
          ) : phase === "armed" ? (
            <motion.p key="arming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              detectors listening…
            </motion.p>
          ) : (
            <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className="text-slate-600">press the button and watch what happens</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
