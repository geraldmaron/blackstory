/**
 * Pure helpers for duplicate hub merges (absorbed entity → survivor ledger).
 * DB I/O lives in merge-duplicate-hubs.ts.
 */
import { createHash } from 'node:crypto';

export type HubMergePair = {
  readonly absorbedId: string;
  readonly survivorId: string;
  readonly reason: string;
};

/** WS4 hub dedup pairs verified live before merge. */
export const DEFAULT_HUB_MERGE_PAIRS: readonly HubMergePair[] = [
  {
    absorbedId: 'ent_sncc_001',
    survivorId: 'ent_sncc_org_001',
    reason: 'Duplicate SNCC organization hub; survivor is canonical org record.',
  },
  {
    absorbedId: 'ent_sclc_001',
    survivorId: 'ent_sclc_org_001',
    reason: 'Duplicate SCLC organization hub; survivor is canonical org record.',
  },
];

export type AbsorbedToSurvivorMap = ReadonlyMap<string, string>;

export function buildAbsorbedToSurvivorMap(
  pairs: readonly HubMergePair[],
): AbsorbedToSurvivorMap {
  return new Map(pairs.map((pair) => [pair.absorbedId, pair.survivorId]));
}

export function remapEntityId(entityId: string, map: AbsorbedToSurvivorMap): string {
  return map.get(entityId) ?? entityId;
}

export function mergeLedgerId(absorbedId: string): string {
  const digest = createHash('sha256').update(`hub-merge|${absorbedId}`).digest('hex');
  return `merge_hub_${digest.slice(0, 16)}`;
}

export type RelationshipEndpointRow = {
  readonly id: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly relationshipType: string;
};

export type RewrittenRelationshipRow = RelationshipEndpointRow & {
  readonly rewrittenFrom: boolean;
  readonly rewrittenTo: boolean;
};

/** Rewrite absorbed ids on relationship endpoints (pure preview). */
export function rewriteRelationshipEndpoints(
  rows: readonly RelationshipEndpointRow[],
  map: AbsorbedToSurvivorMap,
): readonly RewrittenRelationshipRow[] {
  return rows.map((row) => {
    const fromEntityId = remapEntityId(row.fromEntityId, map);
    const toEntityId = remapEntityId(row.toEntityId, map);
    return {
      ...row,
      fromEntityId,
      toEntityId,
      rewrittenFrom: fromEntityId !== row.fromEntityId,
      rewrittenTo: toEntityId !== row.toEntityId,
    };
  });
}

export type RelationshipRewritePlan = {
  readonly keep: readonly RewrittenRelationshipRow[];
  readonly dropSelfLoop: readonly RewrittenRelationshipRow[];
  readonly dropDuplicate: readonly RewrittenRelationshipRow[];
};

function relationshipDedupKey(row: Pick<RewrittenRelationshipRow, 'fromEntityId' | 'toEntityId' | 'relationshipType'>): string {
  return `${row.fromEntityId}|${row.toEntityId}|${row.relationshipType}`;
}

/**
 * After endpoint rewrite, drop self-loops and duplicate (from,to,type) edges (keep lowest id).
 */
export function planRelationshipRewrites(
  rows: readonly RelationshipEndpointRow[],
  map: AbsorbedToSurvivorMap,
): RelationshipRewritePlan {
  const rewritten = rewriteRelationshipEndpoints(rows, map);
  const dropSelfLoop: RewrittenRelationshipRow[] = [];
  const survivors: RewrittenRelationshipRow[] = [];

  for (const row of rewritten) {
    if (row.fromEntityId === row.toEntityId) {
      dropSelfLoop.push(row);
    } else {
      survivors.push(row);
    }
  }

  const byKey = new Map<string, RewrittenRelationshipRow>();
  const dropDuplicate: RewrittenRelationshipRow[] = [];

  for (const row of [...survivors].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = relationshipDedupKey(row);
    const existing = byKey.get(key);
    if (existing) {
      dropDuplicate.push(row);
    } else {
      byKey.set(key, row);
    }
  }

  return {
    keep: [...byKey.values()].sort((a, b) => a.id.localeCompare(b.id)),
    dropSelfLoop,
    dropDuplicate,
  };
}

export type MergeStatePayload = {
  readonly status: 'absorbed';
  readonly survivorId: string;
  readonly mergeId: string;
  readonly absorbedAt: string;
  readonly reason: string;
};

export function buildMergeStatePayload(
  pair: HubMergePair,
  mergeId: string,
  absorbedAt: string,
): MergeStatePayload {
  return {
    status: 'absorbed',
    survivorId: pair.survivorId,
    mergeId,
    absorbedAt,
    reason: pair.reason,
  };
}

export type EntityDegreeSnapshot = {
  readonly entityId: string;
  readonly degree: number;
};

export function formatDegreeSnapshot(label: string, rows: readonly EntityDegreeSnapshot[]): string {
  const parts = rows.map((row) => `${row.entityId}=${row.degree}`).join(', ');
  return `${label}: ${parts}`;
}
