# Materials Map — Content Architecture & Design

_Draft v0.1 — 2026-06-19. This is the "what do we want to show" map, decoupled from implementation._

## 1. Purpose & audience

- **Primary:** a portfolio artifact — a beautiful, explorable "living map" of how materials get
  discovered and made, that doubles as a companion to the primer articles.
- **Secondary:** a personal sense-making tool — to see the field's structure, the bottleneck
  chain, and where the interesting unsolved problems are.
- **Audience:** smart but non-expert viewer (recruiters, peers, founders) who can optionally drill
  from a 10,000-ft story down to a concrete concept or a real artifact (code/plot).

## 2. Backbone: one world, read three ways

The field is **one closed loop**, not two separate maps. We render it as a single isometric
"living city" and offer three ways to read the SAME world:

- **A — World (default).** The spatial loop you fly around. Discovery district (left) →
  Synthesis district (right) → data → back. Buildings = top-level nodes; conduits = hand-offs;
  packets flow the loop (candidate → validated → sample → result → data).
- **C — Bottleneck Trail (lens).** Dim the city; light one path through it; the
  "new bottleneck it creates" of each node becomes the **label on its outgoing edge**
  (compute cost → out-of-distribution → synthesizability gap → dark data…). A guided walk of the
  "every solution births the next problem" story.
- **D — History (lens).** Re-lay the same structures along an era timeline with a scrubber:
  experimental → computational (DFT) → high-throughput → generative/ML → autonomous SDL.

**Phasing:** World + recursion (drill-down) is Phase 1. The two lenses are Phase 2 (they reuse the
same node data, so they're additive, not a rewrite).

## 3. Scope

**Technical pipeline + a thin ring of context.** The methods/capabilities loop is central and deep;
a small set of peripheral "context" districts frame it. We deliberately exclude People / Funding /
Market / Institutions as first-class districts (keeps the science depth; avoids diluting into a
generic "innovation ecosystem" map). Revisit if the portfolio framing wants the business angle.

## 4. Node schema & recursion grammar

Every node — at every depth — has the **same shape**, so authoring and UX are consistent:

```
Node {
  id
  title
  essence        // one-line "what this is"
  schema {       // the 4-part bottleneck schema (your reference maps' soul)
    whyItExists
    whereItFits
    bottleneckRemoved
    bottleneckCreated   // <- becomes the outgoing-edge label in the Bottleneck Trail lens
  }
  body?          // optional longer explainer (markdown)
  era?           // for the History lens: experimental | computational | high-throughput | generative | autonomous
  children?      // drill deeper  (branch node)
  artifact?      // OR a terminal payload (leaf node)
}
```

**What is a leaf?** A node terminates when it is either:

1. an **atomic concept** that doesn't usefully subdivide (e.g. "the DFT band-gap problem"), or
2. an **artifact** — a concrete deliverable that makes the idea real:
   - a worked code snippet / notebook,
   - a generated plot or interactive widget (e.g. a tiny live convergence plot),
   - a short annotated example.

Artifacts are where the portfolio shows _doing_, not just _explaining_. Not every leaf needs one;
they're sprinkled where they add the most punch.

## 5. Top-level map (the loop)

**Discovery district**

1. **Databases & Foundations** — Materials Project, ICSD, OQMD, NOMAD. The substrate everything
   trains/validates on.
2. **First-Principles / DFT** — properties from quantum mechanics, no experiments needed.
3. **Atomistic & Classical Simulations** — MD & Monte Carlo; dynamics, temperature, phases.
4. **ML Interatomic Potentials (MLIPs)** — learn the physics, run orders of magnitude faster.
5. **High-Throughput Screening (HTS)** — filter millions of candidates down to a shortlist.
6. **Generative AI & Foundation Models** — de novo / inverse design of new candidates.

**↳ bridge: the synthesizability gap** (a promising structure ≠ something we can actually make)

**Synthesis district**

7. **Predictive Synthesis** — recipe mining (NLP over literature) + kinetic/thermo modeling to
   propose _how_ to make it.
8. **Bulk & Precision Methods** — solid-state "shake & bake" + sol-gel / hydrothermal / CVD-ALD.
9. **High-Throughput Experimentation (HTE) & Combinatorial** — make & test many at once.
10. **Autonomous Self-Driving Labs (SDLs)** — closed-loop robotics + active learning; the
    integrator that ties the whole loop together.
11. **Characterization** — XRD and friends; turn a physical sample back into data.

**↳ data flows back to (1) Databases — loop closes; the field "learns."**

**Peripheral context ring (thin):** Enabling Foundations (Physics/Chem/CS) · Synthesis Parameters
(Temp/Pressure/Atmosphere) · Production Scales (bench → pilot → industrial) · Literature & Dark Data
(incl. unpublished failures) · The Future (sustainable, quantum, beyond-earth, human+machine).

**Cross-links (the "loosely connected" threads):** Kinetics · Thermodynamics · DFT validation ·
NLP recipe suggestion · robotic batch processing · autonomous closed-loop optimization.

## 6. Worked recursion example — "First-Principles / DFT"

- **DFT** (essence: "compute material properties from quantum mechanics")
  - **Exchange–Correlation Functionals** → LDA · GGA (PBE) · meta-GGA (SCAN) · hybrids (HSE)
    - leaf: "Why no functional is exact" (+ artifact: tiny bar chart of band-gap error by functional)
  - **Basis Sets & Plane Waves**
  - **Pseudopotentials & PAW**
  - **K-point Sampling / Brillouin Zone** (+ artifact: live convergence plot vs. k-mesh)
  - **SCF Convergence**
  - **Properties & Observables** → formation energy · band structure · phonons · elastic constants
  - **Codes** → VASP · Quantum ESPRESSO · ABINIT
  - **Limitations** → band-gap problem · strong correlation · O(N³) scaling
    - this "scaling" leaf's `bottleneckCreated` is the edge that points to **MLIPs**

Every other top-level node expands the same way (3–8 children, recursing 1–3 levels).

## 7. Lenses (Phase 2)

- **Bottleneck Trail:** precompute the chain by following each node's `bottleneckCreated` →
  the node it motivates. Render as a highlighted path with edge labels + a step counter.
- **History:** sort nodes by `era`; lay along a timeline; scrubber reveals them in sequence.

## 8. Phasing

- **Phase 1:** World view (the loop city) + full recursion + the 4-part schema panels. Author the
  Discovery district content first (it's where your primers are deepest), then Synthesis.
- **Phase 2:** Bottleneck Trail lens, History lens, sprinkled interactive artifacts.

## 9. Open questions

- Split #8 into two buildings (Bulk vs Precision) or keep as one with two children? (currently: one)
- How many artifacts in v1, and which 2–3 are highest-impact to build first?
- Do we keep the "11 numbered steps" framing from `mock_world`, or drop numbers (a loop has no
  true start)?
