import { useState, type ComponentType } from "react";
import DatabaseStackAsset from "./DatabaseStackAsset";
import DatabasesAsset from "./DatabasesAsset";
import DensityAsset from "./DensityAsset";
import GenerativeAsset from "./GenerativeAsset";
import GenerativeGemAsset from "./GenerativeGemAsset";
import HtsAsset from "./HtsAsset";
import MdAsset from "./MdAsset";
import MdOrbitalAsset from "./MdOrbitalAsset";
import MdProbeAsset from "./MdProbeAsset";
import MlipAsset from "./MlipAsset";
import Orbital2sAsset from "./Orbital2sAsset";

/** A scratch gallery to author + review each node's 3D asset in isolation. */
const ASSETS: { id: string; label: string; Comp: ComponentType }[] = [
  { id: "md", label: "MD · species", Comp: MdAsset },
  { id: "md-phase", label: "MD · phase color", Comp: () => <MdAsset mode="phase" /> },
  { id: "md-orbital", label: "MD · orbital atoms", Comp: MdOrbitalAsset },
  { id: "md-probe", label: "MD · glow probes", Comp: MdProbeAsset },
  { id: "mlip", label: "MLIP · energy landscape", Comp: MlipAsset },
  { id: "density", label: "DFT · electron density", Comp: DensityAsset },
  { id: "orbital-2s", label: "2s orbital", Comp: Orbital2sAsset },
  { id: "generative", label: "Generative · assembly", Comp: GenerativeAsset },
  { id: "generative-gem", label: "Generative · sparkle", Comp: GenerativeGemAsset },
  { id: "hts", label: "HTS · screening funnel", Comp: HtsAsset },
  { id: "databases", label: "Databases · data crystal", Comp: DatabasesAsset },
  { id: "database-stack", label: "Databases · cylinder", Comp: DatabaseStackAsset },
];

export default function ProtoGallery() {
  const [id, setId] = useState(ASSETS[0].id);
  const Active = ASSETS.find((a) => a.id === id)!.Comp;

  return (
    <div className="fixed inset-0 bg-[#06070d]">
      <Active />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
        <div className="pointer-events-auto flex gap-1 rounded-full border border-white/10 bg-[rgba(8,10,18,0.72)] p-1 backdrop-blur-md">
          {ASSETS.map((a) => (
            <button
              key={a.id}
              onClick={() => setId(a.id)}
              className={`rounded-full px-4 py-1.5 text-xs transition ${
                id === a.id ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
