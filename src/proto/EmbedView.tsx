import { useParams } from "react-router-dom";
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
    </div>
  );
}
