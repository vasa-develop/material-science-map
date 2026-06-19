import type { MapNode } from "./types";

/**
 * Visual map: each scene is a full-bleed illustration; children declare where they
 * live inside the parent illustration (originInParent), which drives both the clickable
 * hotspot and the zoom-into-hotspot transition.
 *
 * Rects are normalized (0..1) over the parent image: { x, y, w, h } from top-left.
 * They're approximate — hotspots are visible on hover so they're easy to fine-tune.
 */

const dft: MapNode = {
  id: "dft",
  title: "First-Principles / DFT",
  subtitle: "Quantum-chemical methods",
  kind: "branch",
  accent: "#38bdf8",
  image: "/scenes/dft.png",
  originInParent: { x: 0.2, y: 0.04, w: 0.2, h: 0.3 },
  fields: {
    why: "Approximately solve the quantum many-electron problem so a material's properties can be predicted from its structure alone.",
    where: "The input layer of computational discovery: ground-state energy, electronic structure and formation energies that feed phase stability and screening.",
    removes: "The need to synthesize a candidate just to learn its basic properties.",
    creates: "Steep computational cost (~N³ scaling) — limited to ~hundreds of atoms, mostly 0 K and periodic systems.",
  },
  children: [
    {
      id: "dft-xc",
      title: "Exchange–Correlation Functionals",
      subtitle: "The accuracy knob",
      kind: "concept",
      accent: "#38bdf8",
      originInParent: { x: 0.8, y: 0.1, w: 0.18, h: 0.13 },
      body: "DFT is exact in principle, but the exchange–correlation term must be approximated — and that single choice sets your error bars. The ladder climbs LDA → GGA (PBE) → meta-GGA (SCAN) → hybrids (HSE), trading cost for accuracy at each rung.",
    },
    {
      id: "dft-basis",
      title: "Basis Sets & Plane Waves",
      subtitle: "Representing the wavefunction",
      kind: "concept",
      accent: "#38bdf8",
      originInParent: { x: 0.1, y: 0.79, w: 0.18, h: 0.17 },
      body: "Periodic solids are usually solved in a plane-wave basis with pseudopotentials (VASP, Quantum ESPRESSO); molecules often use Gaussian bases. The plane-wave cutoff energy and k-point mesh are the knobs that trade accuracy for cost.",
    },
    {
      id: "dft-limits",
      title: "Where DFT Breaks Down",
      subtitle: "Know the failure modes",
      kind: "leaf",
      accent: "#f87171",
      originInParent: { x: 0.82, y: 0.78, w: 0.16, h: 0.18 },
      body: "Strongly-correlated systems, van der Waals, band gaps, excited states and finite-temperature/entropy effects are hard or wrong by default. This is exactly why DFT data must be validated and why MLIPs and experiments stay in the loop.",
      links: [{ label: "Primer: DFT in one sitting (todo)", href: "#", kind: "primer" }],
    },
  ],
};

const mlip: MapNode = {
  id: "mlip",
  title: "ML Interatomic Potentials",
  subtitle: "MLIPs / GNN potentials",
  kind: "branch",
  accent: "#22d3ee",
  originInParent: { x: 0.09, y: 0.3, w: 0.2, h: 0.22 },
  fields: {
    why: "Learn the DFT potential-energy surface with ML (often graph neural networks) to get near-DFT accuracy at near-MD speed.",
    where: "A drop-in replacement for force fields and DFT inside MD and high-throughput screening.",
    removes: "The speed-vs-accuracy trade-off — orders of magnitude faster than DFT.",
    creates: "Out-of-distribution fragility — silently unreliable outside the training distribution.",
  },
};

const hts: MapNode = {
  id: "hts",
  title: "High-Throughput Screening",
  subtitle: "HTS pipelines",
  kind: "branch",
  accent: "#a3e635",
  originInParent: { x: 0.28, y: 0.38, w: 0.16, h: 0.2 },
  fields: {
    why: "Automate running DFT/property calculations over huge candidate sets to filter for promising materials.",
    where: "Sits on top of databases + DFT/MLIPs to rank and triage candidates against target criteria.",
    removes: "Manual, human-paced filtering of the candidate space.",
    creates: "The 'streetlight effect' — you only find what your descriptors and filters were built to look for.",
  },
};

const generative: MapNode = {
  id: "generative",
  title: "Generative & Foundation Models",
  subtitle: "De novo / inverse design",
  kind: "branch",
  accent: "#a78bfa",
  originInParent: { x: 0.15, y: 0.56, w: 0.17, h: 0.22 },
  fields: {
    why: "Inverse design: generate novel structures conditioned on desired target properties instead of enumerating them.",
    where: "Proposes candidate structures upstream of screening and validation.",
    removes: "The combinatorial explosion of structure space — generate rather than enumerate.",
    creates: "The 'synthesizability mirage' — plausible-looking, stable-on-paper crystals that nobody can actually make.",
  },
};

const databases: MapNode = {
  id: "databases",
  title: "Databases",
  subtitle: "The shared substrate",
  kind: "branch",
  accent: "#60a5fa",
  originInParent: { x: 0.27, y: 0.64, w: 0.18, h: 0.22 },
  fields: {
    why: "Aggregate computed and experimental materials data into queryable, reusable corpora (Materials Project, ICSD, OQMD, NOMAD).",
    where: "The substrate that trains ML models and feeds screening pipelines.",
    removes: "Re-computing or re-measuring what someone already did.",
    creates: "Inherited bias — models and screens are shaped by whatever happens to be in the database.",
  },
};

const solidState: MapNode = {
  id: "syn-solidstate",
  title: "Solid-State Synthesis",
  subtitle: "Mix · heat · react",
  kind: "branch",
  accent: "#fb923c",
  originInParent: { x: 0.55, y: 0.03, w: 0.18, h: 0.3 },
  fields: {
    why: "The workhorse route for inorganic crystalline solids: mix powders, heat, react.",
    where: "Bulk oxides, phosphates and borates — much of what Materials-Project-style discovery targets.",
    removes: "Direct access to thermodynamically stable bulk phases.",
    creates: "Slow, hard-to-control kinetics; precursor and temperature choices are largely empirical.",
  },
};

const sdl: MapNode = {
  id: "syn-sdl",
  title: "Self-Driving Labs",
  subtitle: "Closed-loop autonomy",
  kind: "branch",
  accent: "#fbbf24",
  originInParent: { x: 0.6, y: 0.44, w: 0.2, h: 0.24 },
  fields: {
    why: "Close the loop: an optimizer proposes experiments, robots run them, results feed back automatically.",
    where: "Scales experimentation and active learning over recipe/parameter space.",
    removes: "Human-paced, one-at-a-time experimentation.",
    creates: "Hardware/integration burden; only as smart as its objective and search space.",
  },
  links: [{ label: "Demo: micro self-driving lab (this repo)", href: "#", kind: "demo" }],
};

const characterization: MapNode = {
  id: "syn-char",
  title: "Characterization",
  subtitle: "Measure what you made",
  kind: "branch",
  accent: "#f472b6",
  originInParent: { x: 0.58, y: 0.66, w: 0.2, h: 0.22 },
  fields: {
    why: "Measure what you actually made — phase purity, structure, composition.",
    where: "The 'score' step of any synthesis loop (XRD, spectroscopy, microscopy).",
    removes: "Ambiguity about whether the target was really obtained.",
    creates: "Interpretation bottleneck — turning spectra into decisions is itself hard.",
  },
};

export const ROOT: MapNode = {
  id: "root",
  title: "Materials Science",
  subtitle: "Discover · Understand · Design · Make · Impact",
  kind: "root",
  accent: "#38bdf8",
  image: "/scenes/overview.png",
  body: "An interactive map of how materials are discovered and made. Click a building to fly in; use the breadcrumbs to pull back out.",
  children: [dft, mlip, hts, generative, databases, solidState, sdl, characterization],
};
