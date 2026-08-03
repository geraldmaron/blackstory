/**
 * Promote deterministic relationship-inference landscape candidates into canonical edges.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/promote-relationship-candidates.ts
 *
 * Apply:
 *   DRY_RUN=0 PROMOTE_RELATIONSHIP_CANDIDATES_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/promote-relationship-candidates.ts
 */
import pg from 'pg';
import { buildAbsorbedToSurvivorMap } from './lib/entity-hub-merge.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  buildExistingEdgeKeySet,
  formatEdgeCoverage,
  planRelationshipPromotion,
  type EdgeCoverageSnapshot,
  type EntityLivingProfile,
  type LandscapeCandidateRow,
} from './lib/promote-relationship-candidates.ts';
import { RELATIONSHIP_INFERENCE_LANE } from './lib/relationship-candidate-staging.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.PROMOTE_RELATIONSHIP_CANDIDATES_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

async function loadActiveMergeMap(client: pg.PoolClient): Promise<ReadonlyMap<string, string>> {
  const result = await client.query<{ absorbed_id: string; survivor_id: string }>(
    `SELECT a.absorbed_id, m.survivor_id
     FROM bb_canonical.entity_merge_absorbed a
     JOIN bb_canonical.entity_merges m ON m.id = a.merge_id
     WHERE m.status = 'active'`,
  );
  return buildAbsorbedToSurvivorMap(
    result.rows.map((row) => ({
      absorbedId: row.absorbed_id,
      survivorId: row.survivor_id,
      reason: 'active merge ledger',
    })),
  );
}

async function loadPendingCandidates(
  client: pg.PoolClient,
): Promise<readonly LandscapeCandidateRow[]> {
  const result = await client.query<{
    id: string;
    status: string;
    lane: string;
    payload: Record<string, unknown>;
  }>(
    `SELECT id, status, lane, payload
     FROM bb_research.landscape_candidates
     WHERE lane = $1
       AND status = 'pending'
     ORDER BY id`,
    [RELATIONSHIP_INFERENCE_LANE],
  );
  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    lane: row.lane,
    payload: row.payload as LandscapeCandidateRow['payload'],
  }));
}

async function loadExistingAcceptedEdges(
  client: pg.PoolClient,
): Promise<ReturnType<typeof buildExistingEdgeKeySet>> {
  const result = await client.query<{
    from_entity_id: string;
    to_entity_id: string;
    relationship_type: string;
  }>(
    `SELECT from_entity_id, to_entity_id, relationship_type
     FROM bb_canonical.entity_relationships
     WHERE workflow_status = 'accepted'`,
  );
  return buildExistingEdgeKeySet(
    result.rows.map((row) => ({
      fromEntityId: row.from_entity_id,
      toEntityId: row.to_entity_id,
      relationshipType: row.relationship_type,
    })),
  );
}

async function loadEntityProfiles(
  client: pg.PoolClient,
  entityIds: readonly string[],
): Promise<ReadonlyMap<string, EntityLivingProfile>> {
  if (entityIds.length === 0) return new Map();
  const result = await client.query<{ id: string; kind: string; living_status: string }>(
    `SELECT id, kind, living_status
     FROM bb_canonical.entities
     WHERE id = ANY($1::text[])`,
    [entityIds],
  );
  return new Map(
    result.rows.map((row) => [
      row.id,
      {
        id: row.id,
        kind: row.kind,
        livingStatus: row.living_status,
      },
    ]),
  );
}

async function loadEdgeCoverage(client: pg.PoolClient): Promise<EdgeCoverageSnapshot> {
  const result = await client.query<{
    total_entities: string;
    entities_with_accepted_edge: string;
  }>(
    `WITH touched AS (
       SELECT from_entity_id AS entity_id
       FROM bb_canonical.entity_relationships
       WHERE workflow_status = 'accepted'
       UNION
       SELECT to_entity_id
       FROM bb_canonical.entity_relationships
       WHERE workflow_status = 'accepted'
     )
     SELECT
       (SELECT COUNT(*)::text FROM bb_canonical.entities) AS total_entities,
       (SELECT COUNT(DISTINCT entity_id)::text FROM touched) AS entities_with_accepted_edge`,
  );
  return {
    totalEntities: Number.parseInt(result.rows[0]?.total_entities ?? '0', 10),
    entitiesWithAcceptedEdge: Number.parseInt(
      result.rows[0]?.entities_with_accepted_edge ?? '0',
      10,
    ),
  };
}

function collectEntityIds(rows: readonly LandscapeCandidateRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    const fromId = row.payload.from_entity_id?.trim();
    const toId = row.payload.to_entity_id?.trim();
    if (fromId) ids.add(fromId);
    if (toId) ids.add(toId);
  }
  return [...ids];
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const pool = new pg.Pool({ connectionString: cs, ssl });
  const client = await pool.connect();

  try {
    console.log('=== Promote relationship-inference candidates ===');
    console.log(`Mode: ${DRY_RUN || !APPLY ? 'dry-run' : 'apply'}`);

    const coverageBefore = await loadEdgeCoverage(client);
    console.log(`Edge coverage before: ${formatEdgeCoverage(coverageBefore)}`);

    const candidates = await loadPendingCandidates(client);
    console.log(`Pending ${RELATIONSHIP_INFERENCE_LANE} candidates: ${candidates.length}`);

    const mergeMap = await loadActiveMergeMap(client);
    if (mergeMap.size > 0) {
      console.log(`Active merge remap entries: ${mergeMap.size}`);
    }

    const entityIds = collectEntityIds(candidates);
    const profiles = await loadEntityProfiles(client, entityIds);
    const existingEdges = await loadExistingAcceptedEdges(client);
    const decisions = planRelationshipPromotion(candidates, profiles, existingEdges, mergeMap);

    const inserts = decisions.filter((d) => d.action === 'insert');
    const skips = decisions.filter((d) => d.action === 'skip');
    const skipCounts = skips.reduce<Record<string, number>>((acc, row) => {
      acc[row.reason] = (acc[row.reason] ?? 0) + 1;
      return acc;
    }, {});

    console.log(`Planned inserts: ${inserts.length}`);
    console.log(`Planned skips: ${skips.length}`);
    console.log(`Skip reasons: ${JSON.stringify(skipCounts)}`);

    for (const decision of inserts.slice(0, 5)) {
      if (decision.action !== 'insert') continue;
      console.log(
        `  INSERT ${decision.relationshipId}: ${decision.candidate.fromEntityId} ` +
          `${decision.candidate.relationshipType} ${decision.candidate.toEntityId} ` +
          `(${decision.candidate.primaryReason}, score=${decision.candidate.score})`,
      );
    }
    if (inserts.length > 5) console.log(`  ...and ${inserts.length - 5} more inserts`);

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDry run only — no writes made. Set DRY_RUN=0 and PROMOTE_RELATIONSHIP_CANDIDATES_APPLY=1 to apply.',
      );
      return;
    }

    await client.query('BEGIN');
    let inserted = 0;
    let acceptedCandidates = 0;
    try {
      for (const decision of decisions) {
        if (decision.action !== 'insert') continue;
        const insertResult = await client.query(
          `INSERT INTO bb_canonical.entity_relationships (
             id, from_entity_id, to_entity_id, relationship_type,
             workflow_status, publication_status, confidence, updated_at
           ) VALUES ($1, $2, $3, $4, 'accepted', 'published', $5::jsonb, now())
           ON CONFLICT (id) DO NOTHING`,
          [
            decision.relationshipId,
            decision.candidate.fromEntityId,
            decision.candidate.toEntityId,
            decision.candidate.relationshipType,
            JSON.stringify({
              lane: RELATIONSHIP_INFERENCE_LANE,
              primary_reason: decision.candidate.primaryReason,
              score: decision.candidate.score,
              tier: decision.candidate.tier,
              candidate_id: decision.candidate.candidateId,
            }),
          ],
        );
        if ((insertResult.rowCount ?? 0) === 0) continue;
        inserted += 1;
        const updateResult = await client.query(
          `UPDATE bb_research.landscape_candidates
           SET status = 'accepted', updated_at = now()
           WHERE id = $1 AND status = 'pending'`,
          [decision.candidate.candidateId],
        );
        acceptedCandidates += updateResult.rowCount ?? 0;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const coverageAfter = await loadEdgeCoverage(client);
    console.log(
      `\nApplied: inserted ${inserted} entity_relationships; accepted ${acceptedCandidates} candidates.`,
    );
    console.log(`Edge coverage after: ${formatEdgeCoverage(coverageAfter)}`);
    console.log(
      '\nOptional next step: rebuild release graph surfaces for the active release:\n' +
        '  DRY_RUN=0 RELEASE_GRAPH_APPLY=1 node --conditions development --import tsx packages/ops-data/scripts/rebuild-release-graph.ts',
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
