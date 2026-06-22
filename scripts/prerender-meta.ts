/**
 * Post-build step: bake per-node <head> metadata into static HTML so that the
 * /n/:id pages get real social-card previews (OG/Twitter) — link scrapers don't
 * run JS, so the runtime meta in the SPA isn't enough for them.
 *
 * For each routable method node we copy dist/index.html and swap the block
 * between the `meta:start` / `meta:end` markers for node-specific tags, writing
 * dist/n/<id>/index.html. Static hosts serve these directly and fall back to the
 * SPA for everything else; the client then hydrates with matching runtime meta.
 *
 * Run via `tsx` after `vite build` (see package.json "build").
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "../src/data/map";
import { indexTree } from "../src/lib/tree";
import { metaEntries, nodePageMeta, type PageMeta } from "../src/lib/seo";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const META_BLOCK = /<!-- meta:start[\s\S]*?-->[\s\S]*?<!-- meta:end -->/;

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function metaBlock(m: PageMeta): string {
  const tags = [
    `<!-- meta:start (prerendered) -->`,
    `<title>${esc(m.title)}</title>`,
    ...metaEntries(m).map((e) => `<meta ${e.attr}="${e.key}" content="${esc(e.content)}" />`),
    `<link rel="canonical" href="${esc(m.url)}" />`,
    `<!-- meta:end -->`,
  ];
  return tags.join("\n    ");
}

const template = readFileSync(join(dist, "index.html"), "utf8");
if (!META_BLOCK.test(template)) {
  throw new Error("prerender-meta: meta:start/meta:end markers not found in dist/index.html");
}

// routable /n/:id ids = the level-1 method children of the three stage regions
const idx = indexTree(ROOT);
const methodIds = (ROOT.children ?? []).flatMap((region) => (region.children ?? []).map((c) => c.id));

let count = 0;
for (const id of methodIds) {
  const node = idx.byId[id];
  if (!node) continue;
  const html = template.replace(META_BLOCK, metaBlock(nodePageMeta(node)));
  const dir = join(dist, "n", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
  count += 1;
}

console.log(`prerender-meta: wrote ${count} node pages → dist/n/<id>/index.html`);
