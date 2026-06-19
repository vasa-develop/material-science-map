import { useEffect, useMemo, useRef } from "react";
import type { MapNode, Rect } from "../data/types";

/** An orbital ring for an atom effect (normalized radii over image width). */
interface AtomRing {
  rx: number;
  ry: number;
  rot: number; // radians
  speed: number;
  phase: number;
}
interface AtomFX {
  cx: number; // normalized over image
  cy: number;
  rings: AtomRing[];
}

/** Per-node, per-region animated effects. Keyed by child id. */
const ATOMS: Record<string, AtomFX> = {
  dft: {
    cx: 0.305,
    cy: 0.1,
    rings: [
      { rx: 0.062, ry: 0.023, rot: -0.5, speed: 0.55, phase: 0 },
      { rx: 0.056, ry: 0.02, rot: 0.7, speed: -0.82, phase: 2.1 },
      { rx: 0.05, ry: 0.025, rot: 1.5, speed: 0.95, phase: 4.0 },
    ],
  },
};

interface Region {
  id: string;
  rect: Rect;
  accent: string;
  atom?: AtomFX;
}

function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export default function LivingCanvas({
  node,
  onNavigate,
}: {
  node: MapNode;
  onNavigate: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const regions = useMemo<Region[]>(
    () =>
      (node.children ?? [])
        .filter((c) => c.originInParent)
        .map((c) => ({
          id: c.id,
          rect: c.originInParent!,
          accent: c.accent ?? "#38bdf8",
          atom: ATOMS[c.id],
        })),
    [node.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!node.image) return;
    const img = new Image();
    img.src = node.image;
    img.onload = () => {
      imgRef.current = img;
    };
    return () => {
      imgRef.current = null;
    };
  }, [node.image]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const start = performance.now();

    const cover = (cw: number, ch: number, iw: number, ih: number) => {
      const s = Math.max(cw / iw, ch / ih);
      const dW = iw * s;
      const dH = ih * s;
      return { dx: (cw - dW) / 2, dy: (ch - dH) / 2, dW, dH };
    };

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const img = imgRef.current;
      const t = (performance.now() - start) / 1000;
      const map = img
        ? cover(cw, ch, img.naturalWidth, img.naturalHeight)
        : { dx: 0, dy: 0, dW: cw, dH: ch };
      const mp = (nx: number, ny: number) =>
        [map.dx + nx * map.dW, map.dy + ny * map.dH] as const;

      // 1) hovered region: light up that part of the actual artwork
      const hid = hoverRef.current;
      if (hid && img) {
        const r = regions.find((rr) => rr.id === hid);
        if (r) {
          const [x, y] = mp(r.rect.x, r.rect.y);
          const w = r.rect.w * map.dW;
          const h = r.rect.h * map.dH;
          ctx.save();
          roundRectPath(ctx, x, y, w, h, Math.min(w, h) * 0.18);
          ctx.clip();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.5;
          ctx.drawImage(img, map.dx, map.dy, map.dW, map.dH);
          const cx = x + w / 2;
          const cy = y + h / 2;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.62);
          g.addColorStop(0, hexA(r.accent, 0.42));
          g.addColorStop(1, hexA(r.accent, 0));
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = g;
          ctx.fillRect(x, y, w, h);
          ctx.restore();
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }
      }

      // 2) atom electron orbits
      ctx.globalCompositeOperation = "lighter";
      for (const r of regions) {
        if (!r.atom) continue;
        const [acx, acy] = mp(r.atom.cx, r.atom.cy);
        for (const ring of r.atom.rings) {
          const cos = Math.cos(ring.rot);
          const sin = Math.sin(ring.rot);
          // faint orbit path
          ctx.save();
          ctx.translate(acx, acy);
          ctx.rotate(ring.rot);
          ctx.beginPath();
          ctx.ellipse(0, 0, ring.rx * map.dW, ring.ry * map.dW, 0, 0, Math.PI * 2);
          ctx.strokeStyle = hexA(r.accent, 0.22);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
          // electron with comet trail
          const N = 9;
          for (let k = 0; k < N; k++) {
            const a = ring.phase + t * ring.speed - k * 0.12;
            const ex = Math.cos(a) * ring.rx * map.dW;
            const ey = Math.sin(a) * ring.ry * map.dW;
            const px = acx + ex * cos - ey * sin;
            const py = acy + ex * sin + ey * cos;
            const fade = 1 - k / N;
            const rad = fade * 3.4 + 0.6;
            const g = ctx.createRadialGradient(px, py, 0, px, py, rad * 3);
            g.addColorStop(0, `rgba(200,240,255,${fade * 0.95})`);
            g.addColorStop(0.4, hexA(r.accent, fade * 0.8));
            g.addColorStop(1, hexA(r.accent, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(px, py, rad * 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [regions]);

  const handleMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const img = imgRef.current;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    let nx = fx;
    let ny = fy;
    if (img) {
      const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const dW = img.naturalWidth * s;
      const dH = img.naturalHeight * s;
      const dx = (cw - dW) / 2;
      const dy = (ch - dH) / 2;
      nx = (fx * cw - dx) / dW;
      ny = (fy * ch - dy) / dH;
    }
    const hit = regions.find(
      (r) =>
        nx >= r.rect.x &&
        nx <= r.rect.x + r.rect.w &&
        ny >= r.rect.y &&
        ny <= r.rect.y + r.rect.h
    );
    hoverRef.current = hit?.id ?? null;
    canvas.style.cursor = hit ? "pointer" : "default";
  };

  const handleClick = () => {
    if (hoverRef.current) onNavigate(hoverRef.current);
  };
  const handleLeave = () => {
    hoverRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={handleClick}
    />
  );
}
