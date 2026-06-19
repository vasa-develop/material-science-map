import { useEffect, useRef, useState } from "react";
import { Application, Assets, Container, Graphics, Sprite, Texture } from "pixi.js";

/**
 * Pixi entity-scene: a Clash/Factorio-style "living base" for the materials loop.
 *
 * Two layers of motion:
 *  1. Idle motion   — each building animates in place (electrons, fire, robot arm, …).
 *  2. Flow motion   — packets travel the conduits encoding the real discovery→synthesis
 *                     loop: candidate → screened → validated → sample → result → filed.
 *
 * Art is glowing line-art on pure black, composited with additive blending so the
 * black vanishes and only the glow remains.
 */

// ----------------------------------------------------------------------------- config
type Kind =
  | "generative"
  | "hts"
  | "dft"
  | "solidstate"
  | "sdl"
  | "characterization"
  | "databases"
  | "mlip";

interface StationDef {
  id: Kind;
  label: string;
  sprite: string;
  nx: number; // normalized position in the background (0..1)
  ny: number;
  wFrac: number; // target width as a fraction of background width
  accent: number;
}

const STATIONS: StationDef[] = [
  { id: "generative", label: "Generative Models", sprite: "pixi_generative.png", nx: 0.15, ny: 0.66, wFrac: 0.1, accent: 0xc084fc },
  { id: "hts", label: "High-Throughput Screening", sprite: "hts_funnel.png", nx: 0.18, ny: 0.4, wFrac: 0.12, accent: 0xa3e635 },
  { id: "dft", label: "First-Principles / DFT", sprite: "dft_dome.png", nx: 0.34, ny: 0.26, wFrac: 0.15, accent: 0x38bdf8 },
  { id: "solidstate", label: "Solid-State Synthesis", sprite: "pixi_solidstate.png", nx: 0.66, ny: 0.26, wFrac: 0.15, accent: 0xffae4d },
  { id: "sdl", label: "Self-Driving Lab", sprite: "pixi_sdl.png", nx: 0.83, ny: 0.45, wFrac: 0.18, accent: 0x22d3ee },
  { id: "characterization", label: "Characterization", sprite: "pixi_characterization.png", nx: 0.71, ny: 0.69, wFrac: 0.14, accent: 0x34d399 },
  { id: "databases", label: "Databases", sprite: "pixi_databases.png", nx: 0.46, ny: 0.78, wFrac: 0.16, accent: 0x60a5fa },
  { id: "mlip", label: "ML Interatomic Potentials", sprite: "pixi_mlip.png", nx: 0.31, ny: 0.52, wFrac: 0.12, accent: 0xf472b6 },
];

// Main pipeline order (the closed loop). Packets spawn at generative and retire at databases;
// the databases→generative segment + the mlip branch carry "feedback" pulses instead.
const LOOP: Kind[] = ["generative", "hts", "dft", "solidstate", "sdl", "characterization", "databases"];

// Colour of a packet while it travels the segment that STARTS at LOOP[i].
const SEG_COLOR: number[] = [
  0x7dd3fc, // 0 generative→hts   : candidate
  0x7dd3fc, // 1 hts→dft          : screened
  0xeaf6ff, // 2 dft→solidstate   : validated (bright)
  0xffb259, // 3 solidstate→sdl   : sample
  0xffb259, // 4 sdl→char         : sample
  0x6ee7a0, // 5 char→databases   : result
];

// ----------------------------------------------------------------------------- entities
class Entity {
  container: Container;
  sprite: Sprite;
  halo: Graphics;
  fx: Graphics;
  hovered = false;
  haloAlpha = 0;
  pulseT = 0;

  constructor(
    public id: string,
    public label: string,
    texture: Texture,
    x: number,
    y: number,
    worldWidth: number,
    public accent: number,
    public onSelect: (id: string) => void
  ) {
    this.container = new Container();
    this.container.position.set(x, y);

    this.halo = new Graphics();
    this.container.addChild(this.halo);

    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(worldWidth / texture.width);
    this.sprite.blendMode = "add";
    this.container.addChild(this.sprite);

    this.fx = new Graphics();
    this.fx.blendMode = "add";
    this.container.addChild(this.fx);

    this.container.eventMode = "static";
    this.container.cursor = "pointer";
    const w = this.sprite.width * 0.62;
    const h = this.sprite.height * 0.62;
    this.container.hitArea = {
      contains: (px: number, py: number) => Math.abs(px) < w / 2 && Math.abs(py) < h / 2,
    };
    this.container.on("pointerover", () => (this.hovered = true));
    this.container.on("pointerout", () => (this.hovered = false));
    this.container.on("pointertap", () => this.onSelect(this.id));
  }

  /** flash when a packet arrives */
  pulse() {
    this.pulseT = 1;
  }

  // overridden per entity
  animate(_t: number, _dt: number) {}

  update(t: number, dt: number) {
    const target = this.hovered ? 1 : 0;
    this.haloAlpha += (target - this.haloAlpha) * Math.min(1, dt * 0.18);
    this.pulseT *= Math.pow(0.93, dt);

    this.sprite.tint = 0xffffff;
    this.sprite.alpha = 0.86 + this.haloAlpha * 0.14 + this.pulseT * 0.18;

    const r = this.sprite.width * 0.5;
    const glow = Math.max(this.haloAlpha, this.pulseT * 0.85);
    this.halo.clear();
    if (glow > 0.01) {
      for (let i = 3; i >= 1; i--) {
        this.halo
          .circle(0, this.sprite.height * 0.05, r * (0.55 + i * 0.2))
          .fill({ color: this.accent, alpha: glow * 0.05 });
      }
    }
    this.animate(t, dt);
  }
}

interface Ring {
  rx: number;
  ry: number;
  rot: number;
  speed: number;
  phase: number;
}

class DftEntity extends Entity {
  rings: Ring[] = [
    { rx: 70, ry: 26, rot: -0.5, speed: 0.055, phase: 0 },
    { rx: 62, ry: 22, rot: 0.7, speed: -0.08, phase: 2.1 },
    { rx: 56, ry: 28, rot: 1.5, speed: 0.095, phase: 4.0 },
  ];
  atomY = 0;

  constructor(...args: ConstructorParameters<typeof Entity>) {
    super(...args);
    this.atomY = -this.sprite.height * 0.34;
  }

  animate(t: number) {
    const g = this.fx;
    g.clear();
    const ay = this.atomY;
    for (const ring of this.rings) {
      const cos = Math.cos(ring.rot);
      const sin = Math.sin(ring.rot);
      const N = 9;
      for (let k = 0; k < N; k++) {
        const a = ring.phase + t * ring.speed - k * 0.12;
        const ex = Math.cos(a) * ring.rx;
        const ey = Math.sin(a) * ring.ry;
        const px = ex * cos - ey * sin;
        const py = ay + ex * sin + ey * cos;
        const fade = 1 - k / N;
        g.circle(px, py, fade * 4 + 1).fill({
          color: k === 0 ? 0xddf4ff : this.accent,
          alpha: fade * 0.85,
        });
      }
    }
  }
}

interface Drop {
  x: number;
  y: number;
  vy: number;
}

class HtsEntity extends Entity {
  items: Drop[] = [];
  spawnT = 0;
  mouthY = 0;
  bottomY = 0;

  constructor(...args: ConstructorParameters<typeof Entity>) {
    super(...args);
    this.mouthY = -this.sprite.height * 0.42;
    this.bottomY = this.sprite.height * 0.12;
  }

  animate(_t: number, dt: number) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 16 + Math.random() * 10;
      this.items.push({
        x: (Math.random() - 0.5) * this.sprite.width * 0.34,
        y: this.mouthY - 50,
        vy: 1.4 + Math.random() * 0.8,
      });
    }
    const g = this.fx;
    g.clear();
    for (const it of this.items) {
      it.y += it.vy * dt;
      it.x *= 1 - 0.012 * dt;
      const glow = it.y > this.mouthY ? 0.9 : 0.5;
      g.rect(it.x - 3, it.y - 3, 6, 6).fill({ color: this.accent, alpha: glow });
      g.rect(it.x - 6, it.y - 6, 12, 12).fill({ color: this.accent, alpha: glow * 0.25 });
    }
    this.items = this.items.filter((it) => it.y < this.bottomY);
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

class GenerativeEntity extends Entity {
  parts: Particle[] = [];
  spawnT = 0;
  tipY = 0;

  constructor(...args: ConstructorParameters<typeof Entity>) {
    super(...args);
    this.tipY = -this.sprite.height * 0.32;
  }

  animate(_t: number, dt: number) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 18 + Math.random() * 14;
      this.parts.push({
        x: (Math.random() - 0.5) * this.sprite.width * 0.14,
        y: this.tipY,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.5 - Math.random() * 0.5,
        life: 1,
      });
    }
    const g = this.fx;
    g.clear();
    for (const p of this.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= 0.012 * dt;
      const a = Math.max(0, p.life);
      g.circle(p.x, p.y, 2.5).fill({ color: this.accent, alpha: a });
      g.circle(p.x, p.y, 5).fill({ color: this.accent, alpha: a * 0.2 });
    }
    this.parts = this.parts.filter((p) => p.life > 0);
  }
}

class FurnaceEntity extends Entity {
  embers: Particle[] = [];
  spawnT = 0;
  cx = 0;
  cy = 0;

  constructor(...args: ConstructorParameters<typeof Entity>) {
    super(...args);
    this.cx = -this.sprite.width * 0.12;
    this.cy = this.sprite.height * 0.12;
  }

  animate(t: number, dt: number) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 3 + Math.random() * 4;
      this.embers.push({
        x: this.cx + (Math.random() - 0.5) * this.sprite.width * 0.08,
        y: this.cy,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -0.4 - Math.random() * 0.5,
        life: 1,
      });
    }
    const g = this.fx;
    g.clear();
    const flicker = 0.6 + 0.25 * Math.sin(t * 0.6) + 0.15 * Math.sin(t * 1.7 + 1);
    g.circle(this.cx, this.cy, this.sprite.width * 0.07 * (0.85 + 0.15 * Math.random())).fill({
      color: 0xffae4d,
      alpha: 0.28 * flicker,
    });
    for (const e of this.embers) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.life -= 0.02 * dt;
      g.circle(e.x, e.y, 1.6).fill({ color: 0xffd089, alpha: Math.max(0, e.life) });
    }
    this.embers = this.embers.filter((e) => e.life > 0);
  }
}

interface DiffRing {
  r: number;
  life: number;
}

class CharEntity extends Entity {
  rings: DiffRing[] = [];
  spawnT = 0;
  cx = 0;
  cy = 0;

  constructor(...args: ConstructorParameters<typeof Entity>) {
    super(...args);
    this.cx = this.sprite.width * 0.08;
    this.cy = 0;
  }

  animate(t: number, dt: number) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 45 + Math.random() * 30;
      this.rings.push({ r: 4, life: 1 });
    }
    const g = this.fx;
    g.clear();
    const beam = 0.5 + 0.5 * Math.sin(t * 0.4);
    g.moveTo(this.cx - this.sprite.width * 0.2, this.cy)
      .lineTo(this.cx, this.cy)
      .stroke({ color: this.accent, width: 2, alpha: 0.5 * beam });
    for (const r of this.rings) {
      r.r += 0.6 * dt;
      r.life -= 0.012 * dt;
      g.circle(this.cx, this.cy, r.r).stroke({
        color: this.accent,
        width: 1.5,
        alpha: Math.max(0, r.life) * 0.7,
      });
    }
    this.rings = this.rings.filter((r) => r.life > 0);
  }
}

class SdlEntity extends Entity {
  baseX = 0;
  baseY = 0;

  constructor(...args: ConstructorParameters<typeof Entity>) {
    super(...args);
    this.baseX = -this.sprite.width * 0.02;
    this.baseY = -this.sprite.height * 0.04;
  }

  animate(t: number) {
    const g = this.fx;
    g.clear();
    const a = Math.sin(t * 0.05) * 0.7 - 0.3;
    const a2 = Math.sin(t * 0.05 + 1.2) * 0.6;
    const l1 = this.sprite.width * 0.1;
    const l2 = this.sprite.width * 0.08;
    const x1 = this.baseX + Math.cos(a) * l1;
    const y1 = this.baseY + Math.sin(a) * l1;
    const x2 = x1 + Math.cos(a + a2) * l2;
    const y2 = y1 + Math.sin(a + a2) * l2;
    g.moveTo(this.baseX, this.baseY)
      .lineTo(x1, y1)
      .lineTo(x2, y2)
      .stroke({ color: this.accent, width: 2.5, alpha: 0.85 });
    g.circle(x2, y2, 3).fill({ color: 0xffffff, alpha: 0.9 });

    const ccx = -this.sprite.width * 0.18;
    const ccy = this.sprite.height * 0.04;
    const cr = this.sprite.width * 0.06;
    for (let i = 0; i < 6; i++) {
      const ang = t * 0.03 + (i * Math.PI) / 3;
      g.circle(ccx + Math.cos(ang) * cr, ccy + Math.sin(ang) * cr * 0.5, 2).fill({
        color: this.accent,
        alpha: 0.7,
      });
    }
  }
}

interface Node2 {
  x: number;
  y: number;
}

class MlipEntity extends Entity {
  nodes: Node2[] = [];
  sparkT = 0;
  spark: { a: Node2; b: Node2; t: number } | null = null;

  constructor(...args: ConstructorParameters<typeof Entity>) {
    super(...args);
    const w = this.sprite.width;
    const h = this.sprite.height;
    this.nodes = [
      { x: 0, y: -h * 0.2 },
      { x: -w * 0.16, y: -h * 0.02 },
      { x: w * 0.16, y: -h * 0.02 },
      { x: -w * 0.09, y: h * 0.12 },
      { x: w * 0.09, y: h * 0.12 },
      { x: 0, y: 0 },
    ];
  }

  animate(t: number, dt: number) {
    const g = this.fx;
    g.clear();
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.08 + i);
      g.circle(n.x, n.y, 3).fill({ color: this.accent, alpha: 0.35 + 0.45 * pulse });
    }
    this.sparkT -= dt;
    if (this.sparkT <= 0) {
      this.sparkT = 9 + Math.random() * 10;
      const a = this.nodes[Math.floor(Math.random() * this.nodes.length)];
      const b = this.nodes[Math.floor(Math.random() * this.nodes.length)];
      if (a !== b) this.spark = { a, b, t: 0 };
    }
    if (this.spark) {
      const s = this.spark;
      s.t += 0.06 * dt;
      const x = s.a.x + (s.b.x - s.a.x) * s.t;
      const y = s.a.y + (s.b.y - s.a.y) * s.t;
      g.moveTo(s.a.x, s.a.y).lineTo(x, y).stroke({ color: this.accent, width: 1, alpha: 0.4 });
      g.circle(x, y, 2.5).fill({ color: 0xffffff, alpha: 0.9 });
      if (s.t >= 1) this.spark = null;
    }
  }
}

interface Led {
  x: number;
  y: number;
  ph: number;
  sp: number;
}

class DatabasesEntity extends Entity {
  leds: Led[] = [];

  constructor(...args: ConstructorParameters<typeof Entity>) {
    super(...args);
    const w = this.sprite.width;
    const h = this.sprite.height;
    for (let i = 0; i < 16; i++) {
      this.leds.push({
        x: (Math.random() - 0.5) * w * 0.52,
        y: (Math.random() - 0.3) * h * 0.32 + h * 0.05,
        ph: Math.random() * Math.PI * 2,
        sp: 0.05 + Math.random() * 0.12,
      });
    }
  }

  animate(t: number) {
    const g = this.fx;
    g.clear();
    for (const l of this.leds) {
      const a = 0.3 + 0.7 * Math.max(0, Math.sin(t * l.sp + l.ph));
      g.rect(l.x - 1.5, l.y - 1.5, 3, 3).fill({ color: this.accent, alpha: a });
    }
  }
}

const CLASS_BY_KIND: Record<Kind, new (...a: ConstructorParameters<typeof Entity>) => Entity> = {
  dft: DftEntity,
  hts: HtsEntity,
  generative: GenerativeEntity,
  solidstate: FurnaceEntity,
  characterization: CharEntity,
  sdl: SdlEntity,
  mlip: MlipEntity,
  databases: DatabasesEntity,
};

// ----------------------------------------------------------------------------- flow types
interface Pt {
  x: number;
  y: number;
}

interface Packet {
  seg: number; // current loop segment index (start station = LOOP[seg])
  t: number; // 0..1 progress along segment
  color: number;
  dropped: boolean;
  alpha: number;
  vy: number; // drift when dropped
  done: boolean;
}

interface Feedback {
  t: number; // 0..(branch segments)
}

const LABELS: Record<string, string> = Object.fromEntries(STATIONS.map((s) => [s.id, s.label]));

export default function PixiStage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const resetRef = useRef<() => void>(() => {});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let destroyed = false;
    let ready = false;
    let app: Application | null = null;

    const safeDestroy = (a: Application) => {
      try {
        a.canvas?.parentNode?.removeChild(a.canvas);
      } catch {
        /* noop */
      }
      try {
        a.destroy(true, { children: true, texture: false });
      } catch {
        /* pixi resize-plugin teardown can throw on partial init; ignore */
      }
    };

    (async () => {
      app = new Application();
      await app.init({
        width: host.clientWidth || window.innerWidth,
        height: host.clientHeight || window.innerHeight,
        backgroundColor: 0x05060c,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (destroyed) return safeDestroy(app);

      const bgTex: Texture = await Assets.load("/scenes/pixi/background.png");
      const texById: Record<string, Texture> = {};
      await Promise.all(
        STATIONS.map(async (s) => {
          texById[s.id] = await Assets.load(`/scenes/pixi/${s.sprite}`);
        })
      );
      if (destroyed) return safeDestroy(app);
      host.appendChild(app.canvas);

      const world = new Container();
      app.stage.addChild(world);

      const bg = new Sprite(bgTex);
      world.addChild(bg);
      const bgW = bg.width;
      const bgH = bg.height;

      // conduits drawn under buildings; flow packets drawn above
      const conduit = new Graphics();
      conduit.blendMode = "add";
      world.addChild(conduit);

      const entities: Entity[] = [];
      const byId: Record<string, Entity> = {};
      for (const s of STATIONS) {
        const Cls = CLASS_BY_KIND[s.id];
        const e = new Cls(
          s.id,
          s.label,
          texById[s.id],
          bgW * s.nx,
          bgH * s.ny,
          bgW * s.wFrac,
          s.accent,
          (id) => setSelected(id)
        );
        entities.push(e);
        byId[s.id] = e;
        world.addChild(e.container);
      }

      const flow = new Graphics();
      flow.blendMode = "add";
      world.addChild(flow);

      // ---- loop geometry ----
      const loopPts: Pt[] = LOOP.map((id) => ({ x: byId[id].container.x, y: byId[id].container.y }));
      const N = loopPts.length; // 7
      const segLen: number[] = [];
      for (let i = 0; i < N; i++) {
        const a = loopPts[i];
        const b = loopPts[(i + 1) % N];
        segLen.push(Math.hypot(b.x - a.x, b.y - a.y));
      }
      // feedback branch: databases → mlip → generative
      const branchPts: Pt[] = [
        { x: byId.databases.container.x, y: byId.databases.container.y },
        { x: byId.mlip.container.x, y: byId.mlip.container.y },
        { x: byId.generative.container.x, y: byId.generative.container.y },
      ];
      const branchLen = [
        Math.hypot(branchPts[1].x - branchPts[0].x, branchPts[1].y - branchPts[0].y),
        Math.hypot(branchPts[2].x - branchPts[1].x, branchPts[2].y - branchPts[1].y),
      ];

      // ---- flow state ----
      const packets: Packet[] = [];
      const feedbacks: Feedback[] = [];
      let spawnT = 30;
      const PACKET_SPEED = 1.4; // world px / tick

      const stepPackets = (dt: number) => {
        spawnT -= dt;
        if (spawnT <= 0 && packets.length < 40) {
          spawnT = 36 + Math.random() * 36;
          packets.push({ seg: 0, t: 0, color: SEG_COLOR[0], dropped: false, alpha: 1, vy: 0, done: false });
        }
        for (const p of packets) {
          if (p.done) continue;
          if (p.dropped) {
            p.vy += 0.02 * dt;
            p.alpha -= 0.02 * dt;
            if (p.alpha <= 0) p.done = true;
            continue;
          }
          p.t += (PACKET_SPEED * dt) / Math.max(1, segLen[p.seg]);
          if (p.t >= 1) {
            p.t -= 1;
            const arrived = (p.seg + 1) % N;
            p.seg = arrived;
            byId[LOOP[arrived]].pulse();
            if (LOOP[arrived] === "databases") {
              p.done = true;
              byId.databases.pulse();
              feedbacks.push({ t: 0 });
            } else {
              if (LOOP[arrived] === "hts" && Math.random() < 0.4) {
                p.dropped = true;
              } else {
                p.color = SEG_COLOR[arrived];
              }
            }
          }
        }
        // recycle finished packets
        for (let i = packets.length - 1; i >= 0; i--) if (packets[i].done) packets.splice(i, 1);

        // feedback pulses along the branch
        for (const f of feedbacks) {
          const segIdx = Math.min(1, Math.floor(f.t));
          f.t += (PACKET_SPEED * dt) / Math.max(1, branchLen[segIdx]);
          if (f.t >= 1 && f.t < 1 + 0.02) byId.mlip.pulse();
        }
        for (let i = feedbacks.length - 1; i >= 0; i--) {
          if (feedbacks[i].t >= 2) {
            byId.generative.pulse();
            feedbacks.splice(i, 1);
          }
        }
      };

      const drawConduits = (t: number) => {
        conduit.clear();
        // main loop (incl. closing databases→generative segment)
        for (let i = 0; i < N; i++) {
          const a = loopPts[i];
          const b = loopPts[(i + 1) % N];
          conduit.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0x2b3a5c, width: 3, alpha: 0.55 });
          // ambient energy travelling the wire
          for (let k = 0; k < 2; k++) {
            const tt = ((t * 0.004 + i * 0.31 + k * 0.5) % 1 + 1) % 1;
            conduit
              .circle(a.x + (b.x - a.x) * tt, a.y + (b.y - a.y) * tt, 2)
              .fill({ color: 0x3b82f6, alpha: 0.5 });
          }
        }
        // feedback branch
        for (let i = 0; i < 2; i++) {
          const a = branchPts[i];
          const b = branchPts[i + 1];
          conduit
            .moveTo(a.x, a.y)
            .lineTo(b.x, b.y)
            .stroke({ color: 0x4a2b52, width: 2, alpha: 0.45 });
        }
      };

      const drawFlow = () => {
        flow.clear();
        for (const p of packets) {
          let x: number;
          let y: number;
          const a = loopPts[p.seg];
          const b = loopPts[(p.seg + 1) % N];
          x = a.x + (b.x - a.x) * p.t;
          y = a.y + (b.y - a.y) * p.t + (p.dropped ? p.vy * 20 : 0);
          const al = p.alpha;
          flow.circle(x, y, 7).fill({ color: p.color, alpha: 0.18 * al });
          flow.circle(x, y, 3.4).fill({ color: p.color, alpha: 0.95 * al });
          flow.circle(x, y, 1.4).fill({ color: 0xffffff, alpha: 0.9 * al });
        }
        for (const f of feedbacks) {
          const segIdx = Math.min(1, Math.floor(f.t));
          const tt = f.t - segIdx;
          const a = branchPts[segIdx];
          const b = branchPts[segIdx + 1];
          const x = a.x + (b.x - a.x) * tt;
          const y = a.y + (b.y - a.y) * tt;
          flow.circle(x, y, 5).fill({ color: 0xf472b6, alpha: 0.2 });
          flow.circle(x, y, 2.4).fill({ color: 0xfbcfe8, alpha: 0.9 });
        }
      };

      // ---- camera ----
      const cam = { x: 0, y: 0, scale: 1, targetScale: 1, tx: 0, ty: 0, animating: false };
      const baseScale = () => Math.max(app!.screen.width / bgW, app!.screen.height / bgH);
      const applyCam = () => {
        world.scale.set(cam.scale);
        world.position.set(cam.x, cam.y);
      };
      const fit = () => {
        const s = baseScale();
        cam.scale = cam.targetScale = s;
        cam.x = cam.tx = (app!.screen.width - bgW * s) / 2;
        cam.y = cam.ty = (app!.screen.height - bgH * s) / 2;
        applyCam();
      };
      const focusOn = (e: Entity) => {
        const s = baseScale() * 2.4;
        cam.targetScale = s;
        cam.tx = app!.screen.width / 2 - e.container.x * s;
        cam.ty = app!.screen.height / 2 - e.container.y * s;
        cam.animating = true;
      };
      const resetCam = () => {
        cam.targetScale = baseScale();
        cam.tx = (app!.screen.width - bgW * cam.targetScale) / 2;
        cam.ty = (app!.screen.height - bgH * cam.targetScale) / 2;
        cam.animating = true;
        setSelected(null);
      };
      resetRef.current = resetCam;
      fit();

      const onWheel = (ev: WheelEvent) => {
        ev.preventDefault();
        const rect = app!.canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;
        const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
        const ns = Math.min(10, Math.max(0.2, cam.scale * factor));
        cam.x = mx - ((mx - cam.x) * ns) / cam.scale;
        cam.y = my - ((my - cam.y) * ns) / cam.scale;
        cam.scale = cam.targetScale = ns;
        cam.tx = cam.x;
        cam.ty = cam.y;
        cam.animating = false;
        applyCam();
      };
      app.canvas.addEventListener("wheel", onWheel, { passive: false });

      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const down = (e: PointerEvent) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        cam.animating = false;
      };
      const move = (e: PointerEvent) => {
        if (!dragging) return;
        cam.x += e.clientX - lastX;
        cam.y += e.clientY - lastY;
        cam.tx = cam.x;
        cam.ty = cam.y;
        lastX = e.clientX;
        lastY = e.clientY;
        applyCam();
      };
      const up = () => (dragging = false);
      app.canvas.addEventListener("pointerdown", down);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);

      entities.forEach((e) => e.container.on("pointertap", () => focusOn(e)));

      // ---- ticker ----
      let t = 0;
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime;
        t += dt;
        if (cam.animating) {
          cam.scale += (cam.targetScale - cam.scale) * Math.min(1, dt * 0.12);
          cam.x += (cam.tx - cam.x) * Math.min(1, dt * 0.12);
          cam.y += (cam.ty - cam.y) * Math.min(1, dt * 0.12);
          applyCam();
          if (Math.abs(cam.scale - cam.targetScale) < 0.001) cam.animating = false;
        }
        stepPackets(dt);
        drawConduits(t);
        drawFlow();
        entities.forEach((e) => e.update(t, dt));
      });

      const onResize = () => {
        if (!app) return;
        app.renderer.resize(host.clientWidth, host.clientHeight);
        fit();
      };
      window.addEventListener("resize", onResize);

      (app as Application & { _cleanup?: () => void })._cleanup = () => {
        app!.canvas.removeEventListener("wheel", onWheel);
        app!.canvas.removeEventListener("pointerdown", down);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("resize", onResize);
      };

      ready = true;
    })();

    return () => {
      destroyed = true;
      if (app && ready) {
        (app as Application & { _cleanup?: () => void })._cleanup?.();
        safeDestroy(app);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#05060c]">
      <div ref={hostRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-0 p-5">
        <div className="pointer-events-auto inline-block rounded-full border border-white/10 bg-[rgba(5,8,16,0.7)] px-4 py-1.5 text-sm text-slate-300 backdrop-blur-md">
          Materials loop · scroll to zoom · drag to pan · click a structure
        </div>

        {/* flow legend */}
        <div className="pointer-events-none absolute bottom-5 right-5 rounded-xl border border-white/10 bg-[rgba(5,8,16,0.7)] px-4 py-3 text-[11px] text-slate-300 backdrop-blur-md">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-500">the loop</div>
          {[
            ["#7dd3fc", "candidate"],
            ["#eaf6ff", "validated"],
            ["#ffb259", "sample"],
            ["#6ee7a0", "result"],
            ["#f472b6", "feedback → learn"],
          ].map(([c, l]) => (
            <div key={l} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
              <span>{l}</span>
            </div>
          ))}
        </div>

        {selected && (
          <div className="pointer-events-auto absolute bottom-5 left-1/2 -translate-x-1/2 rounded-xl border border-sky-400/40 bg-[rgba(5,8,16,0.8)] px-5 py-3 text-center backdrop-blur-md">
            <div className="text-[10px] uppercase tracking-[0.22em] text-sky-400">selected</div>
            <div className="text-lg font-semibold text-white">{LABELS[selected] ?? selected}</div>
            <button
              onClick={() => resetRef.current()}
              className="mt-1 text-xs text-slate-400 underline transition hover:text-sky-300"
            >
              ← back out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
