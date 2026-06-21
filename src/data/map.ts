import type { MapNode } from "./types";

/**
 * Content spine for the interactive map.
 *
 * THREE ACTS — the top level (L0) the viewer first lands on:
 *   ① DISCOVER     — find promising materials without making them
 *   ② SYNTHESIS    — plan it, make it, automate it  (beats: plan → make → automate)
 *   ③ CHARACTERIZE — measure what you made, learn why
 * with a feedback loop characterize → discover closing the cycle.
 *
 * Each stage is a `region` node (level 0). Its children are the individual
 * fields/methods (level 1), which may themselves carry concept/leaf children.
 *
 * The synthesizability gap is intentionally NOT a top-level object — it is
 * explained as the closing beat of Discover and the opening premise of
 * Synthesis, keeping L0 clean.
 */

/* ──────────────────────────── ① DISCOVER ──────────────────────────── */

const designObjective: MapNode = {
  id: "design-objective",
  title: "Design Objective",
  subtitle: "What are we even looking for?",
  kind: "branch",
  stage: "discover",
  level: 1,
  accent: "#7dd3fc",
  essence: "Pin down the target property before searching the space.",
  fields: {
    why: "Every discovery campaign starts by turning a vague wish ('a better battery cathode') into a concrete, computable target: a property, a constraint set, a figure of merit.",
    where: "The framing step that points databases, screening and generative models at something specific.",
    removes: "Aimless search — gives the whole pipeline a direction and a stopping criterion.",
    creates: "Objective lock-in — you only ever find materials your metric knew how to ask for.",
  },
};

const databases: MapNode = {
  id: "databases",
  title: "Databases",
  subtitle: "The shared substrate",
  kind: "branch",
  stage: "discover",
  level: 1,
  accent: "#60a5fa",
  essence: "Reuse what's already computed or measured.",
  fields: {
    why: "Aggregate computed and experimental materials data into queryable, reusable corpora (Materials Project, ICSD, OQMD, NOMAD).",
    where: "The substrate that trains ML models and feeds screening pipelines.",
    removes: "Re-computing or re-measuring what someone already did.",
    creates: "Inherited bias — models and screens are shaped by whatever happens to be in the database.",
  },
};

const dft: MapNode = {
  id: "dft",
  title: "First-Principles / DFT",
  subtitle: "Quantum-chemical methods",
  kind: "branch",
  stage: "discover",
  level: 1,
  accent: "#38bdf8",
  essence: "Predict properties from structure alone, via approximate quantum mechanics.",
  fields: {
    why: "The Schrödinger equation tells us, in principle, everything about a material — but it is computationally impossible to solve exactly for real solids. DFT is the faithful approximation that makes it tractable, predicting properties from structure alone.",
    where: "The input layer of computational discovery: ground-state energy, electronic structure and formation energies that feed phase stability and screening — plus magnetism, conductivity, mechanical, thermal and optical response.",
    removes: "The need to synthesize a candidate just to learn its basic properties.",
    creates: "Steep computational cost (~N³ scaling) — limited to ~hundreds of atoms, mostly 0 K and periodic systems.",
  },
  children: [
    {
      id: "dft-schrodinger",
      title: "The Schrödinger Premise",
      subtitle: "Why we approximate at all",
      kind: "concept",
      accent: "#38bdf8",
      body: "The many-electron Schrödinger equation is the ground truth for how matter behaves — but its cost explodes with electron count, making it unsolvable for real materials. DFT reframes the problem in terms of electron density rather than the full wavefunction, turning an impossible problem into a merely hard one.",
    },
    {
      id: "dft-predicts",
      title: "What DFT Predicts",
      subtitle: "Structure → properties",
      kind: "concept",
      accent: "#38bdf8",
      body: "From a structure alone: formation energy and phase stability (convex hull), electronic structure (band structure, DOS, band gaps), magnetism, mechanical moduli, vibrational/thermal response, and optical/dielectric properties.",
    },
    {
      id: "dft-xc",
      title: "Exchange–Correlation Functionals",
      subtitle: "The accuracy knob",
      kind: "concept",
      accent: "#38bdf8",
      body: "DFT is exact in principle, but the exchange–correlation term must be approximated — and that single choice sets your error bars. The ladder climbs LDA → GGA (PBE) → meta-GGA (SCAN) → hybrids (HSE), trading cost for accuracy at each rung.",
    },
    {
      id: "dft-basis",
      title: "Basis Sets & Plane Waves",
      subtitle: "Representing the wavefunction",
      kind: "concept",
      accent: "#38bdf8",
      body: "Periodic solids are usually solved in a plane-wave basis with pseudopotentials (VASP, Quantum ESPRESSO); molecules often use Gaussian bases. The plane-wave cutoff energy and k-point mesh are the knobs that trade accuracy for cost.",
    },
    {
      id: "dft-limits",
      title: "Where DFT Breaks Down",
      subtitle: "Know the failure modes",
      kind: "leaf",
      accent: "#f87171",
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
  stage: "discover",
  level: 1,
  accent: "#22d3ee",
  essence: "Near-DFT accuracy at near-MD speed.",
  fields: {
    why: "Learn the DFT potential-energy surface with ML (often graph neural networks) to get near-DFT accuracy at near-MD speed.",
    where: "A drop-in replacement for force fields and DFT inside MD and high-throughput screening.",
    removes: "The speed-vs-accuracy trade-off — orders of magnitude faster than DFT.",
    creates: "Out-of-distribution fragility — silently unreliable outside the training distribution.",
  },
};

const generative: MapNode = {
  id: "generative",
  title: "Generative & Foundation Models",
  subtitle: "De novo / inverse design",
  kind: "branch",
  stage: "discover",
  level: 1,
  accent: "#a78bfa",
  essence: "Generate candidates instead of enumerating them.",
  fields: {
    why: "Inverse design: generate novel structures conditioned on desired target properties instead of enumerating them.",
    where: "Proposes candidate structures upstream of screening and validation.",
    removes: "The combinatorial explosion of structure space — generate rather than enumerate.",
    creates: "The 'synthesizability mirage' — plausible-looking, stable-on-paper crystals that nobody can actually make.",
  },
};

const hts: MapNode = {
  id: "hts",
  title: "High-Throughput Screening",
  subtitle: "HTS pipelines",
  kind: "branch",
  stage: "discover",
  level: 1,
  accent: "#a3e635",
  essence: "Filter huge candidate sets down to a promising few.",
  fields: {
    why: "Automate running DFT/property calculations over huge candidate sets to filter for promising materials.",
    where: "Sits on top of databases + DFT/MLIPs to rank and triage candidates against target criteria.",
    removes: "Manual, human-paced filtering of the candidate space.",
    creates: "The 'streetlight effect' — you only find what your descriptors and filters were built to look for.",
  },
};

const discover: MapNode = {
  id: "discover",
  title: "Discovery",
  subtitle: "Find promising materials without making them",
  kind: "region",
  stage: "discover",
  level: 0,
  accent: "#38bdf8",
  essence: "Explore, predict and design candidate materials — all in silico, before a single experiment.",
  children: [designObjective, databases, dft, mlip, generative, hts],
};

/* ─────────────────────────── ② SYNTHESIS ─────────────────────────── */

const synthesisPlanning: MapNode = {
  id: "syn-planning",
  title: "Synthesis Planning",
  subtitle: "From target to recipe",
  kind: "branch",
  stage: "synthesis",
  beat: "plan",
  level: 1,
  accent: "#fbbf24",
  essence: "Predict precursors, conditions and pathways to actually make the target.",
  fields: {
    why: "A stable structure on paper isn't a recipe. Planning predicts which precursors, temperatures, atmospheres and reaction pathways will actually yield a phase-pure target.",
    where: "The bridge across the synthesizability gap — between a promising candidate and a real experiment.",
    removes: "Trial-and-error guesswork about how to make a predicted compound.",
    creates: "Reliance on thermodynamic/kinetic models that are still narrow in where they work.",
  },
  children: [
    {
      id: "syn-plan-thermo",
      title: "Thermodynamic Route",
      subtitle: "Hull & grand-potential reasoning",
      kind: "concept",
      accent: "#fbbf24",
      body: "Use computed phase diagrams and grand-potential analysis to choose precursors and conditions that make the target the thermodynamically favoured product — the basis of Wenhao Sun-style predictive synthesis.",
    },
    {
      id: "syn-plan-data",
      title: "Data / Text-Mining Route",
      subtitle: "Learn recipes from the literature",
      kind: "concept",
      accent: "#fbbf24",
      body: "Mine tens of thousands of published synthesis procedures with NLP to learn empirical precursor→product patterns and suggest plausible recipes.",
    },
    {
      id: "syn-plan-classifier",
      title: "Synthesizability Classifier",
      subtitle: "Can this even be made?",
      kind: "leaf",
      accent: "#f87171",
      body: "ML models that score how likely a predicted structure is to be synthesizable at all — the gatekeeper that closes the synthesizability gap left open by generative discovery.",
    },
  ],
};

const solidState: MapNode = {
  id: "syn-solidstate",
  title: "Solid-State Synthesis",
  subtitle: "Mix · heat · react",
  kind: "branch",
  stage: "synthesis",
  beat: "make",
  level: 1,
  accent: "#fb923c",
  essence: "The workhorse route for bulk crystalline solids.",
  fields: {
    why: "The workhorse route for inorganic crystalline solids: mix powders, heat, react.",
    where: "Bulk oxides, phosphates and borates — much of what Materials-Project-style discovery targets.",
    removes: "Direct access to thermodynamically stable bulk phases.",
    creates: "Slow, hard-to-control kinetics; precursor and temperature choices are largely empirical.",
  },
};

const solution: MapNode = {
  id: "syn-solution",
  title: "Solution & Hydrothermal",
  subtitle: "Crystallize from liquid",
  kind: "branch",
  stage: "synthesis",
  beat: "make",
  level: 1,
  accent: "#34d399",
  essence: "Grow phases from solution at mild temperatures.",
  fields: {
    why: "Precipitate or crystallize materials from a liquid medium — often at far lower temperatures than solid-state, with fine control over morphology.",
    where: "Nanomaterials, metastable phases, single crystals and coatings.",
    removes: "The high-temperature barrier of solid-state routes; access to metastable phases.",
    creates: "Sensitivity to pH, solvent and additive chemistry — many coupled, hard-to-model variables.",
  },
};

const vapor: MapNode = {
  id: "syn-vapor",
  title: "Vapor & Thin-Film",
  subtitle: "Build it atom-layer by layer",
  kind: "branch",
  stage: "synthesis",
  beat: "make",
  level: 1,
  accent: "#38bdf8",
  essence: "Deposit films and crystals from the vapor phase.",
  fields: {
    why: "Grow films and crystals from gas-phase precursors (CVD, ALD, PVD, MBE) with atomic-scale thickness control.",
    where: "Semiconductors, coatings, 2D materials and device-grade epitaxial films.",
    removes: "The bulk-only limitation — enables device-relevant thin films and heterostructures.",
    creates: "Expensive, slow tooling; tight coupling between substrate, precursor and growth conditions.",
  },
};

const hte: MapNode = {
  id: "syn-hte",
  title: "High-Throughput Experimentation",
  subtitle: "Combinatorial libraries",
  kind: "branch",
  stage: "synthesis",
  beat: "automate",
  level: 1,
  accent: "#f59e0b",
  essence: "Make and test many compositions in parallel.",
  fields: {
    why: "Synthesize and screen large composition/parameter libraries in parallel instead of one sample at a time.",
    where: "Maps composition–processing–property landscapes fast; feeds data back to discovery.",
    removes: "The one-sample-at-a-time pace of manual experimentation.",
    creates: "Data-handling and quality-control burden; parallel ≠ representative of scaled-up synthesis.",
  },
};

const sdl: MapNode = {
  id: "syn-sdl",
  title: "Self-Driving Labs",
  subtitle: "Closed-loop autonomy",
  kind: "branch",
  stage: "synthesis",
  beat: "automate",
  level: 1,
  accent: "#fbbf24",
  essence: "Optimizer proposes, robots run, results feed back — automatically.",
  fields: {
    why: "Close the loop: an optimizer proposes experiments, robots run them, results feed back automatically.",
    where: "A cross-cutting autonomy layer that scales experimentation and active learning over recipe/parameter space.",
    removes: "Human-paced, one-at-a-time experimentation.",
    creates: "Hardware/integration burden; only as smart as its objective and search space.",
  },
  links: [{ label: "Demo: micro self-driving lab (this repo)", href: "#", kind: "demo" }],
};

const synthesis: MapNode = {
  id: "synthesis",
  title: "Synthesis",
  subtitle: "Plan it, make it, automate it",
  kind: "region",
  stage: "synthesis",
  level: 0,
  accent: "#fbbf24",
  essence: "Turn a promising candidate into a real, phase-pure material — from recipe planning to autonomous execution.",
  children: [synthesisPlanning, solidState, solution, vapor, hte, sdl],
};

/* ──────────────────────────── ③ CHARACTERIZE ──────────────────────────── */

const diffraction: MapNode = {
  id: "char-diffraction",
  title: "Diffraction",
  subtitle: "XRD & neutron diffraction",
  kind: "branch",
  stage: "characterize",
  level: 1,
  accent: "#f472b6",
  essence: "Read the crystal structure from how it scatters.",
  fields: {
    why: "Fire X-rays or neutrons at a sample and read its crystal structure and phase purity from the diffraction pattern.",
    where: "The first question after any synthesis: did I make the phase I wanted?",
    removes: "Ambiguity about what crystalline phase(s) you actually obtained.",
    creates: "Interpretation effort — indexing, refinement and overlapping-phase deconvolution are nontrivial.",
  },
};

const spectroscopy: MapNode = {
  id: "char-spectroscopy",
  title: "Spectroscopy",
  subtitle: "Raman · XPS · NMR",
  kind: "branch",
  stage: "characterize",
  level: 1,
  accent: "#c084fc",
  essence: "Probe bonding, oxidation states and local chemistry.",
  fields: {
    why: "Probe chemical bonding, oxidation states and local environments through how a material absorbs, emits or scatters energy.",
    where: "Complements diffraction with composition and local-structure detail.",
    removes: "Blind spots about chemistry that long-range diffraction can't see.",
    creates: "Each technique sees only part of the picture — fusion across methods is hard.",
  },
};

const microscopy: MapNode = {
  id: "char-microscopy",
  title: "Microscopy",
  subtitle: "SEM · TEM",
  kind: "branch",
  stage: "characterize",
  level: 1,
  accent: "#fb7185",
  essence: "See morphology and defects down to the atom.",
  fields: {
    why: "Image morphology, grain structure and defects — down to atomic resolution with electron microscopy.",
    where: "Connects what you made to how it actually looks and where it fails.",
    removes: "Guesswork about microstructure, interfaces and defects.",
    creates: "Tiny sampling volume — easy to mistake a local view for the whole sample.",
  },
};

const insitu: MapNode = {
  id: "char-insitu",
  title: "In-Situ / Operando",
  subtitle: "Watch it as it forms",
  kind: "branch",
  stage: "characterize",
  level: 1,
  accent: "#fda4af",
  essence: "Watch reactions and devices while they happen.",
  fields: {
    why: "Characterize a material while it reacts, grows or operates — capturing the pathway, not just the end state.",
    where: "The richest feedback for synthesis planning: which intermediates actually form, and when.",
    removes: "The blindness of only ever seeing the final, quenched product.",
    creates: "Demanding instrumentation; data volumes and time-resolution trade-offs.",
  },
};

const structureSolution: MapNode = {
  id: "char-structure",
  title: "Structure Solution",
  subtitle: "From pattern to atoms",
  kind: "branch",
  stage: "characterize",
  level: 1,
  accent: "#e879f9",
  essence: "Reconstruct the atomic arrangement from the data.",
  fields: {
    why: "Turn raw diffraction/spectroscopy data into a solved, refined atomic structure — the inverse problem at the heart of characterization.",
    where: "Closes the loop: a solved structure can re-enter databases and discovery.",
    removes: "The gap between 'we measured something' and 'we know the structure'.",
    creates: "Non-uniqueness — multiple structures can fit the same data without care.",
  },
};

const characterize: MapNode = {
  id: "characterize",
  title: "Characterization",
  subtitle: "Measure what you made, learn why",
  kind: "region",
  stage: "characterize",
  level: 0,
  accent: "#f472b6",
  essence: "Measure what you actually made — structure, composition, microstructure — and feed the truth back into discovery.",
  children: [diffraction, spectroscopy, microscopy, insitu, structureSolution],
};

/* ──────────────────────── cross-cutting / hidden ──────────────────────── */

// Kept in the data graph but flagged hidden — not rendered on the map for now.
const scaleUp: MapNode = {
  id: "scale-up",
  title: "Scale-Up / Manufacturing",
  subtitle: "From gram to ton",
  kind: "branch",
  level: 1,
  hidden: true,
  accent: "#94a3b8",
  essence: "Take a working recipe from the lab bench to production.",
  fields: {
    why: "A recipe that works on milligrams rarely survives the jump to kilograms — heat/mass transfer, cost and reproducibility all change.",
    where: "The off-ramp after characterization, toward real-world deployment.",
    removes: "The lab-to-fab valley of death.",
    creates: "Cost, yield and reproducibility constraints that reshape the original chemistry.",
  },
};

export const REGIONS: MapNode[] = [discover, synthesis, characterize];

export const ROOT: MapNode = {
  id: "root",
  title: "Materials Science",
  subtitle: "Discover · Synthesize · Characterize",
  kind: "root",
  accent: "#38bdf8",
  image: "/scenes/overview.png",
  body: "An interactive map of how materials are discovered and made. Pick a region to fly in; the loop closes from characterization back to discovery.",
  children: [discover, synthesis, characterize, scaleUp],
};
