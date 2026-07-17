/**
 * Per-entity bounded/capped adjacency (BB-092 acceptance criterion 3): typed, time-scoped,
 * evidence-count-ordered, capped top-N per entity. Bounding doc size and forcing editorial
 * ranking by evidence (not volume) is a deliberate design choice — see BB-092's DESIGN note
 * ("Bounded top-N adjacency caps doc sizes and forces editorial ranking by evidence, not
 * volume").
 *
 * Pure and deterministic: given the same relationship set, `buildEntityAdjacency` always returns
 * the same ordering — ties broken by neighbor entity id, then relationship type, then
 * relationship id — so re-running the release build never reshuffles equal-evidence edges.
 */
import { deriveEraBuckets } from '../era.js';
import type { EntityRelationship, RelationshipType, TemporalContext } from '../relationship.js';

/** Default per-entity cap (BB-092: "capped top-N"). */
export const DEFAULT_ADJACENCY_CAP = 25;

export type AdjacencyDirection = 'outgoing' | 'incoming';

export type PublicRelatedEntry = {
  readonly id: string;
  readonly type: RelationshipType;
  readonly direction: AdjacencyDirection;
  readonly timespan?: TemporalContext;
};

export type AdjacencyEntry = PublicRelatedEntry & {
  readonly relationshipId: string;
  /** Count of evidence ids backing this edge — the ranking key. Never a numeric score; this is a
   * plain evidence count, the one numeric field BB-092 acceptance criterion 5 explicitly allows
   * on the public projection. */
  readonly evidenceCount: number;
};

export type EntityAdjacency = {
  readonly entityId: string;
  /** Capped, ordered top-N (evidence-count desc, then neighbor id asc, then type asc, then
   * relationship id asc for full determinism). */
  readonly entries: readonly AdjacencyEntry[];
  /** Count of edges that matched before the cap was applied — read-cost/transparency bound. */
  readonly totalCandidates: number;
};

export type BuildEntityAdjacencyOptions = {
  readonly cap?: number;
  /** When set, restrict to edges whose own TemporalContext overlaps this decade label (e.g.
   * "1960s") — edges with no temporal context are treated as timeless and always included, since
   * an edge without a documented window cannot be excluded from any decade without evidence. */
  readonly decade?: string;
};

function edgeOverlapsDecade(temporal: TemporalContext | undefined, decade: string): boolean {
  if (!temporal?.validFrom) return true;
  const buckets = deriveEraBuckets({
    validFrom: temporal.validFrom,
    ...(temporal.validTo !== undefined ? { validTo: temporal.validTo } : {}),
    datePrecision: 'year',
  });
  return buckets.length === 0 || buckets.includes(decade);
}

function neighborAndDirection(
  entityId: string,
  rel: EntityRelationship,
): { readonly neighborId: string; readonly direction: AdjacencyDirection } | undefined {
  if (rel.fromEntityId === entityId) return { neighborId: rel.toEntityId, direction: 'outgoing' };
  if (rel.toEntityId === entityId) return { neighborId: rel.fromEntityId, direction: 'incoming' };
  return undefined;
}

function compareEntries(a: AdjacencyEntry, b: AdjacencyEntry): number {
  if (a.evidenceCount !== b.evidenceCount) return b.evidenceCount - a.evidenceCount;
  if (a.id !== b.id) return a.id.localeCompare(b.id);
  if (a.type !== b.type) return a.type.localeCompare(b.type);
  return a.relationshipId.localeCompare(b.relationshipId);
}

/**
 * Builds one entity's capped, ordered adjacency list from the full relationship set. Self-loops
 * (`fromEntityId === toEntityId === entityId`) are skipped — they carry no adjacency information.
 */
export function buildEntityAdjacency(
  entityId: string,
  relationships: readonly EntityRelationship[],
  options: BuildEntityAdjacencyOptions = {},
): EntityAdjacency {
  const cap = options.cap ?? DEFAULT_ADJACENCY_CAP;
  const candidates: AdjacencyEntry[] = [];

  for (const rel of relationships) {
    if (rel.fromEntityId === rel.toEntityId) continue;
    const match = neighborAndDirection(entityId, rel);
    if (!match) continue;
    if (options.decade && !edgeOverlapsDecade(rel.temporal, options.decade)) continue;
    candidates.push({
      id: match.neighborId,
      type: rel.type,
      direction: match.direction,
      ...(rel.temporal ? { timespan: rel.temporal } : {}),
      relationshipId: rel.id,
      evidenceCount: rel.evidenceIds.length,
    });
  }

  candidates.sort(compareEntries);

  return {
    entityId,
    entries: candidates.slice(0, cap),
    totalCandidates: candidates.length,
  };
}

/** Builds adjacency for every entity id in `entityIds`, in a deterministic (sorted) map order. */
export function buildAllEntityAdjacency(
  entityIds: readonly string[],
  relationships: readonly EntityRelationship[],
  options: BuildEntityAdjacencyOptions = {},
): ReadonlyMap<string, EntityAdjacency> {
  const sortedIds = [...new Set(entityIds)].sort();
  const result = new Map<string, EntityAdjacency>();
  for (const entityId of sortedIds) {
    result.set(entityId, buildEntityAdjacency(entityId, relationships, options));
  }
  return result;
}

/**
 * Projects a build-internal `EntityAdjacency` down to the public `{id, type, direction,
 * timespan}` shape (BB-092 acceptance criterion 5). Drops `relationshipId` (an internal Firestore
 * document pointer with no public meaning) and `evidenceCount` — evidence counts are explicitly
 * public-safe by policy ("nothing numeric beyond evidence counts appears publicly"), but the
 * public related-entry shape itself is exactly `{id, type, direction, timespan}` per the
 * acceptance criterion text, so evidence count stays an internal ranking key rather than a public
 * field on this particular projection.
 */
export function toPublicRelatedEntries(adjacency: EntityAdjacency): readonly PublicRelatedEntry[] {
  return adjacency.entries.map((entry) => ({
    id: entry.id,
    type: entry.type,
    direction: entry.direction,
    ...(entry.timespan ? { timespan: entry.timespan } : {}),
  }));
}
