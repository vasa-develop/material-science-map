import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAmbient } from "./useAmbient";

/**
 * Asset: "one tile" — why the perfect crystal is the one kind of matter that
 * fits in a computer, and how disorder kills the shortcut.
 *
 * DFT section, the fine-print beat. Left: the unit-cell tile with a handful
 * of atoms; the reader drags one atom and the ENTIRE lattice (right) updates
 * everywhere at once — one edit, 10²³ copies. Then "make it messy": site by
 * site, tiles get jumbled (atoms shoved, species swapped) until no two tiles
 * match; the tile's own border breaks, because there is no tile anymore.
 *
 * Deliberate constraints:
 *  · The messiness is per-SITE randomness (jitter + occupancy swaps), i.e.
 *    exactly the alloy/disorder failure the prose names as the villain — not
 *    melting, not motion. Atoms stay near lattice sites.
 *  · Ambient sweeps the draggable atom hands-free until the reader grabs it
 *    (comb-wall beat-2 pattern); it never presses "make it messy" on its
 *    own — the breakage is the reader's act, per the caption.
 */

const T = 100; // logical tile coordinate space
const TILE = 168; // left tile display size
const CELL = 56; // lattice tile display size
const COLS = 8;
const ROWS = 6;
const N_TILES = COLS * ROWS;

// the fixed atoms of the motif (sky + violet), plus the draggable amber one
const FIXED = [
  { x: 28, y: 30, r: 10, fill: "#38bdf8" },
  { x: 50, y: 76, r: 6.5, fill: "#a78bfa" },
];
const DRAG_R = 8;

type AtomPos = { x: number; y: number };

/** per-tile disorder: jitter for every atom + maybe a species swap */
type Mess = { jit: AtomPos[]; swap: boolean; rank: number };

export default function OneTileAsset() {
  const [atom, setAtom] = useState<AtomPos>({ x: 72, y: 44 });
  const [messy, setMessy] = useState(false);
  const [prog, setProg] = useState(0); // 0..1, how many tiles have broken
  const [dragged, setDragged] = useState(false);
  const dragging = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const iv = useRef<number | null>(null);
  const raf = useRef(0);
  const { ambient, notifyInteraction } = useAmbient();

  const mess = useMemo<Mess[]>(() => {
    const ranks = Array.from({ length: N_TILES }, (_, i) => i);
    for (let i = ranks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ranks[i], ranks[j]] = [ranks[j], ranks[i]];
    }
    return Array.from({ length: N_TILES }, (_, i) => ({
      jit: Array.from({ length: 3 }, () => ({
        x: (Math.random() - 0.5) * 26,
        y: (Math.random() - 0.5) * 26,
      })),
      swap: Math.random() < 0.42,
      rank: ranks[i],
    }));
  }, []);

  const clearIv = () => {
    if (iv.current !== null) window.clearInterval(iv.current);
    iv.current = null;
  };
  useEffect(() => clearIv, []);

  // ambient: sweep the amber atom on a lissajous path until the reader grabs it
  const atomRef = useRef(atom);
  atomRef.current = atom;
  useEffect(() => {
    if (!ambient || messy) return;
    const from = { ...atomRef.current };
    const t0 = performance.now();
    const loop = (t: number) => {
      const s = (t - t0) / 1000;
      const tx = 55 + Math.sin(s * 0.9) * 28;
      const ty = 48 + Math.sin(s * 0.55 + 1.2) * 24;
      const w = Math.min(1, s / 1.4);
      setAtom({ x: from.x + (tx - from.x) * w, y: from.y + (ty - from.y) * w });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [ambient, messy]);

  const onMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * T;
    const y = ((e.clientY - r.top) / r.height) * T;
    setAtom({
      x: Math.max(DRAG_R + 2, Math.min(T - DRAG_R - 2, x)),
      y: Math.max(DRAG_R + 2, Math.min(T - DRAG_R - 2, y)),
    });
  }, []);

  const makeMessy = () => {
    if (messy) return;
    notifyInteraction();
    setMessy(true);
    setProg(0);
    let t = 0;
    const ticks = 36; // ~1.8s of site-by-site breakage
    clearIv();
    iv.current = window.setInterval(() => {
      t++;
      setProg(Math.min(1, t / ticks));
      if (t >= ticks) clearIv();
    }, 50);
  };

  const restore = () => {
    notifyInteraction();
    clearIv();
    setMessy(false);
    setProg(0);
  };

  const brokenCount = Math.floor(prog * N_TILES);
  const fullyBroken = messy && prog >= 1;

  /** the 3 atoms of tile i, in tile coordinates, honoring its disorder */
  const tileAtoms = (i: number) => {
    const m = mess[i];
    const broken = messy && m.rank < brokenCount;
    const base = [
      { ...FIXED[0], key: "a" },
      { x: atom.x, y: atom.y, r: DRAG_R, fill: "#fbbf24", key: "b" },
      { ...FIXED[1], key: "c" },
    ];
    if (!broken) return base;
    return base.map((a, k) => ({
      ...a,
      x: Math.max(4, Math.min(T - 4, a.x + m.jit[k].x)),
      y: Math.max(4, Math.min(T - 4, a.y + m.jit[k].y)),
      fill: m.swap ? (k === 0 ? "#fbbf24" : k === 1 ? "#38bdf8" : a.fill) : a.fill,
    }));
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#06070d] px-4">
      <p className="max-w-[640px] text-center text-[13.5px] leading-relaxed text-slate-300">
        A perfect crystal is <b>one tile, repeated forever</b> — so the computer only ever solves
        the tile. <b className="text-amber-300">Drag the amber atom</b> and watch every copy obey.
        Then <b className="text-red-300">make it messy</b>, and watch the shortcut die.
      </p>

      <div className="flex flex-wrap items-start justify-center gap-9">
        {/* ——— the tile ——— */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-4 text-[11px] uppercase tracking-wider text-slate-500">
            {fullyBroken ? "the tile — gone" : "the tile — solve only this"}
          </div>
          <svg
            ref={svgRef}
            width={TILE}
            height={TILE}
            viewBox={`0 0 ${T} ${T}`}
            className={`rounded-lg ${messy ? "" : "cursor-grab touch-none active:cursor-grabbing"}`}
            onPointerDown={(e) => {
              if (messy) return;
              notifyInteraction();
              setDragged(true);
              dragging.current = true;
              (e.target as Element).setPointerCapture?.(e.pointerId);
              onMove(e);
            }}
            onPointerMove={onMove}
            onPointerUp={() => (dragging.current = false)}
          >
            <motion.rect
              x={1}
              y={1}
              width={T - 2}
              height={T - 2}
              rx={5}
              fill="rgba(255,255,255,0.03)"
              animate={{
                stroke: fullyBroken
                  ? "rgba(248,113,113,0.85)"
                  : messy
                    ? "rgba(248,113,113,0.5)"
                    : "rgba(125,211,252,0.55)",
                strokeDasharray: messy ? "5 7" : "0 0",
                opacity: fullyBroken ? 0.6 : 1,
              }}
              strokeWidth={1.8}
            />
            {/* crack lines once the tile is dead */}
            {fullyBroken && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                stroke="rgba(248,113,113,0.7)"
                strokeWidth={1.3}
                fill="none"
              >
                <path d="M 8 -2 L 34 30 L 22 55 L 44 102" />
                <path d="M 102 24 L 68 44 L 80 74 L 58 102" />
              </motion.g>
            )}
            {FIXED.map((a, k) => (
              <circle key={k} cx={a.x} cy={a.y} r={a.r} fill={a.fill} opacity={fullyBroken ? 0.35 : 0.95} />
            ))}
            <g opacity={fullyBroken ? 0.35 : 1}>
              <circle cx={atom.x} cy={atom.y} r={DRAG_R} fill="#fbbf24" />
              {!messy && (
                <circle
                  cx={atom.x}
                  cy={atom.y}
                  r={DRAG_R + 4.5}
                  fill="none"
                  stroke="rgba(251,191,36,0.55)"
                  strokeDasharray="3 4"
                />
              )}
            </g>
          </svg>
          <div className="h-4 text-[11px] text-slate-500">
            {fullyBroken ? "nothing small left to solve" : "a few atoms — cheap to solve"}
          </div>
        </div>

        {/* ——— the crystal ——— */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-4 text-[11px] uppercase tracking-wider text-slate-500">
            {fullyBroken
              ? "the chunk — every site now its own problem"
              : "the chunk in your hand — the tile, repeated"}
          </div>
          <svg
            width={COLS * CELL}
            height={ROWS * CELL}
            viewBox={`0 0 ${COLS * CELL} ${ROWS * CELL}`}
            className="rounded-lg border border-white/10"
          >
            {Array.from({ length: N_TILES }, (_, i) => {
              const cx = (i % COLS) * CELL;
              const cy = Math.floor(i / COLS) * CELL;
              const broken = messy && mess[i].rank < brokenCount;
              const s = CELL / T;
              return (
                <g key={i} transform={`translate(${cx}, ${cy})`}>
                  <rect
                    width={CELL}
                    height={CELL}
                    fill="none"
                    stroke={broken ? "rgba(248,113,113,0.16)" : "rgba(125,211,252,0.13)"}
                  />
                  {tileAtoms(i).map((a) => (
                    <motion.circle
                      key={a.key}
                      animate={{ cx: a.x * s, cy: a.y * s, fill: a.fill }}
                      transition={
                        broken
                          ? { type: "spring", stiffness: 220, damping: 16 }
                          : { duration: 0 }
                      }
                      r={a.r * s * 1.15}
                      opacity={0.95}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
          <div className="h-4 text-[11px] text-slate-500">
            {messy
              ? `${brokenCount} of ${N_TILES} tiles jumbled — and the real chunk has 10²³`
              : dragged
                ? "one edit — every copy updated at once"
                : `${N_TILES} identical copies here — 10²³ in the real chunk`}
          </div>
        </div>
      </div>

      {/* ——— controls ——— */}
      <div className="flex items-center gap-2">
        {!messy ? (
          <button
            onClick={makeMessy}
            className="rounded-full bg-red-400/15 px-4 py-2 text-[13px] font-medium text-red-300 transition hover:bg-red-400/25"
          >
            make it messy
          </button>
        ) : (
          <button
            onClick={restore}
            className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] text-slate-300 transition hover:bg-white/10"
          >
            restore order
          </button>
        )}
      </div>

      <div className="h-9 max-w-[560px] text-center text-[12px] leading-snug text-slate-400">
        <AnimatePresence mode="wait">
          {!messy ? (
            <motion.p
              key="ordered"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              describe the tile and you've described the whole chunk —{" "}
              <b>that's</b> why a crystal fits in a computer
            </motion.p>
          ) : !fullyBroken ? (
            <motion.p
              key="breaking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              jumbling, site by site — atoms shoved, species swapped — no two tiles match
              anymore…
            </motion.p>
          ) : (
            <motion.p
              key="broken"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-red-200"
            >
              no tile repeats anymore — <b>there is nothing small left to solve.</b>{" "}
              <span className="text-slate-400">to be exact you'd need every one of the 10²³
              sites — the wall again.</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
