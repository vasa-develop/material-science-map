import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ringNodeById } from "./ringNodes";

const EASE = [0.22, 1, 0.36, 1] as const;

const FIELD_META = [
  { key: "why", label: "Why it exists", tone: "#34d399" },
  { key: "where", label: "Where it fits", tone: "#38bdf8" },
  { key: "removes", label: "Bottleneck it removes", tone: "#a78bfa" },
  { key: "creates", label: "New bottleneck it creates", tone: "#f87171" },
] as const;

export default function NodeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const ring = id ? ringNodeById(id) : undefined;

  if (!ring) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-[#06070d] text-slate-300">
        <div className="text-center">
          <div className="mb-3">Unknown node.</div>
          <button onClick={() => navigate("/")} className="rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/10">
            ← Back to map
          </button>
        </div>
      </div>
    );
  }

  const { Full, node } = ring;
  const accent = node.accent ?? "#5fa8ff";
  const fields = node.fields;

  return (
    <motion.div
      className="fixed inset-0 bg-[#06070d]"
      initial={{ opacity: 0, scale: 1.18 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <Full />

      {/* top bar: back + title */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6">
        <button
          onClick={() => navigate("/")}
          className="pointer-events-auto rounded-full border border-white/15 bg-[rgba(5,8,16,0.7)] px-3.5 py-1.5 text-sm text-slate-200 backdrop-blur-md transition hover:bg-white/10"
        >
          ← Map
        </button>
        <div
          className="pointer-events-auto rounded-xl border bg-[rgba(5,8,16,0.72)] px-4 py-2 text-right backdrop-blur-md"
          style={{ borderColor: `${accent}55` }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: accent }}>
            {node.subtitle}
          </div>
          <div className="text-lg font-semibold text-white">{node.title}</div>
        </div>
      </div>

      {/* the four-field schema */}
      {fields && (
        <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-4 sm:top-24">
          <div className="grid w-full max-w-5xl gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {FIELD_META.filter((m) => fields[m.key]).map((m) => (
              <div key={m.key} className="rounded-xl border border-white/10 bg-[rgba(5,8,16,0.62)] p-3 backdrop-blur-md">
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: m.tone }}>
                  {m.label}
                </div>
                <p className="mt-1 text-[13px] leading-snug text-slate-300">{fields[m.key]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
