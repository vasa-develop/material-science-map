import type { ComponentType } from "react";
import DensityAsset, { DensityMapScene } from "../proto/DensityAsset";
import MlipAsset, { MlipMapScene } from "../proto/MlipAsset";
import HtsFunnelAsset, { HtsFunnelMapScene } from "../proto/HtsFunnelAsset";
import GenerativeAsset, { GenerativeMapScene } from "../proto/GenerativeAsset";
import DatabaseStackAsset, { DatabaseMapScene } from "../proto/DatabaseStackAsset";
import CrucibleAsset, { CrucibleMapScene } from "../proto/CrucibleAsset";
import SdlAsset, { SdlMapScene } from "../proto/SdlAsset";
import CharacterizationAsset, { CharacterizationMapScene } from "../proto/CharacterizationAsset";
import { ROOT } from "../data/map";
import { indexTree } from "../lib/tree";
import type { MapNode } from "../data/types";

const idx = indexTree(ROOT);
const meta = (id: string): MapNode => idx.byId[id];

export interface RingNode {
  id: string;
  /** step number shown on the plinth label */
  num: number;
  /** which discovery/synthesis arc this node belongs to (for layout + labels) */
  arc: "discovery" | "synthesis";
  /** mini scene rendered live on the map (content only, no lights/canvas) */
  Scene: ComponentType;
  /** full-screen asset shown when the node is opened */
  Full: ComponentType;
  /** world scale to normalize the asset to a ~building footprint on its plinth */
  scale: number;
  /** how high the asset floats above its plinth */
  lift: number;
  /** if set, slowly orbit the whole scene (for assets that relied on OrbitControls autorotate) */
  autoSpin?: number;
  node: MapNode;
}

/**
 * Top-level loop, ordered to read as a closed loop: discovery arc, then
 * synthesis arc, wiring back to the start. Scale/lift are first-pass values
 * tuned so each asset reads as a similarly-sized floating "building".
 */
export const RING_NODES: RingNode[] = [
  { id: "databases", num: 1, arc: "discovery", Scene: DatabaseMapScene, Full: DatabaseStackAsset, scale: 0.5, lift: 0.95, node: meta("databases") },
  { id: "dft", num: 2, arc: "discovery", Scene: DensityMapScene, Full: DensityAsset, scale: 0.52, lift: 1.1, node: meta("dft") },
  { id: "mlip", num: 3, arc: "discovery", Scene: MlipMapScene, Full: MlipAsset, scale: 0.42, lift: 0.95, node: meta("mlip") },
  { id: "hts", num: 4, arc: "discovery", Scene: HtsFunnelMapScene, Full: HtsFunnelAsset, scale: 0.24, lift: 1.1, node: meta("hts") },
  { id: "generative", num: 5, arc: "discovery", Scene: GenerativeMapScene, Full: GenerativeAsset, scale: 0.42, lift: 1.1, node: meta("generative") },
  { id: "syn-solidstate", num: 6, arc: "synthesis", Scene: CrucibleMapScene, Full: CrucibleAsset, scale: 0.62, lift: 0.85, node: meta("syn-solidstate") },
  { id: "syn-sdl", num: 7, arc: "synthesis", Scene: SdlMapScene, Full: SdlAsset, scale: 0.34, lift: 0.7, autoSpin: 0.25, node: meta("syn-sdl") },
  { id: "syn-char", num: 8, arc: "synthesis", Scene: CharacterizationMapScene, Full: CharacterizationAsset, scale: 0.24, lift: 1.0, autoSpin: 0.2, node: meta("syn-char") },
];

export const ringNodeById = (id: string): RingNode | undefined =>
  RING_NODES.find((n) => n.id === id);
