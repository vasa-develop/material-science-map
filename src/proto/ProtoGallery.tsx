import { useState, type ComponentType } from "react";
import CharacterizationAsset from "./CharacterizationAsset";
import CrucibleAsset from "./CrucibleAsset";
import DatabaseStackAsset from "./DatabaseStackAsset";
import DatabasesAsset from "./DatabasesAsset";
import DensityAsset from "./DensityAsset";
import GenerativeAsset from "./GenerativeAsset";
import GenerativeGemAsset from "./GenerativeGemAsset";
import HtsAsset from "./HtsAsset";
import HtsFormulaAsset from "./HtsFormulaAsset";
import HtsFunnelAsset from "./HtsFunnelAsset";
import HteAsset from "./HteAsset";
import LiteratureAsset from "./LiteratureAsset";
import MdAsset from "./MdAsset";
import MdOrbitalAsset from "./MdOrbitalAsset";
import MdProbeAsset from "./MdProbeAsset";
import MlipAsset from "./MlipAsset";
import Orbital2sAsset from "./Orbital2sAsset";
import PredictiveAsset from "./PredictiveAsset";
import SdlAsset from "./SdlAsset";
import SynthesisParamsAsset from "./SynthesisParamsAsset";
import ThinFilmAsset from "./ThinFilmAsset";

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
  { id: "hts-formula", label: "HTS · formulas → crystals", Comp: HtsFormulaAsset },
  { id: "hts-funnel", label: "HTS · funnel filter", Comp: HtsFunnelAsset },
  { id: "databases", label: "Databases · data crystal", Comp: DatabasesAsset },
  { id: "database-stack", label: "Databases · cylinder", Comp: DatabaseStackAsset },
  { id: "xrd", label: "Characterization · XRD", Comp: CharacterizationAsset },
  { id: "sdl", label: "Self-driving lab · loop", Comp: SdlAsset },
  { id: "crucible", label: "Bulk · crucible", Comp: CrucibleAsset },
  { id: "thinfilm", label: "Precision · thin-film", Comp: ThinFilmAsset },
  { id: "hte", label: "HTE · well-plate", Comp: HteAsset },
  { id: "predictive", label: "Predictive synthesis · pathway", Comp: PredictiveAsset },
  { id: "literature", label: "Literature · dark data", Comp: LiteratureAsset },
  { id: "params", label: "Synthesis parameters · gauges", Comp: SynthesisParamsAsset },
];

export default function ProtoGallery() {
  const [id, setId] = useState(ASSETS[0].id);
  const Active = ASSETS.find((a) => a.id === id)!.Comp;

  return (
    <div className="fixed inset-0 bg-[#06070d]">
      <Active />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
        <div className="pointer-events-auto flex max-h-[42vh] max-w-[96vw] flex-wrap justify-center gap-1 overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(8,10,18,0.78)] p-2 backdrop-blur-md">
          {ASSETS.map((a) => (
            <button
              key={a.id}
              onClick={() => setId(a.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition ${
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
