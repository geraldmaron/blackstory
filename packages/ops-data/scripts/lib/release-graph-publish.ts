/**
 * Publish-time graph build + persist to bb_public.release_graph_* from canonical
 * relationships and release entity projections.
 */
import type pg from 'pg';
import {
  auditGraphReleaseArtifact,
  buildGraphReleaseArtifact,
  deriveGraphDecadeBucketInput,
  serializeGraphAdjacency,
  serializeGraphAllTimeView,
  serializeGraphDecadeView,
  extractCatalogRelationships,
  type DecadeBucketEntityInput,
  type EntityRelationship,
  type GraphPublishAuditReport,
  type GraphReleaseArtifact,
  type RelationshipType,
} from '@repo/domain';
import { decadeStartYearFromLabel } from '@repo/domain/era';
import type { StatusHistoryEntry } from '@repo/domain';

export type ReleaseGraphEntityRow = {
  readonly entity_id: string;
  readonly kind: string;
  readonly projection: unknown;
};

export type CanonicalGraphEntityRow = {
  readonly id: string;
  readonly kind: string;
  readonly status_history: unknown;
  readonly kind_detail: unknown;
  readonly valid_from_edtf: string | null;
  readonly valid_to_edtf: string | null;
};

export type CanonicalRelationshipRow = {
  readonly id: string;
  readonly from_entity_id: string;
  readonly to_entity_id: string;
  readonly relationship_type: string;
  readonly valid_from: string | null;
  readonly valid_to: string | null;
  readonly valid_from_edtf: string | null;
  readonly valid_to_edtf: string | null;
  readonly evidence_ids: readonly string[];
};

export const RELEASE_ENTITIES_SQL = `
SELECT entity_id, kind, projection
FROM bb_public.release_entities
WHERE release_id = $1
ORDER BY entity_id
`;

export const CANONICAL_ENTITIES_FOR_GRAPH_SQL = `
SELECT
  e.id,
  e.kind,
  e.status_history,
  e.kind_detail,
  el.valid_from_edtf,
  el.valid_to_edtf
FROM bb_canonical.entities e
LEFT JOIN LATERAL (
  SELECT valid_from_edtf, valid_to_edtf
  FROM bb_canonical.entity_locations
  WHERE entity_id = e.id
  ORDER BY CASE role WHEN 'historical' THEN 0 WHEN 'current' THEN 1 ELSE 2 END, id
  LIMIT 1
) el ON true
WHERE e.id = ANY($1::text[])
`;

export const CANONICAL_RELATIONSHIPS_SQL = `
SELECT
  r.id,
  r.from_entity_id,
  r.to_entity_id,
  r.relationship_type,
  r.valid_from::text AS valid_from,
  r.valid_to::text AS valid_to,
  r.valid_from_edtf,
  r.valid_to_edtf,
  COALESCE(
    array_agg(ere.evidence_id ORDER BY ere.evidence_id)
      FILTER (WHERE ere.evidence_id IS NOT NULL),
    '{}'::text[]
  ) AS evidence_ids
FROM bb_canonical.entity_relationships r
LEFT JOIN bb_canonical.entity_relationship_evidence ere
  ON ere.relationship_id = r.id
WHERE r.publication_status IS DISTINCT FROM 'retracted'
  AND (r.workflow_status IS NULL OR r.workflow_status IN ('accepted'))
  AND (r.from_entity_id = ANY($1::text[]) OR r.to_entity_id = ANY($1::text[]))
GROUP BY r.id
ORDER BY r.id
`;

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function asStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function parseStatusHistory(value: unknown): readonly StatusHistoryEntry<string>[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries: StatusHistoryEntry<string>[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record || typeof record.status !== 'string') continue;
    entries.push({
      status: record.status,
      ...(typeof record.validFrom === 'string' ? { validFrom: record.validFrom } : {}),
      ...(record.validTo !== undefined ? { validTo: record.validTo as string | null } : {}),
      datePrecision:
        typeof record.datePrecision === 'string'
          ? (record.datePrecision as StatusHistoryEntry<string>['datePrecision'])
          : 'year',
      basisClaimIds: asStringArray(record.basisClaimIds),
    });
  }
  return entries.length > 0 ? entries : undefined;
}

function temporalFromRelationship(row: CanonicalRelationshipRow): EntityRelationship['temporal'] {
  const validFrom = row.valid_from_edtf ?? row.valid_from ?? undefined;
  const validTo = row.valid_to_edtf ?? row.valid_to ?? undefined;
  if (!validFrom && !validTo) return undefined;
  return {
    ...(validFrom ? { validFrom } : {}),
    ...(validTo ? { validTo } : {}),
    datePrecision: 'year',
  };
}

function relatedFromProjection(
  projection: Readonly<Record<string, unknown>>,
): readonly { id: string; type: string; direction: 'outgoing' | 'incoming' }[] {
  const related = projection.related;
  if (!Array.isArray(related)) return [];
  return related.filter(
    (entry): entry is { id: string; type: string; direction: 'outgoing' | 'incoming' } =>
      !!entry &&
      typeof entry === 'object' &&
      typeof (entry as Record<string, unknown>).id === 'string' &&
      typeof (entry as Record<string, unknown>).type === 'string' &&
      ((entry as Record<string, unknown>).direction === 'outgoing' ||
        (entry as Record<string, unknown>).direction === 'incoming'),
  );
}

function relationshipsFromReleaseProjections(
  releaseRows: readonly ReleaseGraphEntityRow[],
  generatedAt: string,
): readonly EntityRelationship[] {
  const entities = releaseRows.map((row) => {
    const projection = asRecord(row.projection) ?? {};
    return {
      id: row.entity_id,
      related: relatedFromProjection(projection),
    };
  });
  return extractCatalogRelationships(entities, { generatedAt }).relationships;
}

function mergeRelationships(
  canonical: readonly EntityRelationship[],
  fromProjections: readonly EntityRelationship[],
): readonly EntityRelationship[] {
  const byId = new Map<string, EntityRelationship>();
  for (const rel of [...canonical, ...fromProjections]) {
    byId.set(rel.id, rel);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function mapCanonicalRelationshipRow(row: CanonicalRelationshipRow): EntityRelationship {
  const now = new Date().toISOString();
  return {
    id: row.id,
    fromEntityId: row.from_entity_id,
    toEntityId: row.to_entity_id,
    type: row.relationship_type as RelationshipType,
    evidenceIds: [...row.evidence_ids],
    ...(temporalFromRelationship(row) ? { temporal: temporalFromRelationship(row) } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function buildDecadeEntitiesForGraph(input: {
  readonly releaseRows: readonly ReleaseGraphEntityRow[];
  readonly canonicalById: ReadonlyMap<string, CanonicalGraphEntityRow>;
}): readonly DecadeBucketEntityInput[] {
  const decadeEntities: DecadeBucketEntityInput[] = [];
  for (const row of input.releaseRows) {
    const projection = asRecord(row.projection) ?? {};
    const canonical = input.canonicalById.get(row.entity_id);
    const bucketInput = deriveGraphDecadeBucketInput({
      entityId: row.entity_id,
      kind: row.kind,
      eraBuckets: asStringArray(projection.eraBuckets),
      statusHistory:
        parseStatusHistory(projection.statusHistory) ??
        parseStatusHistory(canonical?.status_history),
      kindDetail: asRecord(canonical?.kind_detail),
      locationValidFromEdtf: canonical?.valid_from_edtf,
      locationValidToEdtf: canonical?.valid_to_edtf,
      ...(typeof projection.eventWindow === 'object' && projection.eventWindow
        ? {
            eventWindow: {
              ...(typeof (projection.eventWindow as Record<string, unknown>).startAt === 'string'
                ? { startAt: (projection.eventWindow as Record<string, unknown>).startAt as string }
                : {}),
              ...(typeof (projection.eventWindow as Record<string, unknown>).endAt === 'string'
                ? { endAt: (projection.eventWindow as Record<string, unknown>).endAt as string }
                : {}),
            },
          }
        : {}),
    });
    if (bucketInput) decadeEntities.push(bucketInput);
  }
  return decadeEntities;
}

export type BuildReleaseGraphResult = {
  readonly artifact: GraphReleaseArtifact;
  readonly audit: GraphPublishAuditReport;
  readonly relationships: readonly EntityRelationship[];
};

export function buildReleaseGraphArtifact(input: {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly releaseRows: readonly ReleaseGraphEntityRow[];
  readonly canonicalById: ReadonlyMap<string, CanonicalGraphEntityRow>;
  readonly relationshipRows: readonly CanonicalRelationshipRow[];
  readonly adjacencyCap?: number;
}): BuildReleaseGraphResult {
  const entityIds = input.releaseRows.map((row) => row.entity_id);
  const decadeEntities = buildDecadeEntitiesForGraph({
    releaseRows: input.releaseRows,
    canonicalById: input.canonicalById,
  });
  // Published canonical edges are graph-eligible even when the evidence junction
  // table is sparse — audit logs still surface edge retention vs input set.
  const canonicalRelationships = input.relationshipRows.map(mapCanonicalRelationshipRow);
  const projectionRelationships = relationshipsFromReleaseProjections(
    input.releaseRows,
    input.generatedAt,
  );
  const relationships = mergeRelationships(canonicalRelationships, projectionRelationships);

  const artifact = buildGraphReleaseArtifact({
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    entityIds,
    entities: decadeEntities,
    relationships,
    ...(input.adjacencyCap !== undefined ? { adjacencyCap: input.adjacencyCap } : {}),
  });

  const audit = auditGraphReleaseArtifact({
    artifact,
    relationships,
    releaseEntityIds: entityIds,
    decadeEntities,
    ...(input.adjacencyCap !== undefined ? { adjacencyCap: input.adjacencyCap } : {}),
  });

  return { artifact, audit, relationships };
}

export async function loadReleaseGraphInputs(
  client: pg.PoolClient,
  releaseId: string,
): Promise<{
  readonly releaseRows: ReleaseGraphEntityRow[];
  readonly canonicalById: Map<string, CanonicalGraphEntityRow>;
  readonly relationshipRows: CanonicalRelationshipRow[];
}> {
  const releaseRes = await client.query<ReleaseGraphEntityRow>(RELEASE_ENTITIES_SQL, [releaseId]);
  const entityIds = releaseRes.rows.map((row) => row.entity_id);
  const canonicalRes = await client.query<CanonicalGraphEntityRow>(
    CANONICAL_ENTITIES_FOR_GRAPH_SQL,
    [entityIds],
  );
  const canonicalById = new Map(canonicalRes.rows.map((row) => [row.id, row]));
  const relationshipRes = await client.query<CanonicalRelationshipRow>(
    CANONICAL_RELATIONSHIPS_SQL,
    [entityIds],
  );
  return {
    releaseRows: releaseRes.rows,
    canonicalById,
    relationshipRows: relationshipRes.rows,
  };
}

/**
 * repo-zocd — the delete+reinsert used to run as bare auto-committed statements with no
 * surrounding transaction. Observed twice (2026-08-07, 2026-08-17) leaving the active release's
 * graph tables empty or partially populated for the whole run: readers see a catalog with no
 * relationships, and a mid-run failure (a slow remote round trip timing out, or two overlapping
 * runs racing on the same primary key) leaves permanently broken partial state rather than either
 * the old graph or the new one. BEGIN/COMMIT here means a reader always sees a complete graph —
 * the prior one until this transaction commits, the new one after — and any failure rolls back to
 * the prior state instead of leaving a partial one. This alone removes the outage; batching the
 * INSERTs (still one row per statement below) is a separate, non-correctness follow-up.
 */
export async function persistReleaseGraphArtifact(
  client: pg.PoolClient,
  releaseId: string,
  artifact: GraphReleaseArtifact,
): Promise<{ readonly adjacencyRows: number; readonly decadeRows: number }> {
  await client.query('BEGIN');
  try {
    await client.query(`DELETE FROM bb_public.release_graph_adjacency WHERE release_id = $1`, [
      releaseId,
    ]);
    await client.query(`DELETE FROM bb_public.release_graph_decades WHERE release_id = $1`, [
      releaseId,
    ]);
    await client.query(`DELETE FROM bb_public.release_graph_all_time WHERE release_id = $1`, [
      releaseId,
    ]);

    for (const [, adjacency] of artifact.adjacencyByEntityId) {
      await client.query(
        `INSERT INTO bb_public.release_graph_adjacency (release_id, entity_id, adjacency)
         VALUES ($1, $2, $3::jsonb)`,
        [releaseId, adjacency.entityId, JSON.stringify(serializeGraphAdjacency(adjacency))],
      );
    }

    for (const view of artifact.decadeViews) {
      const decadeInt = decadeStartYearFromLabel(view.decade);
      if (decadeInt === undefined) continue;
      await client.query(
        `INSERT INTO bb_public.release_graph_decades (release_id, decade, payload)
         VALUES ($1, $2, $3::jsonb)`,
        [releaseId, decadeInt, JSON.stringify(serializeGraphDecadeView(view))],
      );
    }

    await client.query(
      `INSERT INTO bb_public.release_graph_all_time (release_id, payload)
       VALUES ($1, $2::jsonb)`,
      [
        releaseId,
        JSON.stringify(serializeGraphAllTimeView(artifact.allTimeView, artifact.contentHash)),
      ],
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  return {
    adjacencyRows: artifact.adjacencyByEntityId.size,
    decadeRows: artifact.decadeViews.length,
  };
}

export function formatReleaseGraphAuditLog(audit: GraphPublishAuditReport): readonly string[] {
  const lines = [
    `Graph content hash: ${audit.contentHash}`,
    `Canonical edges: ${audit.canonicalEdgeCount}`,
    `All-time edges: ${audit.allTimeEdgeCount}`,
    `Unique decade edges: ${audit.uniqueDecadeEdgeCount}`,
    `Decade coverage: ${audit.decadeCoveragePct.toFixed(1)}% (${audit.entitiesWithDecadeBuckets}/${audit.entitiesInRelease})`,
    `Endpoint-not-in-release drops: ${audit.droppedFromAllTime.length}`,
    `Unexplained all-time drops: ${audit.unexplainedAllTimeDrops}`,
  ];
  if (audit.adjacencyCapHits.length > 0) {
    lines.push(`Adjacency cap hits: ${audit.adjacencyCapHits.length}`);
    for (const hit of audit.adjacencyCapHits.slice(0, 5)) {
      lines.push(
        `  ${hit.entityId}: ${hit.totalCandidates} candidates, cap ${hit.cap}, truncated ${hit.truncated}`,
      );
    }
  }
  return lines;
}

/**
 * Two unlike checks, reported as two unlike failures.
 *
 * `unexplainedAllTimeDrops` is build integrity: edges vanished and the builder cannot say why, so
 * the artifact is wrong. Decade coverage is research completeness: the archive has not dated its
 * records yet. Collapsing both into one message made a correctness fix indistinguishable from a
 * corrupted build — withdrawing ~2,100 designation dates that were never eras dropped coverage
 * from "90%" to its real 49.4% and read as a broken release.
 *
 * Coverage therefore has an ACKNOWLEDGED FLOOR rather than a fixed bar. It still defaults to 90
 * and still fails closed, so nothing weakens by accident; publishing below it requires an
 * operator to state the number they are accepting, which lands in the log and the report.
 */
export function assertReleaseGraphAuditOrThrow(
  audit: GraphPublishAuditReport,
  options: { readonly minDecadeCoveragePct?: number; readonly enforceCoverage?: boolean } = {},
): void {
  const enforceCoverage = options.enforceCoverage ?? true;
  const minCoverage = options.minDecadeCoveragePct ?? 90;
  if (audit.unexplainedAllTimeDrops > 0) {
    throw new Error(
      `release graph integrity: ${audit.unexplainedAllTimeDrops} unexplained all-time edge drop(s). ` +
        'The built artifact is wrong — this is not a coverage threshold and must not be waived.',
    );
  }
  if (enforceCoverage && audit.decadeCoveragePct < minCoverage) {
    throw new Error(
      `decade coverage ${audit.decadeCoveragePct.toFixed(1)}% is below the acknowledged floor ` +
        `${minCoverage}% (${audit.entitiesWithDecadeBuckets}/${audit.entitiesInRelease}). ` +
        'This measures how much of the archive carries researched dates, not whether the build ' +
        'is sound. If the drop is intended, re-run stating the floor you accept.',
    );
  }
}

export async function rebuildReleaseGraphForRelease(
  client: pg.PoolClient,
  input: {
    readonly releaseId: string;
    readonly generatedAt: string;
    readonly adjacencyCap?: number;
    readonly minDecadeCoveragePct?: number;
    readonly enforceCoverage?: boolean;
    readonly dryRun?: boolean;
  },
): Promise<
  BuildReleaseGraphResult & {
    readonly persisted?: { readonly adjacencyRows: number; readonly decadeRows: number };
  }
> {
  const loaded = await loadReleaseGraphInputs(client, input.releaseId);
  const built = buildReleaseGraphArtifact({
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    releaseRows: loaded.releaseRows,
    canonicalById: loaded.canonicalById,
    relationshipRows: loaded.relationshipRows,
    ...(input.adjacencyCap !== undefined ? { adjacencyCap: input.adjacencyCap } : {}),
  });

  assertReleaseGraphAuditOrThrow(built.audit, {
    ...(input.minDecadeCoveragePct !== undefined
      ? { minDecadeCoveragePct: input.minDecadeCoveragePct }
      : {}),
    ...(input.enforceCoverage !== undefined ? { enforceCoverage: input.enforceCoverage } : {}),
  });

  if (!input.dryRun) {
    const persisted = await persistReleaseGraphArtifact(client, input.releaseId, built.artifact);
    return { ...built, persisted };
  }
  return built;
}
