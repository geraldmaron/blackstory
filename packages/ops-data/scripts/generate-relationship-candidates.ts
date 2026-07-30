/**
 * Deterministic WS4 relationship candidate sweep from bb_canonical signals.
 * Feeds proposeRelationshipCandidates (geohash, jurisdiction, mentions, decade overlap),
 * ranks with explainable score components, and stages to landscape_candidates — never
 * writes bb_canonical.entity_relationships.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/generate-relationship-candidates.ts
 *
 * Apply:
 *   DRY_RUN=0 GENERATE_RELATIONSHIP_CANDIDATES_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/generate-relationship-candidates.ts
 */
import pg from 'pg';
import type { StatusHistoryEntry } from '../../domain/src/entity-status.ts';
import {
  buildCoParticipationLinks,
  proposeRelationshipCandidates,
  type ExistingRelationshipRef,
  type RelationshipCandidateEntity,
} from '../../domain/src/graph/index.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { deriveEntityDecades } from './lib/relationship-candidate-decades.ts';
import {
  rankRelationshipCandidates,
  type CoParticipationCandidate,
} from './lib/relationship-candidate-ranking.ts';
import {
  RELATIONSHIP_INFERENCE_LANE,
  RELATIONSHIP_INFERENCE_PROGRAM_ID,
  shapeRelationshipLandscapeRows,
} from './lib/relationship-candidate-staging.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.GENERATE_RELATIONSHIP_CANDIDATES_APPLY === '1';
const MAX_CANDIDATES = Number.parseInt(process.env.MAX_CANDIDATES ?? '0', 10);

const ENTITY_SQL = `
SELECT
  e.id,
  e.kind,
  e.display_name,
  e.status_history,
  e.kind_detail,
  el.geohash,
  el.precision AS location_precision,
  el.jurisdiction_ids,
  el.label AS location_label,
  el.valid_from_edtf,
  el.valid_to_edtf,
  COALESCE(re.projection->'eraBuckets', '[]'::jsonb) AS era_buckets,
  COALESCE(re.projection->'mentionedEntityIds', '[]'::jsonb) AS mentioned_entity_ids
FROM bb_canonical.entities e
LEFT JOIN LATERAL (
  SELECT geohash, precision, jurisdiction_ids, label, valid_from_edtf, valid_to_edtf
  FROM bb_canonical.entity_locations
  WHERE entity_id = e.id
  ORDER BY CASE role WHEN 'historical' THEN 0 WHEN 'current' THEN 1 ELSE 2 END, id
  LIMIT 1
) el ON true
LEFT JOIN bb_public.release_entities re
  ON re.entity_id = e.id
LEFT JOIN bb_public.active_release ar
  ON re.release_id = ar.release_id
ORDER BY e.id
`;

const RELATIONSHIP_SQL = `
SELECT from_entity_id, to_entity_id, relationship_type AS type
FROM bb_canonical.entity_relationships
`;

const PARTICIPATION_SQL = `
SELECT event_id, participant_id, role
FROM bb_canonical.event_participation
`;

type EntityRow = {
  readonly id: string;
  readonly kind: string;
  readonly display_name: string;
  readonly status_history: unknown;
  readonly kind_detail: unknown;
  readonly geohash: string | null;
  readonly location_precision: string | null;
  readonly jurisdiction_ids: readonly string[] | null;
  readonly location_label: string | null;
  readonly valid_from_edtf: string | null;
  readonly valid_to_edtf: string | null;
  readonly era_buckets: unknown;
  readonly mentioned_entity_ids: unknown;
};

function asStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function jurisdictionLabel(row: EntityRow): string | undefined {
  const fromLocation = row.location_label?.trim();
  if (fromLocation && fromLocation.length > 0) return fromLocation;
  const jurisdiction = row.jurisdiction_ids?.[0]?.trim();
  return jurisdiction && jurisdiction.length > 0 ? jurisdiction : undefined;
}

function toCandidateEntity(row: EntityRow): RelationshipCandidateEntity {
  const kindDetail =
    row.kind_detail && typeof row.kind_detail === 'object' && !Array.isArray(row.kind_detail)
      ? (row.kind_detail as Readonly<Record<string, unknown>>)
      : undefined;
  const statusHistory = Array.isArray(row.status_history)
    ? (row.status_history as readonly StatusHistoryEntry<string>[])
    : [];

  return {
    id: row.id,
    kind: row.kind,
    jurisdictionLabel: jurisdictionLabel(row),
    ...(row.geohash ? { geohash: row.geohash } : {}),
    ...(row.location_precision ? { locationPrecision: row.location_precision } : {}),
    mentionedEntityIds: asStringArray(row.mentioned_entity_ids),
    decades: deriveEntityDecades({
      kind: row.kind,
      eraBuckets: asStringArray(row.era_buckets),
      statusHistory,
      kindDetail,
      locationValidFromEdtf: row.valid_from_edtf,
      locationValidToEdtf: row.valid_to_edtf,
    }),
  };
}

function coParticipationCandidates(
  participations: readonly { readonly event_id: string; readonly participant_id: string; readonly role: string }[],
  existingRelationships: readonly ExistingRelationshipRef[],
): readonly CoParticipationCandidate[] {
  const links = buildCoParticipationLinks(
    participations.map((row) => ({
      eventId: row.event_id,
      participantId: row.participant_id,
      role: row.role,
    })),
  );
  const candidates: CoParticipationCandidate[] = [];
  for (const link of links) {
    const hasEdge = existingRelationships.some(
      (relationship) =>
        (relationship.fromEntityId === link.entityAId && relationship.toEntityId === link.entityBId) ||
        (relationship.fromEntityId === link.entityBId && relationship.toEntityId === link.entityAId),
    );
    if (hasEdge) continue;
    candidates.push({
      fromEntityId: link.entityAId < link.entityBId ? link.entityAId : link.entityBId,
      toEntityId: link.entityAId < link.entityBId ? link.entityBId : link.entityAId,
      eventId: link.eventId,
      suggestedType: 'related_to',
      reason: 'same_event_co_participation',
    });
  }
  return candidates;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const { connectionString, ssl } = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({ connectionString, ...(ssl ? { ssl } : {}) });
  const client = await pool.connect();

  try {
    const entityResult = await client.query<EntityRow>(ENTITY_SQL);
    const relationshipResult = await client.query<{
      readonly from_entity_id: string;
      readonly to_entity_id: string;
      readonly type: string;
    }>(RELATIONSHIP_SQL);
    const participationResult = await client.query<{
      readonly event_id: string;
      readonly participant_id: string;
      readonly role: string;
    }>(PARTICIPATION_SQL);

    const entities = entityResult.rows.map(toCandidateEntity);
    const existingRelationships = relationshipResult.rows.map((row) => ({
      fromEntityId: row.from_entity_id,
      toEntityId: row.to_entity_id,
      type: row.type,
    }));

    const proposed = proposeRelationshipCandidates({
      entities,
      existingRelationships,
      maxCandidates: Number.isFinite(MAX_CANDIDATES) && MAX_CANDIDATES > 0 ? MAX_CANDIDATES : 0,
    });

    const coParticipation = coParticipationCandidates(participationResult.rows, existingRelationships);
    const ranked = rankRelationshipCandidates({
      proposed,
      coParticipation,
      entities,
    });

    const deterministicCount = ranked.filter((candidate) => candidate.tier === 'deterministic').length;
    const inferredCount = ranked.length - deterministicCount;
    const reasonCounts = ranked.reduce<Record<string, number>>((counts, candidate) => {
      counts[candidate.primaryReason] = (counts[candidate.primaryReason] ?? 0) + 1;
      return counts;
    }, {});

    console.log('=== generate-relationship-candidates (dry-run report) ===');
    console.log(`Entities loaded: ${entities.length}`);
    console.log(`Existing edges suppressed: ${existingRelationships.length}`);
    console.log(`Proposed pairs: ${proposed.length}`);
    console.log(`Co-participation pairs: ${coParticipation.length}`);
    console.log(`Ranked candidates: ${ranked.length}`);
    console.log(`Deterministic tier: ${deterministicCount}`);
    console.log(`Inferred tier: ${inferredCount}`);
    console.log('Primary reason counts:', reasonCounts);
    console.log('Top 10 by score:');
    for (const candidate of ranked.slice(0, 10)) {
      console.log(
        `  ${candidate.fromEntityId} -> ${candidate.toEntityId} (${candidate.suggestedType}) score=${candidate.score} tier=${candidate.tier} reason=${candidate.primaryReason}`,
      );
    }

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 GENERATE_RELATIONSHIP_CANDIDATES_APPLY=1 to stage rows.');
      console.log('Optional: STAGE_TIER=deterministic (or inferred) to limit apply; STAGE_LIMIT=N caps rows.');
      return;
    }

    const stageTier = (process.env.STAGE_TIER ?? 'all').trim().toLowerCase();
    const stageLimitRaw = Number.parseInt(process.env.STAGE_LIMIT ?? '0', 10);
    let toStage = ranked;
    if (stageTier === 'deterministic' || stageTier === 'inferred') {
      toStage = ranked.filter((candidate) => candidate.tier === stageTier);
    }
    if (Number.isFinite(stageLimitRaw) && stageLimitRaw > 0) {
      toStage = toStage.slice(0, stageLimitRaw);
    }
    console.log(`Staging ${toStage.length} candidates (STAGE_TIER=${stageTier}, STAGE_LIMIT=${stageLimitRaw || 'none'})`);

    const runId = `relationship-inference-${new Date().toISOString().slice(0, 10)}`;
    const entityNamesById = new Map(entityResult.rows.map((row) => [row.id, row.display_name]));
    const rows = shapeRelationshipLandscapeRows(toStage, runId, entityNamesById);

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO bb_research.source_program_runs
        (id, lane, source_program_id, source_program_name, retrieved_at, rows_fetched, candidate_count, summary, updated_at)
       VALUES ($1, 'other', $2, $3, now(), $4, $5, $6::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET
         rows_fetched = EXCLUDED.rows_fetched,
         candidate_count = EXCLUDED.candidate_count,
         summary = EXCLUDED.summary,
         updated_at = now()`,
      [
        runId,
        RELATIONSHIP_INFERENCE_PROGRAM_ID,
        'Spatiotemporal relationship inference',
        entities.length,
        rows.length,
        JSON.stringify({ reasonCounts, deterministicCount, inferredCount }),
      ],
    );

    let inserted = 0;
    for (const row of rows) {
      const result = await client.query(
        `INSERT INTO bb_research.landscape_candidates
          (id, run_id, lane, source_program_id, source_item_id, display_name, kind, summary,
           canonical_url, research_lane_only, status, provenance, payload, discovered_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11::jsonb,$12::jsonb,$13,now())
         ON CONFLICT (lane, source_item_id) DO NOTHING
         RETURNING id`,
        [
          row.id,
          row.run_id,
          row.lane,
          row.source_program_id,
          row.source_item_id,
          row.display_name,
          row.kind,
          row.summary,
          row.canonical_url,
          row.status,
          JSON.stringify(row.provenance),
          JSON.stringify(row.payload),
          row.discovered_at,
        ],
      );
      inserted += result.rowCount ?? 0;
    }
    await client.query('COMMIT');
    console.log(`\nStaged ${inserted} new rows to bb_research.landscape_candidates (lane='${RELATIONSHIP_INFERENCE_LANE}').`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
