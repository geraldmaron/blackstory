/**
 * The record room's connection tree: the shape of the web, decided once, on the server.
 *
 * This replaces `relationship-map-layout.ts`, which placed every record as absolute pixels on a
 * time axis. That geometry had two failures a reader could see. Records that share a year share a
 * column, so a record with four connections spent a 860x500 canvas to show two boxes and a great
 * deal of empty grid; and every box was a fixed 44px tall, so a two-line relation phrase was
 * clipped mid-descender. It also had to name its rows, and the only vocabulary it had for them was
 * "1 hop / 2 hops / 3 hops" — graph theory, printed on a public history archive.
 *
 * What is here instead is a tree of the same graph. No pixels: the component renders nested lists
 * and the browser does the layout, so text wraps instead of clipping and nothing can overlap
 * anything. Distance from the record is carried by indentation and the line drawn into each card,
 * not by a labelled lane, so the word "hop" never has to appear.
 *
 *   Dunbar High School
 *   └── taught here ── Anna Cooper (1900)
 *   └── stands in ──── Fifteenth Street Presbyterian Church (1890)
 *       └── succeeded by ── Dunbar Alumni Federation (1970)
 *
 * Two facts the flat list could never carry survive into this shape:
 *
 * - **The chain.** A record two steps out is drawn under the record it was reached through, so
 *   "what is this doing here" is answered by where it sits, not by hovering it.
 * - **The loops.** A tree cannot draw an edge between two branches without crossing wires over
 *   the words. Those edges become a line of text on the deeper of the two records ("also connects
 *   to Anna Cooper"), which says the same thing and cannot collide with anything.
 *
 * Pure and deterministic: this runs during server rendering, so the same graph must produce the
 * same tree every time.
 */

export type RelationshipTreeNodeInput = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly hop: number;
  readonly relationType: string;
  readonly direction: 'outgoing' | 'incoming';
  readonly viaId?: string;
  // `| undefined` matches how the domain graph spells this optional under
  // `exactOptionalPropertyTypes`, so a `RelationshipGraph` is accepted here without a cast.
  readonly viaEvent?: { readonly id: string; readonly displayName: string } | undefined;
  readonly year?: number;
};

export type RelationshipTreeLinkInput = {
  readonly source: string;
  readonly target: string;
  readonly relationType: string;
  readonly spine: boolean;
};

export type RelationshipTreeGraphInput = {
  readonly centerId: string;
  readonly centerYear?: number;
  readonly nodes: readonly RelationshipTreeNodeInput[];
  readonly links: readonly RelationshipTreeLinkInput[];
};

export type RelationshipTreeNode = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  /** Steps from the record. Kept for styling weight and for the accessible name, never printed. */
  readonly depth: number;
  readonly relationType: string;
  readonly direction: 'outgoing' | 'incoming';
  readonly viaEventName?: string;
  /** The record this one hangs under, absent on the branches that hang off the record itself. */
  readonly viaName?: string;
  readonly year?: number;
  /** Names of records elsewhere in the tree this one also connects to. Loops, said in words. */
  readonly alsoConnects: readonly string[];
  /** Everything below this node, at any depth. Drives the "show 4 more" summary. */
  readonly descendantCount: number;
  readonly children: readonly RelationshipTreeNode[];
};

export type RelationshipTree = {
  readonly centerId: string;
  readonly centerLabel: string;
  readonly centerYear?: number;
  readonly branches: readonly RelationshipTreeNode[];
  /** Every record on the tree, not counting the record itself. */
  readonly total: number;
  readonly deepest: number;
};

/** Deeper records sort after shallower ones; within a level, earliest first, then by name. */
function compare(a: RelationshipTreeNodeInput, b: RelationshipTreeNodeInput): number {
  const aYear = a.year ?? Number.POSITIVE_INFINITY;
  const bYear = b.year ?? Number.POSITIVE_INFINITY;
  if (aYear !== bYear) return aYear - bYear;
  const byName = a.displayName.localeCompare(b.displayName);
  return byName !== 0 ? byName : a.id.localeCompare(b.id);
}

/**
 * Attach every record to the record it was first reached through.
 *
 * `viaId` is the graph builder's answer to that, but it can point at a record that was capped out
 * of the payload. Those fall back to hanging off the centre rather than vanishing: a record with
 * a connection the archive knows about should appear, even when the link that found it did not
 * survive the fetch budget.
 */
export function buildRelationshipTree(
  graph: RelationshipTreeGraphInput,
  centerLabel: string,
): RelationshipTree {
  const present = new Map(graph.nodes.map((node) => [node.id, node]));
  const nameOf = (id: string): string | undefined =>
    id === graph.centerId ? centerLabel : present.get(id)?.displayName;

  const parentOf = new Map<string, string>();
  for (const node of graph.nodes) {
    const via = node.viaId;
    const parent = via !== undefined && via !== node.id && present.has(via) ? via : graph.centerId;
    parentOf.set(node.id, parent);
  }

  // A cycle in `viaId` would hang the walk below. Any node whose ancestry does not reach the
  // centre within the graph's own depth is re-parented onto it.
  for (const node of graph.nodes) {
    let cursor = parentOf.get(node.id);
    let guard = 0;
    while (cursor !== undefined && cursor !== graph.centerId && guard <= graph.nodes.length) {
      cursor = parentOf.get(cursor);
      guard += 1;
    }
    if (cursor !== graph.centerId) parentOf.set(node.id, graph.centerId);
  }

  const childrenOf = new Map<string, RelationshipTreeNodeInput[]>();
  for (const node of graph.nodes) {
    const parent = parentOf.get(node.id) ?? graph.centerId;
    const bucket = childrenOf.get(parent);
    if (bucket) bucket.push(node);
    else childrenOf.set(parent, [node]);
  }
  for (const bucket of childrenOf.values()) bucket.sort(compare);

  // Loops, resolved to the deeper end so each is stated once. Spine edges are already drawn as
  // the tree itself; only the edges the tree cannot draw become text.
  const loops = new Map<string, string[]>();
  const depthOf = (id: string): number => present.get(id)?.hop ?? 0;
  for (const link of graph.links) {
    if (link.spine) continue;
    if (!present.has(link.source) || !present.has(link.target)) continue;
    if (parentOf.get(link.source) === link.target || parentOf.get(link.target) === link.source) {
      continue;
    }
    const sourceDeeper =
      depthOf(link.source) > depthOf(link.target) ||
      (depthOf(link.source) === depthOf(link.target) && link.source > link.target);
    const holder = sourceDeeper ? link.source : link.target;
    const other = sourceDeeper ? link.target : link.source;
    const otherName = nameOf(other);
    if (otherName === undefined) continue;
    const bucket = loops.get(holder);
    if (bucket) {
      if (!bucket.includes(otherName)) bucket.push(otherName);
    } else loops.set(holder, [otherName]);
  }
  for (const bucket of loops.values()) bucket.sort((a, b) => a.localeCompare(b));

  let total = 0;
  let deepest = 0;

  const build = (id: string, depth: number): readonly RelationshipTreeNode[] =>
    (childrenOf.get(id) ?? []).map((node) => {
      total += 1;
      deepest = Math.max(deepest, depth);
      const children = build(node.id, depth + 1);
      const parent = parentOf.get(node.id) ?? graph.centerId;
      const viaName = parent === graph.centerId ? undefined : nameOf(parent);
      return {
        id: node.id,
        displayName: node.displayName,
        kind: node.kind,
        depth,
        relationType: node.relationType,
        direction: node.direction,
        ...(node.viaEvent !== undefined ? { viaEventName: node.viaEvent.displayName } : {}),
        ...(viaName !== undefined ? { viaName } : {}),
        ...(node.year !== undefined ? { year: node.year } : {}),
        alsoConnects: loops.get(node.id) ?? [],
        descendantCount: children.reduce((sum, child) => sum + 1 + child.descendantCount, 0),
        children,
      };
    });

  const branches = build(graph.centerId, 1);

  return {
    centerId: graph.centerId,
    centerLabel,
    ...(graph.centerYear !== undefined ? { centerYear: graph.centerYear } : {}),
    branches,
    total,
    deepest,
  };
}
