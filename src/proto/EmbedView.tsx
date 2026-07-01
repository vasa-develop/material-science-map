import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ASSETS } from "./ProtoGallery";

/**
 * Chrome-free single-asset view for iframe embedding (e.g. Notion/super.so blog).
 * Usage: /embed/comb-wall, /embed/landscape-game, ...
 */
export default function EmbedView() {
  const { id } = useParams();
  const asset = ASSETS.find((a) => a.id === id);

  if (!asset) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#06070d] text-sm text-slate-500">
        unknown asset "{id}" — available: {ASSETS.map((a) => a.id).join(", ")}
      </div>
    );
  }

  const Comp = asset.Comp;
  return (
    <div className="fixed inset-0 bg-[#06070d]">
      <Comp />
      <InteractiveBadge />
    </div>
  );
}

/** Uniform cue so readers know every embedded visual responds to them. */
function InteractiveBadge() {
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-50 flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-[#0b0e18]/85 px-2.5 py-1 text-[11px] tracking-wide text-sky-300 backdrop-blur-sm">
      <motion.span
        className="h-1.5 w-1.5 rounded-full bg-sky-400"
        animate={{ opacity: [1, 0.25, 1], scale: [1, 0.8, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      interactive
    </div>
  );
}
