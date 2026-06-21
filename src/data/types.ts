export interface MapField {
  /** Why it exists — the problem it solves */
  why?: string;
  /** Where it fits in the workflow */
  where?: string;
  /** Bottleneck it removes */
  removes?: string;
  /** New bottleneck it creates */
  creates?: string;
}

export interface MapLink {
  label: string;
  href: string;
  kind?: "primer" | "demo" | "ref";
}

export type NodeKind = "root" | "region" | "domain" | "branch" | "concept" | "leaf";

/** The three top-level stages of the materials loop. */
export type Stage = "discover" | "synthesis" | "characterize";

/** Internal beat of the Synthesis stage. */
export type Beat = "plan" | "make" | "automate";

/** Normalized rect (0..1) describing where a child lives inside its parent's illustration. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapNode {
  id: string;
  title: string;
  subtitle?: string;
  kind?: NodeKind;
  /** which stage this node belongs to (set on regions + their members) */
  stage?: Stage;
  /** internal beat of the Synthesis stage (plan/make/automate) */
  beat?: Beat;
  /** zoom level: 0 = region (L0), 1 = node (L1), deeper = concepts/leaves */
  level?: number;
  /** one-line essence used for L0 captions + tour narration */
  essence?: string;
  /** present in the data graph but intentionally not rendered on the map (e.g. scale-up) */
  hidden?: boolean;
  /** free-form tags for future lenses (material class, scale, maturity, ...) */
  tags?: string[];
  /** tailwind-friendly accent hue used for glow/border, e.g. "#38bdf8" */
  accent?: string;
  /** full-bleed illustration for this scene (path under /public) */
  image?: string;
  /** where this node sits inside its PARENT's illustration — drives the zoom hotspot + transition */
  originInParent?: Rect;
  /** the four-field "bottleneck" schema (top levels) */
  fields?: MapField;
  /** free-form explainer body (deeper levels / leaves) */
  body?: string;
  links?: MapLink[];
  children?: MapNode[];
}
