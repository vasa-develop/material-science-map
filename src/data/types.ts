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

export type NodeKind = "root" | "domain" | "branch" | "concept" | "leaf";

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
