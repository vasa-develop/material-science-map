import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAmbient } from "./useAmbient";

/**
 * Asset: "The odometer that outruns the universe" — the combinatorial wall of the
 * exact Schrödinger equation, in three beats:
 *   1. one electron = one 1,000-notch dial
 *   2. why dials MULTIPLY, not add (correlated clouds — drag one, the other reacts)
 *   3. let it compound against a cosmic ruler (log meter to 10^90)
 */

const BG = "#06070d";
const GRID = 220; // svg logical size of the electron box
const REFS = [
  { exp: 19, label: "grains of sand on Earth" },
  { exp: 27, label: "atoms in your body" },
  { exp: 50, label: "atoms in Earth" },
  { exp: 80, label: "atoms in the observable universe" },
];

/* ---------- tiny pieces ---------- */

function Dial({ size = 88, label = "1,000", accent = false }: { size?: number; label?: string; accent?: boolean }) {
  const ticks = Array.from({ length: 40 }, (_, i) => (i / 40) * Math.PI * 2);
  const stroke = accent ? "rgba(56,189,248,0.9)" : "rgba(255,255,255,0.25)";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <circle cx="50" cy="50" r="46" fill="rgba(255,255,255,0.03)" stroke={stroke} strokeWidth="1.5" />
      {ticks.map((a, i) => (
        <line
          key={i}
          x1={50 + Math.cos(a) * 41}
          y1={50 + Math.sin(a) * 41}
          x2={50 + Math.cos(a) * 45}
          y2={50 + Math.sin(a) * 45}
          stroke={i % 10 === 0 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.18)"}
          strokeWidth={i % 10 === 0 ? 1.6 : 0.8}
        />
      ))}
      <text x="50" y="48" textAnchor="middle" fontSize="15" fontWeight={700} fill="#e2e8f0">
        {label}
      </text>
      <text x="50" y="63" textAnchor="middle" fontSize="7.5" fill="#64748b">
        boxes it might be in
      </text>
    </svg>
  );
}

function CloudDefs() {
  return (
    <defs>
      <radialGradient id="cw-cloud-a" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(56,189,248,0.95)" />
        <stop offset="45%" stopColor="rgba(56,189,248,0.35)" />
        <stop offset="100%" stopColor="rgba(56,189,248,0)" />
      </radialGradient>
      <radialGradient id="cw-cloud-b" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(251,191,36,0.95)" />
        <stop offset="45%" stopColor="rgba(251,191,36,0.35)" />
        <stop offset="100%" stopColor="rgba(251,191,36,0)" />
      </radialGradient>
    </defs>
  );
}

function GridLines() {
  const step = GRID / 10;
  return (
    <g stroke="rgba(148,163,184,0.14)" strokeWidth="1">
      {Array.from({ length: 11 }, (_, i) => (
        <g key={i}>
          <line x1={i * step} y1={0} x2={i * step} y2={GRID} />
          <line x1={0} y1={i * step} x2={GRID} y2={i * step} />
        </g>
      ))}
    </g>
  );
}

/* ---------- beat 1: one electron, one dial ---------- */

function BeatOne() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-10">
      <svg width={GRID} height={GRID} viewBox={`0 0 ${GRID} ${GRID}`} className="rounded-lg border border-white/10">
        <CloudDefs />
        <GridLines />
        <motion.circle
          r={44}
          fill="url(#cw-cloud-a)"
          animate={{ cx: [104, 122, 96, 110, 104], cy: [112, 96, 120, 104, 112] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
      <div className="flex flex-col items-center gap-3">
        <Dial accent />
        <div className="max-w-[240px] text-center text-sm leading-relaxed text-slate-300">
          1 electron = 1,000 boxes it might be in ={" "}
          <span className="font-semibold text-sky-300">1,000 numbers</span>. Easy.
        </div>
      </div>
    </div>
  );
}

/* ---------- beat 2: why dials multiply ---------- */

function BeatTwo({ auto, onGrab }: { auto: boolean; onGrab?: () => void }) {
  const [a, setA] = useState({ x: 76, y: 104 });
  const dragging = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const raf = useRef(0);

  // autoplay: sweep cloud A on a lissajous path so the reaction is visible hands-free;
  // blend in from the current position so resuming after a drag doesn't teleport
  const aRef = useRef(a);
  aRef.current = a;
  useEffect(() => {
    if (!auto) return;
    const from = { ...aRef.current };
    const t0 = performance.now();
    const loop = (t: number) => {
      const s = (t - t0) / 1000;
      const tx = 110 + Math.sin(s * 1.1) * 62;
      const ty = 110 + Math.sin(s * 0.7 + 1.3) * 48;
      const w = Math.min(1, s / 1.2);
      setA({ x: from.x + (tx - from.x) * w, y: from.y + (ty - from.y) * w });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [auto]);

  const onMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * GRID;
    const y = ((e.clientY - r.top) / r.height) * GRID;
    setA({ x: Math.max(28, Math.min(GRID - 28, x)), y: Math.max(28, Math.min(GRID - 28, y)) });
  }, []);

  // cloud B is *correlated*: it shies away to the far side of the box, and squishes when crowded
  const c = GRID / 2;
  const dx = c - a.x;
  const dy = c - a.y;
  const d = Math.max(Math.hypot(dx, dy), 0.001);
  const push = Math.min(64, 26 + d * 0.75);
  const b = { x: c + (dx / d) * push, y: c + (dy / d) * push };
  const squish = Math.max(0.62, Math.min(1, Math.hypot(b.x - a.x, b.y - a.y) / 130));

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <svg
          ref={svgRef}
          width={GRID}
          height={GRID}
          viewBox={`0 0 ${GRID} ${GRID}`}
          className="cursor-grab touch-none rounded-lg border border-white/10 active:cursor-grabbing"
          onPointerDown={(e) => {
            onGrab?.();
            dragging.current = true;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            onMove(e);
          }}
          onPointerMove={onMove}
          onPointerUp={() => (dragging.current = false)}
        >
          <CloudDefs />
          <GridLines />
          <motion.g animate={{ x: b.x, y: b.y, scale: squish }} transition={{ type: "spring", stiffness: 110, damping: 16 }}>
            <circle r={40} fill="url(#cw-cloud-b)" />
          </motion.g>
          <g transform={`translate(${a.x}, ${a.y})`}>
            <circle r={40} fill="url(#cw-cloud-a)" />
            <circle r={46} fill="none" stroke="rgba(56,189,248,0.5)" strokeDasharray="3 5" />
          </g>
        </svg>
        <div className="text-xs text-slate-400">
          {auto ? "watch: " : "drag the blue cloud — "}move one electron and the other <em>reacts</em>. They are not independent.
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6">
        <motion.div
          className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Dial size={64} />
          <span className="text-lg text-slate-400">+</span>
          <Dial size={64} />
          <span className="text-sm text-slate-400">= 2,000?</span>
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
          >
            <div className="h-[2px] w-[92%] rotate-[-8deg] rounded bg-red-400/80" />
          </motion.div>
        </motion.div>

        <motion.div
          className="flex items-center gap-3 rounded-xl border border-sky-400/40 bg-sky-400/[0.06] px-4 py-3 shadow-[0_0_24px_rgba(56,189,248,0.15)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.1 }}
        >
          <Dial size={64} accent />
          <span className="text-lg text-sky-300">×</span>
          <Dial size={64} accent />
          <span className="text-sm font-semibold text-sky-200">= 1,000,000</span>
        </motion.div>
      </div>

      <div className="max-w-md text-center text-sm leading-relaxed text-slate-300">
        Because we must track every <em>pairing</em> — first electron in box A <em>and</em> second in box B — the second
        dial hangs off <em>every notch</em> of the first.
      </div>
    </div>
  );
}

/* ---------- beat 3: the cosmic ruler ---------- */

function milestone(n: number): string | null {
  if (n >= 30) return "five carbon atoms: 10⁹⁰. A wall, not a hill.";
  if (n >= 27) return "…and we just blew past every atom in the observable universe.";
  if (n >= 12) return "two carbon atoms: 10³⁶ numbers.";
  if (n >= 6) return "one carbon atom: a billion billion (10¹⁸) numbers.";
  if (n >= 3) return "a billion numbers.";
  if (n >= 2) return "a million numbers.";
  return "a thousand numbers. Easy.";
}

function BeatThree({ n, setN }: { n: number; setN: (n: number) => void }) {
  const exp = 3 * n;
  const H = 300;
  const y = (e: number) => H - (e / 100) * H;
  const over = exp > 80;

  return (
    <div className="flex flex-wrap items-start justify-center gap-10">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-[64px] max-w-[300px] flex-wrap content-start items-center justify-center gap-1 overflow-hidden">
          {Array.from({ length: Math.min(n, 30) }, (_, i) => (
            <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <Dial size={i < 6 ? 34 : 22} label="" />
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <div className="text-sm text-slate-400">
            electrons: <span className="font-semibold text-slate-200">{n}</span>
            {n % 6 === 0 && <span className="text-slate-500"> ({n / 6} carbon atom{n > 6 ? "s" : ""})</span>}
          </div>
          <div className={`mt-1 text-3xl font-bold tabular-nums ${over ? "text-red-400" : "text-sky-300"}`}>
            10<sup className="text-xl">{exp}</sup>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            = 1,000<sup>{n}</sup> numbers to write down
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={milestone(n)}
              className={`mt-3 max-w-[260px] text-sm leading-snug ${over ? "text-red-300" : "text-slate-300"}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              {milestone(n)}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">1</span>
          <input
            type="range"
            min={1}
            max={30}
            value={n}
            onChange={(e) => setN(parseInt(e.target.value))}
            className="w-52 accent-sky-400"
          />
          <span className="text-xs text-slate-500">30</span>
        </div>
      </div>

      <svg width={250} height={H + 30} viewBox={`0 0 250 ${H + 30}`}>
        <line x1={40} y1={10} x2={40} y2={H + 10} stroke="rgba(255,255,255,0.25)" />
        {REFS.map((r) => (
          <g key={r.exp} transform={`translate(0, ${y(r.exp) + 10})`}>
            <line x1={34} x2={46} stroke={exp >= r.exp ? "rgba(248,113,113,0.9)" : "rgba(148,163,184,0.6)"} strokeWidth="1.5" />
            <line x1={46} x2={244} stroke="rgba(148,163,184,0.18)" strokeDasharray="3 4" />
            <text x={50} y={-3} fontSize="9" fill={exp >= r.exp ? "#fca5a5" : "#94a3b8"}>
              10<tspan fontSize="7" dy="-3">{r.exp}</tspan>
              <tspan fontSize="9" dy="3"> {r.label}</tspan>
            </text>
          </g>
        ))}
        <motion.rect
          x={33}
          width={14}
          rx={3}
          animate={{ y: y(Math.min(exp, 100)) + 10, height: H - y(Math.min(exp, 100)) }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
          fill={over ? "rgba(248,113,113,0.75)" : "rgba(56,189,248,0.75)"}
        />
        {over && (
          <motion.text
            x={40}
            y={8}
            textAnchor="middle"
            fontSize="14"
            fill="#f87171"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            ↑
          </motion.text>
        )}
      </svg>
    </div>
  );
}

/* ---------- shell ---------- */

const BEATS = ["1 · one electron", "2 · why it multiplies", "3 · let it run"];

/** ?beat=1|2|3 renders a single beat, chrome-free — for embedding each concept inline. */
function soloBeatFromUrl(): number | null {
  const p = new URLSearchParams(window.location.search).get("beat");
  if (!p) return null;
  const n = parseInt(p, 10);
  return Number.isFinite(n) && n >= 1 && n <= 3 ? n - 1 : null;
}

export default function CombinatorialWallAsset() {
  const solo = useRef(soloBeatFromUrl()).current;
  const [beat, setBeat] = useState(solo ?? 0);
  const [n, setN] = useState(6);
  const [auto, setAuto] = useState(false);
  const timers = useRef<number[]>([]);

  const stopAuto = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setAuto(false);
  }, []);

  const play = useCallback(() => {
    stopAuto();
    setAuto(true);
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    if (solo === 1) {
      // solo beat 2: sweep hands-free until the reader grabs the cloud
      return;
    }
    if (solo === 2) {
      // solo beat 3: just ramp the electron count
      setN(1);
      for (let k = 1; k <= 30; k++) at(k * 380, () => setN(k));
      at(30 * 380 + 1200, () => setAuto(false));
      return;
    }
    setBeat(0);
    setN(1);
    at(3200, () => setBeat(1));
    at(10200, () => setBeat(2));
    for (let k = 1; k <= 30; k++) at(10200 + k * 380, () => setN(k));
    at(10200 + 30 * 380 + 1200, () => setAuto(false));
  }, [stopAuto, solo]);

  // attract mode for the solo beats: self-demo until the reader takes over,
  // then resume after a stretch of idleness (full-mode narrative never auto-plays)
  const { ambient, notifyInteraction } = useAmbient();
  useEffect(() => {
    if (solo === 1) setAuto(ambient);
  }, [solo, ambient]);
  useEffect(() => {
    if (solo !== 2 || !ambient) return;
    play();
    const iv = window.setInterval(play, 30 * 380 + 5600);
    return () => window.clearInterval(iv);
  }, [solo, ambient, play]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: BG }}>
      <div className="flex flex-1 items-center justify-center px-4 pt-20 pb-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={beat}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            {beat === 0 && <BeatOne />}
            {beat === 1 && <BeatTwo auto={auto} onGrab={() => { stopAuto(); notifyInteraction(); }} />}
            {beat === 2 && <BeatThree n={n} setN={(v) => { stopAuto(); notifyInteraction(); setN(v); }} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-col items-center gap-2 pb-5">
        {solo === null && (
          <>
            <div className="text-xs text-slate-500">The odometer that outruns the universe — why the exact equation is unsolvable</div>
            <div className="flex items-center gap-2">
              {BEATS.map((b, i) => (
                <button
                  key={b}
                  onClick={() => { stopAuto(); setBeat(i); }}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${
                    beat === i ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  {b}
                </button>
              ))}
              <button
                onClick={auto ? stopAuto : play}
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  auto ? "bg-red-400/20 text-red-300" : "bg-sky-400/15 text-sky-300 hover:bg-sky-400/25"
                }`}
              >
                {auto ? "■ stop" : "▶ autoplay"}
              </button>
            </div>
          </>
        )}
        {solo === 2 && (
          <button
            onClick={() => {
              notifyInteraction();
              if (auto) stopAuto();
              else play();
            }}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              auto ? "bg-red-400/20 text-red-300" : "bg-sky-400/15 text-sky-300 hover:bg-sky-400/25"
            }`}
          >
            {auto ? "■ stop" : "▶ watch it run away"}
          </button>
        )}
      </div>
    </div>
  );
}
