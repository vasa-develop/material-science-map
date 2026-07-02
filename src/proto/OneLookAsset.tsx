import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAmbient } from "./useAmbient";

/**
 * Asset: "one look, one dot" — what we can compute vs what we can know.
 *
 * Scene 1: the equation computes the likelihood map exactly; each "look"
 * (a fresh, identically prepared electron) yields ONE definite dot; the pile
 * of dots converges onto the computed map. Compute the odds perfectly,
 * predict the next dot never.
 *
 * Scene 2: the shell-game foil. Einstein's story (sealed envelope — the
 * answer was written before you looked) vs the quantum story (no envelope —
 * the answer comes into existence at the look). Identical dots for a single
 * electron; nature's verdict came from entangled pairs (Bell).
 */

const N = 10;
const CELLS = N * N;

/** the computed likelihood map: gaussian around the nucleus, summing to 100% */
function likelihoodMap(): number[] {
  const sigma = 2.1;
  const c = (N - 1) / 2;
  const raw: number[] = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      raw.push(Math.exp(-((x - c) ** 2 + (y - c) ** 2) / (2 * sigma * sigma)));
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => (v / total) * 100);
}

function makeSampler(p: number[]): () => number {
  const cum: number[] = [];
  let acc = 0;
  for (const v of p) {
    acc += v;
    cum.push(acc);
  }
  return () => {
    const r = Math.random() * acc;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cum[m] < r) lo = m + 1;
      else hi = m;
    }
    return lo;
  };
}

function Heatmap({ p, cell, max }: { p: number[]; cell: number; max: number }) {
  return (
    <>
      {p.map((v, i) => (
        <rect
          key={i}
          x={(i % N) * cell + 1}
          y={Math.floor(i / N) * cell + 1}
          width={cell - 2}
          height={cell - 2}
          rx={2.5}
          fill={`rgba(56,189,248,${0.05 + (v / max) * 0.8})`}
        />
      ))}
    </>
  );
}

/* ————— scene 1: dots build the map ————— */

const CELL1 = 30;
const SIZE1 = N * CELL1;
const MAX_DOTS = 3500;

function SceneDots({
  ambient,
  notifyInteraction,
}: {
  ambient: boolean;
  notifyInteraction: () => void;
}) {
  const p = useMemo(likelihoodMap, []);
  const maxP = useMemo(() => Math.max(...p), [p]);
  const sample = useMemo(() => makeSampler(p), [p]);

  const [dots, setDots] = useState<{ x: number; y: number }[]>([]);
  const counts = useRef<number[]>(Array(CELLS).fill(0));
  const [auto, setAuto] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);

  const look = () => {
    const i = sample();
    counts.current[i] += 1;
    const jx = (Math.random() * 0.72 + 0.14) * CELL1;
    const jy = (Math.random() * 0.72 + 0.14) * CELL1;
    setDots((d) => {
      const nd = [...d, { x: (i % N) * CELL1 + jx, y: Math.floor(i / N) * CELL1 + jy }];
      return nd.length > MAX_DOTS ? nd.slice(nd.length - MAX_DOTS) : nd;
    });
    setFlash(i);
  };

  const reset = () => {
    counts.current = Array(CELLS).fill(0);
    setDots([]);
    setFlash(null);
  };

  // manual rapid-fire
  useEffect(() => {
    if (!auto) return;
    const iv = window.setInterval(look, 45);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  // attract mode: slow steady looks; start over when the pile saturates
  useEffect(() => {
    if (!ambient || auto) return;
    const iv = window.setInterval(() => {
      if (counts.current.reduce((a, b) => a + b, 0) > 1600) reset();
      else look();
    }, 130);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient, auto]);

  const n = dots.length === 0 ? 0 : counts.current.reduce((a, b) => a + b, 0);
  // overlap between empirical histogram and computed map (0–100)
  const match =
    n >= 30
      ? counts.current.reduce((a, c, i) => a + Math.min((c / n) * 100, p[i]), 0)
      : null;

  const btn =
    "rounded-full px-3.5 py-1.5 text-xs transition bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-start justify-center gap-8">
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            what the equation computes — exactly
          </div>
          <svg width={SIZE1} height={SIZE1} className="rounded-lg border border-white/10">
            <Heatmap p={p} cell={CELL1} max={maxP} />
          </svg>
          <div className="text-[11px] text-slate-500">the likelihood map (the thousand numbers)</div>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            the detector — what looking gives you
          </div>
          <svg width={SIZE1} height={SIZE1} className="rounded-lg border border-white/10 bg-[#0b0e18]">
            {Array.from({ length: N + 1 }, (_, i) => (
              <g key={i} stroke="rgba(148,163,184,0.08)">
                <line x1={i * CELL1} y1={0} x2={i * CELL1} y2={SIZE1} />
                <line x1={0} y1={i * CELL1} x2={SIZE1} y2={i * CELL1} />
              </g>
            ))}
            {dots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={1.7} fill="#7dd3fc" opacity={0.75} />
            ))}
            {flash !== null && (
              <motion.rect
                key={`f${n}`}
                x={(flash % N) * CELL1}
                y={Math.floor(flash / N) * CELL1}
                width={CELL1}
                height={CELL1}
                rx={3}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={2}
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.9 }}
              />
            )}
          </svg>
          <div className="h-4 text-[11px] tabular-nums text-slate-500">
            looks so far: <b className="text-slate-300">{n.toLocaleString()}</b>
            {match !== null && (
              <>
                {" "}
                · match with the computed map:{" "}
                <b className="text-sky-300">{match.toFixed(0)}%</b>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="rounded-full bg-sky-400/15 px-4 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-400/25"
          onClick={() => {
            notifyInteraction();
            look();
          }}
        >
          look once
        </button>
        <button
          className={auto ? "rounded-full bg-white/15 px-3.5 py-1.5 text-xs text-white" : btn}
          onClick={() => {
            notifyInteraction();
            setAuto((a) => !a);
          }}
        >
          {auto ? "stop" : "keep looking"}
        </button>
        <button
          className={btn}
          onClick={() => {
            notifyInteraction();
            setAuto(false);
            reset();
          }}
        >
          start over
        </button>
      </div>

      <p className="max-w-[560px] text-center text-xs leading-relaxed text-slate-400">
        Every look uses a fresh, identically prepared electron — and finds it in <em>one definite box</em>. Which box?
        Genuinely unpredictable, even in principle. But the <em>pile</em> of looks is perfectly predictable: it
        converges onto exactly the map the equation computed.
      </p>
    </div>
  );
}

/* ————— scene 2: the envelope ————— */

const CELL2 = 21;
const SIZE2 = N * CELL2;

type PanelState = { found: number | null; envelope: number };

function StoryPanel({
  kind,
  p,
  maxP,
  state,
  onLook,
  onReset,
}: {
  kind: "envelope" | "quantum";
  p: number[];
  maxP: number;
  state: PanelState;
  onLook: () => void;
  onReset: () => void;
}) {
  const { found, envelope } = state;
  const isEnv = kind === "envelope";
  return (
    <div className="flex w-[250px] flex-col items-center gap-2">
      <div className="text-xs font-semibold text-slate-300">
        {isEnv ? "Einstein's story: the shell game" : "The quantum story"}
      </div>
      <svg width={SIZE2} height={SIZE2} className="rounded-lg border border-white/10">
        <Heatmap p={p} cell={CELL2} max={maxP} />
        {found !== null && (
          <motion.circle
            cx={(found % N) * CELL2 + CELL2 / 2}
            cy={Math.floor(found / N) * CELL2 + CELL2 / 2}
            r={6}
            fill="#fbbf24"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          />
        )}
      </svg>

      <div
        className={`flex h-[74px] w-full flex-col items-center justify-center rounded-xl border px-2 text-center text-[11px] leading-snug ${
          isEnv ? "border-amber-400/25 bg-amber-400/[0.04] text-amber-100/80" : "border-sky-400/25 bg-sky-400/[0.04] text-sky-100/80"
        }`}
      >
        {isEnv ? (
          found === null ? (
            <>
              <span className="text-base">✉️</span>
              sealed envelope: the answer is already written (you just can't see it)
            </>
          ) : (
            <>
              <span className="text-base">📬</span>
              envelope opened: “box #{envelope + 1}” — written <em>before</em> you looked. It matches.
            </>
          )
        ) : found === null ? (
          <>
            <span className="text-base">∅</span>
            no envelope. Nothing about its position is written anywhere in the universe.
          </>
        ) : (
          <>
            <span className="text-base">🎲</span>
            box #{found + 1} — decided <em>at the instant</em> of the look, not before.
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onLook}
          className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-slate-200 transition hover:bg-white/20"
        >
          {found === null ? "look" : "look again"}
        </button>
        <button
          onClick={onReset}
          className="rounded-full bg-white/5 px-3 py-1.5 text-[11px] text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          new electron
        </button>
      </div>
      {found !== null && (
        <div className="h-4 text-[10px] text-slate-500">looking again finds the same box — the “collapse.”</div>
      )}
    </div>
  );
}

function SceneEnvelope({
  ambient,
  notifyInteraction,
}: {
  ambient: boolean;
  notifyInteraction: () => void;
}) {
  const p = useMemo(likelihoodMap, []);
  const maxP = useMemo(() => Math.max(...p), [p]);
  const sample = useMemo(() => makeSampler(p), [p]);

  const [env, setEnv] = useState<PanelState>(() => ({ found: null, envelope: sample() }));
  const [qm, setQm] = useState<PanelState>({ found: null, envelope: -1 });

  const lookEnv = () => setEnv((s) => ({ ...s, found: s.envelope }));
  const lookQm = () => setQm((s) => (s.found === null ? { ...s, found: sample() } : s));
  const resetEnv = () => setEnv({ found: null, envelope: sample() });
  const resetQm = () => setQm({ found: null, envelope: -1 });

  // attract mode: demo the cycle on both panels in sync
  const phase = useRef(0);
  useEffect(() => {
    if (!ambient) return;
    const iv = window.setInterval(() => {
      phase.current = (phase.current + 1) % 3;
      if (phase.current === 1) {
        lookEnv();
        lookQm();
      } else if (phase.current === 0) {
        resetEnv();
        resetQm();
      }
    }, 2400);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-start justify-center gap-8">
        <StoryPanel
          kind="envelope"
          p={p}
          maxP={maxP}
          state={env}
          onLook={() => {
            notifyInteraction();
            lookEnv();
          }}
          onReset={() => {
            notifyInteraction();
            resetEnv();
          }}
        />
        <StoryPanel
          kind="quantum"
          p={p}
          maxP={maxP}
          state={qm}
          onLook={() => {
            notifyInteraction();
            lookQm();
          }}
          onReset={() => {
            notifyInteraction();
            resetQm();
          }}
        />
      </div>
      <p className="max-w-[590px] text-center text-xs leading-relaxed text-slate-400">
        Here's the unsettling part: for a single electron, both stories produce <em>identical</em> dots — you can't tell
        them apart this way, which is why Einstein's envelope wasn't a silly idea. It took physics four decades to find
        an experiment (using <em>pairs</em> of particles) where the two stories predict different statistics — and when
        it was run, nature sided with <b className="text-sky-300">no envelope</b>. The randomness isn't in our
        instruments; it's in the world.
      </p>
    </div>
  );
}

/* ————— shell ————— */

const TABS = ["one look, one dot", "was it decided before you looked?"] as const;

export default function OneLookAsset() {
  const [tab, setTab] = useState(0);
  const { ambient, notifyInteraction } = useAmbient(10000);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-[#06070d] px-4">
      <div className="max-w-[620px] text-center text-sm text-slate-300">
        {tab === 0
          ? "We can compute the odds perfectly. We can never predict the next dot."
          : "Is the answer written down before the look — or created by it?"}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {tab === 0 ? (
            <SceneDots ambient={ambient} notifyInteraction={notifyInteraction} />
          ) : (
            <SceneEnvelope ambient={ambient} notifyInteraction={notifyInteraction} />
          )}
        </motion.div>
      </AnimatePresence>
      <div className="flex items-center gap-2">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => {
              notifyInteraction();
              setTab(i);
            }}
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
