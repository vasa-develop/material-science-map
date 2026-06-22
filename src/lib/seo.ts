import type { MapNode } from "../data/types";

/**
 * Single source of truth for page metadata (titles, descriptions, OG / Twitter
 * cards). Pure + import-safe in both the browser (runtime `applyMeta`) and Node
 * (the build-time prerender script), so the static `/n/:id` HTML and the live
 * SPA always agree.
 */

export const SITE_URL = "https://materials.vasa.bio";
export const SITE_NAME = "Materials Science Map";
export const DEFAULT_TITLE = "Materials Discovery & Synthesis — Interactive Map";
export const DEFAULT_DESCRIPTION =
  "An interactive map of how new materials get made — explore the Discovery → Synthesis → Characterization loop, method by method.";
export const OG_IMAGE = `${SITE_URL}/og.png`;

export interface PageMeta {
  title: string;
  description: string;
  url: string;
  image: string;
}

const clamp = (s: string, n = 200): string => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

export function defaultMeta(): PageMeta {
  return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, url: `${SITE_URL}/`, image: OG_IMAGE };
}

/** Meta for a method/stage node's standalone page (/n/:id). */
export function nodePageMeta(node: MapNode): PageMeta {
  return {
    title: `${node.title} · ${SITE_NAME}`,
    description: clamp(node.essence || node.fields?.why || DEFAULT_DESCRIPTION),
    url: `${SITE_URL}/n/${node.id}`,
    image: OG_IMAGE,
  };
}

/** Meta for the map while a stage (L1) is focused — shared via the ?stage= link. */
export function stageStateMeta(node: MapNode): PageMeta {
  return {
    title: `${node.title} · ${SITE_NAME}`,
    description: clamp(node.essence || DEFAULT_DESCRIPTION),
    url: `${SITE_URL}/?stage=${node.id}`,
    image: OG_IMAGE,
  };
}

/** The og/twitter tag set for a page, as attribute/key/content triples. */
export function metaEntries(m: PageMeta): { attr: "name" | "property"; key: string; content: string }[] {
  return [
    { attr: "name", key: "description", content: m.description },
    { attr: "property", key: "og:type", content: "website" },
    { attr: "property", key: "og:site_name", content: SITE_NAME },
    { attr: "property", key: "og:title", content: m.title },
    { attr: "property", key: "og:description", content: m.description },
    { attr: "property", key: "og:url", content: m.url },
    { attr: "property", key: "og:image", content: m.image },
    { attr: "name", key: "twitter:card", content: "summary_large_image" },
    { attr: "name", key: "twitter:title", content: m.title },
    { attr: "name", key: "twitter:description", content: m.description },
    { attr: "name", key: "twitter:image", content: m.image },
  ];
}

/** Runtime: reflect a page's meta into <head> (browser only). */
export function applyMeta(m: PageMeta): void {
  if (typeof document === "undefined") return;
  document.title = m.title;
  for (const e of metaEntries(m)) {
    const sel = `meta[${e.attr}="${e.key}"]`;
    let el = document.head.querySelector<HTMLMetaElement>(sel);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(e.attr, e.key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", e.content);
  }
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", m.url);
}
