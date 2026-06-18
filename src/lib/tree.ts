import type { MapNode } from "../data/types";

export interface IndexedTree {
  byId: Record<string, MapNode>;
  parent: Record<string, string | null>;
}

export function indexTree(root: MapNode): IndexedTree {
  const byId: Record<string, MapNode> = {};
  const parent: Record<string, string | null> = {};
  const walk = (n: MapNode, p: string | null) => {
    byId[n.id] = n;
    parent[n.id] = p;
    n.children?.forEach((c) => walk(c, n.id));
  };
  walk(root, null);
  return { byId, parent };
}

/** Root -> ... -> node chain (inclusive). */
export function pathTo(idx: IndexedTree, id: string): MapNode[] {
  const out: MapNode[] = [];
  let cur: string | null = id;
  while (cur) {
    const node = idx.byId[cur];
    if (!node) break;
    out.unshift(node);
    cur = idx.parent[cur];
  }
  return out;
}
