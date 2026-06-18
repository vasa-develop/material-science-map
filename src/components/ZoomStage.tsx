import { AnimatePresence, motion } from "framer-motion";
import type { MapNode, Rect } from "../data/types";

interface ZoomStageProps {
  node: MapNode;
  path: MapNode[];
  direction: number;
  focusRect?: Rect;
  onNavigate: (id: string) => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/** Transform that zooms the scene so `rect` fills the viewport. */
function focus(rect: Rect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const k = 1 / rect.w;
  return { scale: k, x: `${-(cx - 0.5) * k * 100}%`, y: `${-(cy - 0.5) * k * 100}%` };
}

/** Transform that shrinks the scene down into `rect` (where a child lives in its parent). */
function invFocus(rect: Rect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return { scale: rect.w, x: `${(cx - 0.5) * 100}%`, y: `${(cy - 0.5) * 100}%` };
}

interface Custom {
  direction: number;
  rect?: Rect;
}

const artVariants = {
  enter: (c: Custom) =>
    c.rect
      ? { ...(c.direction >= 0 ? invFocus(c.rect) : focus(c.rect)), opacity: 0 }
      : { opacity: 0, scale: c.direction >= 0 ? 0.92 : 1.08, x: "0%", y: "0%" },
  center: { scale: 1, x: "0%", y: "0%", opacity: 1 },
  exit: (c: Custom) =>
    c.rect
      ? { ...(c.direction >= 0 ? focus(c.rect) : invFocus(c.rect)), opacity: 0 }
      : { opacity: 0, scale: c.direction >= 0 ? 1.08 : 0.92, x: "0%", y: "0%" },
};

export default function ZoomStage({
  node,
  path,
  direction,
  focusRect,
  onNavigate,
}: ZoomStageProps) {
  const custom: Custom = { direction, rect: focusRect };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#05060c]">
      {/* zooming art layer */}
      <AnimatePresence custom={custom} initial={false}>
        <motion.div
          key={node.id}
          className="absolute inset-0 will-change-transform"
          custom={custom}
          variants={artVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.75, ease: EASE }}
        >
          <SceneArt node={node} onNavigate={onNavigate} />
        </motion.div>
      </AnimatePresence>

      {/* screen-fixed HUD overlay (does not zoom) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col p-4 sm:p-6">
        <div className="pointer-events-auto">
          <Breadcrumbs path={path} onNavigate={onNavigate} />
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={node.id}
            className="pointer-events-none mt-auto"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.35, ease: EASE, delay: 0.15 }}
          >
            <OverlayPanels node={node} onNavigate={onNavigate} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function SceneArt({
  node,
  onNavigate,
}: {
  node: MapNode;
  onNavigate: (id: string) => void;
}) {
  const accent = node.accent ?? "#38bdf8";
  return (
    <div className="absolute inset-0">
      {node.image ? (
        <img
          src={node.image}
          alt={node.title}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(60% 60% at 50% 40%, ${accent}22, transparent 70%), linear-gradient(180deg, #0a0f1e, #05060c)`,
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>
      )}

      {/* hotspots for children that declare a position in this scene */}
      {node.image &&
        node.children?.map(
          (c) =>
            c.originInParent && (
              <Hotspot
                key={c.id}
                rect={c.originInParent}
                label={c.title}
                accent={c.accent ?? accent}
                onClick={() => onNavigate(c.id)}
              />
            )
        )}
    </div>
  );
}

function Hotspot({
  rect,
  label,
  accent,
  onClick,
}: {
  rect: Rect;
  label: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group absolute"
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.w * 100}%`,
        height: `${rect.h * 100}%`,
      }}
    >
      <span
        className="absolute inset-0 rounded-2xl border opacity-25 transition duration-300 group-hover:opacity-100"
        style={{ borderColor: accent, boxShadow: `0 0 28px ${accent}aa, inset 0 0 24px ${accent}33` }}
      />
      <span
        className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider opacity-0 backdrop-blur-sm transition duration-300 group-hover:opacity-100"
        style={{ borderColor: `${accent}88`, color: accent, background: "rgba(5,6,12,0.7)" }}
      >
        {label} →
      </span>
    </button>
  );
}

const FIELD_META: {
  key: keyof NonNullable<MapNode["fields"]>;
  label: string;
  tone: string;
}[] = [
  { key: "why", label: "Why it exists", tone: "#34d399" },
  { key: "where", label: "Where it fits", tone: "#38bdf8" },
  { key: "removes", label: "Bottleneck it removes", tone: "#a78bfa" },
  { key: "creates", label: "New bottleneck it creates", tone: "#f87171" },
];

function OverlayPanels({
  node,
  onNavigate,
}: {
  node: MapNode;
  onNavigate: (id: string) => void;
}) {
  const accent = node.accent ?? "#38bdf8";
  const hasFields = !!node.fields;
  const showChildNav = !node.image && (node.children?.length ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* title block */}
      <div
        className="pointer-events-auto inline-block rounded-xl border bg-[rgba(5,8,16,0.72)] px-4 py-2.5 backdrop-blur-md"
        style={{ borderColor: `${accent}55` }}
      >
        <div
          className="text-[10px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: accent }}
        >
          {node.subtitle ?? node.kind ?? "node"}
        </div>
        <div className="text-xl font-semibold text-white sm:text-2xl">{node.title}</div>
      </div>

      {node.body && (
        <p className="mt-3 max-w-2xl rounded-xl bg-[rgba(5,8,16,0.55)] px-3 py-2 text-sm leading-relaxed text-slate-300 backdrop-blur-sm">
          {node.body}
        </p>
      )}

      {hasFields && (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {FIELD_META.filter((m) => node.fields![m.key]).map((m) => (
            <div
              key={m.key}
              className="rounded-xl border border-white/10 bg-[rgba(5,8,16,0.62)] p-3 backdrop-blur-md"
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: m.tone }}
              >
                {m.label}
              </div>
              <p className="mt-1 text-[13px] leading-snug text-slate-300">
                {node.fields![m.key]}
              </p>
            </div>
          ))}
        </div>
      )}

      {(node.links?.length || showChildNav) && (
        <div className="pointer-events-auto mt-3 flex flex-wrap gap-2">
          {showChildNav &&
            node.children!.map((c) => (
              <button
                key={c.id}
                onClick={() => onNavigate(c.id)}
                className="rounded-full border px-3 py-1.5 text-sm text-white transition hover:bg-white/10"
                style={{ borderColor: `${(c.accent ?? accent)}77` }}
              >
                {c.title} →
              </button>
            ))}
          {node.links?.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10"
            >
              {l.kind === "demo" ? "▶ " : l.kind === "primer" ? "✎ " : "↗ "}
              {l.label}
            </a>
          ))}
        </div>
      )}

      {node.image && (node.children?.length ?? 0) > 0 && (
        <div className="mt-3 text-xs text-slate-500">
          Hover the structures and click to fly in.
        </div>
      )}
    </div>
  );
}

function Breadcrumbs({
  path,
  onNavigate,
}: {
  path: MapNode[];
  onNavigate: (id: string) => void;
}) {
  return (
    <nav className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border border-white/10 bg-[rgba(5,8,16,0.7)] px-3 py-1.5 text-sm backdrop-blur-md">
      {path.map((n, i) => {
        const last = i === path.length - 1;
        return (
          <span key={n.id} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-slate-600">/</span>}
            <button
              onClick={() => !last && onNavigate(n.id)}
              disabled={last}
              className={last ? "font-medium text-white" : "text-slate-400 transition hover:text-sky-300"}
            >
              {n.title}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
