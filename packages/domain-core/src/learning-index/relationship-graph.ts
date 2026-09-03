/**
 * Path-preserving relationship graph for the record room's relationship map.
 *
 * `composeContinueLearningStubs` (index.ts) flattens the second hop into a bare list and throws
 * the path away: a reader is told "also connected: Dunbar Alumni Federation" with no way to know
 * it was reached *through* the school. That is fine for a list of onward links and useless for a
 * map, so this builder keeps three things the flat composer discards:
 *
 * - `viaId`, the node an entry was first reached through, which is what makes a spine drawable;
 * - cross-links, the edges between two already-discovered records, which are what make the result
 *   a web instead of a tree (a tree has to draw a shared record twice, once per branch, and that
 *   duplication is exactly the redundancy the map exists to remove);
 * - `year`, a single sortable number per node, so hops can be laid out along a time axis instead
 *   of in arbitrary catalog order.
 *
 * Determinism is a hard requirement, not a nicety: this runs on the server and the markup has to
 * match on the client, so every hop is sorted by (year, displayName, id) before it is emitted and
 * no iteration order from a caller's map is allowed to leak into the output.
 */
import type { AdjacencyDirection } from '../graph/adjacency.js';
import type { LearningRelatedEdge, NeighborLookup } from './index.js';

/** Hops walked outward from the center record. Three is the display contract. */
export const RELATIONSHIP_GRAPH_MAX_HOPS = 3;

/**
 * Per-hop node caps, indexed by `hop - 1`.
 *
 * Wider as it goes out and then truncated hard: the far ring is where a dense record explodes,
 * and a map with sixty third-hop nodes is a hairball, not a story.
 */
export const RELATIONSHIP_GRAPH_HOP_CAPS: readonly number[] = [8, 10, 12];

export type RelationshipGraphNode = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly summary: string;
  /** 1, 2 or 3 — distance from the center record. */
  readonly hop: number;
  readonly relationType: string;
  readonly direction: AdjacencyDirection;
  /** The node this one was first reached through. Absent at hop 1 (reached from the center). */
  readonly viaId?: string;
  readonly viaEvent?: LearningRelatedEdge['viaEvent'];
  readonly timespan?: LearningRelatedEdge['timespan'];
  /** Sortable year for the time axis. Absent means undated — never guess one. */
  readonly year?: number;
};

export type RelationshipGraphLink = {
  readonly source: string;
  readonly target: string;
  readonly relationType: string;
  /** True for the edge that first reached `target`; false for a loop-closing cross-link. */
  readonly spine: boolean;
};

export type RelationshipGraph = {
  readonly centerId: string;
  readonly centerYear?: number;
  readonly nodes: readonly RelationshipGraphNode[];
  readonly links: readonly RelationshipGraphLink[];
};

/** Neighbor lookup plus the era hint the map's time axis needs. */
export type RelationshipGraphLookup = NeighborLookup & {
  readonly eraBuckets?: readonly string[];
};

const YEAR_IN_TEXT = /\b(1[5-9]\d{2}|20\d{2})\b/;
const DECADE_BUCKET = /^(1[5-9]\d{2}|20\d{2})s$/;

/**
 * One year for a node, preferring the edge's own timespan over the record's era.
 *
 * An edge timespan is a statement about *this connection* ("served here 1892–1901"), so it dates
 * the relationship better than the record's era buckets, which date the record. Era buckets are
 * the fallback, and the earliest bucket is used so a record spanning 1870s–1910s enters the map
 * where its story starts rather than where it ends.
 */
export function resolveRelationshipYear(
  timespan: LearningRelatedEdge['timespan'],
  eraBuckets: readonly string[] | undefined,
): number | undefined {
  const from = timespan?.validFrom?.trim();
  if (from !== undefined && from.length > 0) {
    const match = YEAR_IN_TEXT.exec(from);
    if (match) return Number(match[1]);
  }
  const label = timespan?.label?.trim();
  if (label !== undefined && label.length > 0) {
    const match = YEAR_IN_TEXT.exec(label);
    if (match) return Number(match[1]);
  }
  let earliest: number | undefined;
  for (const bucket of eraBuckets ?? []) {
    const match = DECADE_BUCKET.exec(bucket.trim());
    if (!match) continue;
    const year = Number(match[1]);
    if (earliest === undefined || year < earliest) earliest = year;
  }
  return earliest;
}

/** Undated nodes sort last within their hop, then alphabetically, then by id. Stable everywhere. */
function compareNodes(a: RelationshipGraphNode, b: RelationshipGraphNode): number {
  const aYear = a.year ?? Number.POSITIVE_INFINITY;
  const bYear = b.year ?? Number.POSITIVE_INFINITY;
  if (aYear !== bYear) return aYear - bYear;
  const byName = a.displayName.localeCompare(b.displayName);
  if (byName !== 0) return byName;
  return a.id.localeCompare(b.id);
}

/** Undirected: A–B and B–A are one line on the map, drawn once. */
function linkKey(source: string, target: string, relationType: string): string {
  return source < target
    ? `${source} ${target} ${relationType}`
    : `${target} ${source} ${relationType}`;
}

/**
 * Walk up to `maxHops` outward from `centerId`, breadth-first, keeping each node's path.
 *
 * Only ids present in `lookup` become nodes: an edge pointing at a record the caller did not
 * fetch is dropped rather than drawn as a nameless dot. Callers bound the fetch (see the web
 * app's `collectOneHopNeighborIds` / `collectTwoHopNeighborIds` / `collectThreeHopNeighborIds`),
 * so the natural effect is that the outermost ring is whatever that budget actually paid for.
 */
export function buildRelationshipGraph(
  centerId: string,
  lookup: ReadonlyMap<string, RelationshipGraphLookup>,
  options: {
    readonly maxHops?: number;
    readonly hopCaps?: readonly number[];
  } = {},
): RelationshipGraph {
  const maxHops = Math.min(options.maxHops ?? RELATIONSHIP_GRAPH_MAX_HOPS, 6);
  const hopCaps = options.hopCaps ?? RELATIONSHIP_GRAPH_HOP_CAPS;

  const center = lookup.get(centerId);
  const centerYear = resolveRelationshipYear(undefined, center?.eraBuckets);

  const nodes: RelationshipGraphNode[] = [];
  const nodeIds = new Set<string>([centerId]);
  const spineKeys = new Set<string>();
  const spine: RelationshipGraphLink[] = [];

  let frontier: readonly string[] = [centerId];

  for (let hop = 1; hop <= maxHops && frontier.length > 0; hop += 1) {
    const cap = hopCaps[hop - 1] ?? 0;
    if (cap <= 0) break;

    const discovered: RelationshipGraphNode[] = [];
    const claimed = new Set<string>();

    for (const parentId of frontier) {
      for (const edge of lookup.get(parentId)?.related ?? []) {
        if (nodeIds.has(edge.id) || claimed.has(edge.id)) continue;
        const target = lookup.get(edge.id);
        if (!target) continue;
        claimed.add(edge.id);
        const year = resolveRelationshipYear(edge.timespan, target.eraBuckets);
        discovered.push({
          id: target.id,
          displayName: target.displayName,
          kind: target.kind,
          summary: target.summary,
          hop,
          relationType: edge.type,
          direction: edge.direction,
          // Omitted when the parent is the center, so a consumer can test "reached straight from
          // the record" without having to know the center's id.
          ...(parentId === centerId ? {} : { viaId: parentId }),
          ...(edge.viaEvent !== undefined ? { viaEvent: edge.viaEvent } : {}),
          ...(edge.timespan !== undefined ? { timespan: edge.timespan } : {}),
          ...(year !== undefined ? { year } : {}),
        });
        const key = linkKey(parentId, edge.id, edge.type);
        if (!spineKeys.has(key)) {
          spineKeys.add(key);
          spine.push({ source: parentId, target: edge.id, relationType: edge.type, spine: true });
        }
      }
    }

    discovered.sort(compareNodes);
    const kept = discovered.slice(0, cap);
    for (const node of kept) {
      nodes.push(node);
      nodeIds.add(node.id);
    }
    frontier = kept.map((node) => node.id);
  }

  // A spine link whose target lost the per-hop cap would dangle. Drop it.
  const keptSpine = spine.filter((link) => nodeIds.has(link.source) && nodeIds.has(link.target));
  const seen = new Set(
    keptSpine.map((link) => linkKey(link.source, link.target, link.relationType)),
  );

  // Cross-links: edges between two records that both made the map. These close the loops and stop
  // a shared record from being drawn once per branch.
  const cross: RelationshipGraphLink[] = [];
  for (const sourceId of [centerId, ...nodes.map((node) => node.id)]) {
    for (const edge of lookup.get(sourceId)?.related ?? []) {
      if (!nodeIds.has(edge.id) || edge.id === sourceId) continue;
      const key = linkKey(sourceId, edge.id, edge.type);
      if (seen.has(key)) continue;
      seen.add(key);
      cross.push({ source: sourceId, target: edge.id, relationType: edge.type, spine: false });
    }
  }

  return {
    centerId,
    ...(centerYear !== undefined ? { centerYear } : {}),
    nodes,
    links: [...keptSpine, ...cross],
  };
}
