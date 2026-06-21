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
import type { Stage, MapNode } from "../data/types";

const idx = indexTree(ROOT);
const meta = (id: string): MapNode => idx.byId[id];

/* ─────────────────────────── L1 node visuals ─────────────────────────── */

export interface RingNode {
  id: string;
  /** which stage this node belongs to */
  stage: Stage;
  /** mini scene rendered live on the map (content only, no lights/canvas) */
  Scene: ComponentType;
  /** full-screen asset shown when the node is opened */
  Full: ComponentType;
  /** world scale to normalize the asset to a ~building footprint on its plinth */
  scale: number;
  /** how high the asset floats above its plinth */
  lift: number;
  /** if set, slowly orbit the whole scene */
  autoSpin?: number;
  /** optional override for the node's L1 glow/label accent (else uses node.accent) */
  accent?: string;
  node: MapNode;
}

/**
 * Per-node asset mappings (used at L1, when a region is opened). Only the nodes
 * with a real built asset are listed; the rest render as placeholder totems.
 */
export const RING_NODES: RingNode[] = [
  { id: "databases", stage: "discover", Scene: DatabaseMapScene, Full: DatabaseStackAsset, scale: 0.5, lift: 0.95, node: meta("databases") },
  { id: "dft", stage: "discover", Scene: DensityMapScene, Full: DensityAsset, scale: 0.52, lift: 1.1, accent: "#f97316", node: meta("dft") },
  { id: "mlip", stage: "discover", Scene: MlipMapScene, Full: MlipAsset, scale: 0.42, lift: 0.95, node: meta("mlip") },
  { id: "hts", stage: "discover", Scene: HtsFunnelMapScene, Full: HtsFunnelAsset, scale: 0.24, lift: 1.1, node: meta("hts") },
  { id: "generative", stage: "discover", Scene: GenerativeMapScene, Full: GenerativeAsset, scale: 0.42, lift: 1.1, node: meta("generative") },
  { id: "syn-solidstate", stage: "synthesis", Scene: CrucibleMapScene, Full: CrucibleAsset, scale: 0.62, lift: 0.85, node: meta("syn-solidstate") },
  { id: "syn-sdl", stage: "synthesis", Scene: SdlMapScene, Full: SdlAsset, scale: 0.34, lift: 0.7, autoSpin: 0.25, node: meta("syn-sdl") },
  { id: "char-diffraction", stage: "characterize", Scene: CharacterizationMapScene, Full: CharacterizationAsset, scale: 0.24, lift: 1.0, autoSpin: 0.2, node: meta("char-diffraction") },
];

export const ringNodeById = (id: string): RingNode | undefined =>
  RING_NODES.find((n) => n.id === id);

/* ─────────────────────────── L0 region heroes ─────────────────────────── */

export interface RegionVis {
  id: string;
  /** stage this region represents */
  stage: Stage;
  /** step number shown on the region label */
  num: number;
  /** hero totem scene shown at L0 (reuses an iconic member asset for now) */
  Hero: ComponentType;
  /** world scale / float height / idle spin for the hero */
  heroScale: number;
  heroLift: number;
  heroSpin: number;
  /** L0 ground position (x, z) */
  pos: [number, number];
  /** region metadata (title, essence, accent, children) from the content spine */
  node: MapNode;
}

/**
 * Three legible regions in one shared space, wired discover → synthesis →
 * characterize and looping back. Hero scenes are first-cut emblems reusing the
 * most iconic asset of each stage; we can swap in bespoke region totems later.
 */
export const REGIONS: RegionVis[] = [
  {
    id: "discover",
    stage: "discover",
    num: 1,
    Hero: DensityMapScene,
    heroScale: 0.62,
    heroLift: 1.45,
    heroSpin: 0.16,
    pos: [6.2, -0.5],
    node: meta("discover"),
  },
  {
    id: "synthesis",
    stage: "synthesis",
    num: 2,
    Hero: CrucibleMapScene,
    heroScale: 0.78,
    heroLift: 1.15,
    heroSpin: 0.1,
    pos: [-6.2, -0.5],
    node: meta("synthesis"),
  },
  {
    id: "characterize",
    stage: "characterize",
    num: 3,
    Hero: CharacterizationMapScene,
    heroScale: 0.24,
    heroLift: 1.7,
    heroSpin: 0.18,
    pos: [0, 7.5],
    node: meta("characterize"),
  },
];

export const regionById = (id: string): RegionVis | undefined =>
  REGIONS.find((r) => r.id === id);

/** L1 nodes belonging to a given region/stage, in spine order. */
export const regionMembers = (stage: Stage): MapNode[] => {
  const region = REGIONS.find((r) => r.stage === stage);
  return region?.node.children ?? [];
};
