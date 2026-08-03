/**
 * Merge duplicate organization hubs into canonical survivor records.
 *
 * Default pair set: ent_sncc_001→ent_sncc_org_001, ent_sclc_001→ent_sclc_org_001.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/merge-duplicate-hubs.ts
 *
 * Apply:
 *   DRY_RUN=0 MERGE_DUPLICATE_HUBS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/merge-duplicate-hubs.ts
 */
import pg from 'pg';
import {
  buildMergeStatePayload,
  DEFAULT_HUB_MERGE_PAIRS,
  formatDegreeSnapshot,
  mergeLedgerId,
  type EntityDegreeSnapshot,
  type HubMergePair,
} from './lib/entity-hub-merge.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  formatEdgeCoverage,
  type EdgeCoverageSnapshot,
} from './lib/promote-relationship-candidates.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.MERGE_DUPLICATE_HUBS_APPLY === '1';
const ACTOR_ID = process.env.OPERATOR_ID?.trim() || 'ops-data/merge-duplicate-hubs';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

async function entityExists(client: pg.PoolClient, entityId: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM bb_canonical.entities WHERE id = $1) AS exists`,
    [entityId],
  );
  return result.rows[0]?.exists === true;
}

async function mergeAlreadyApplied(client: pg.PoolClient, absorbedId: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM bb_canonical.entity_merge_absorbed a
       JOIN bb_canonical.entity_merges m ON m.id = a.merge_id
       WHERE a.absorbed_id = $1 AND m.status = 'active'
     ) AS exists`,
    [absorbedId],
  );
  return result.rows[0]?.exists === true;
}

async function relationshipDegree(client: pg.PoolClient, entityId: string): Promise<number> {
  const result = await client.query<{ degree: string }>(
    `SELECT COUNT(*)::text AS degree
     FROM bb_canonical.entity_relationships
     WHERE from_entity_id = $1 OR to_entity_id = $1`,
    [entityId],
  );
  return Number.parseInt(result.rows[0]?.degree ?? '0', 10);
}

async function loadDegreeSnapshots(
  client: pg.PoolClient,
  pairs: readonly HubMergePair[],
): Promise<readonly EntityDegreeSnapshot[]> {
  const ids = new Set<string>();
  for (const pair of pairs) {
    ids.add(pair.absorbedId);
    ids.add(pair.survivorId);
  }
  const snapshots: EntityDegreeSnapshot[] = [];
  for (const entityId of [...ids].sort()) {
    snapshots.push({ entityId, degree: await relationshipDegree(client, entityId) });
  }
  return snapshots;
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

async function rewriteRelationshipsForPair(
  client: pg.PoolClient,
  pair: HubMergePair,
): Promise<{
  readonly updatedFrom: number;
  readonly updatedTo: number;
  readonly deletedSelfLoops: number;
  readonly deletedDuplicates: number;
}> {
  const updatedFrom =
    (
      await client.query(
        `UPDATE bb_canonical.entity_relationships
       SET from_entity_id = $2, updated_at = now()
       WHERE from_entity_id = $1`,
        [pair.absorbedId, pair.survivorId],
      )
    ).rowCount ?? 0;
  const updatedTo =
    (
      await client.query(
        `UPDATE bb_canonical.entity_relationships
       SET to_entity_id = $2, updated_at = now()
       WHERE to_entity_id = $1`,
        [pair.absorbedId, pair.survivorId],
      )
    ).rowCount ?? 0;
  const deletedSelfLoops =
    (
      await client.query(
        `DELETE FROM bb_canonical.entity_relationships
       WHERE from_entity_id = to_entity_id`,
      )
    ).rowCount ?? 0;
  const deletedDuplicates =
    (
      await client.query(
        `DELETE FROM bb_canonical.entity_relationships r1
       USING bb_canonical.entity_relationships r2
       WHERE r1.from_entity_id = r2.from_entity_id
         AND r1.to_entity_id = r2.to_entity_id
         AND r1.relationship_type = r2.relationship_type
         AND r1.id > r2.id`,
      )
    ).rowCount ?? 0;
  return { updatedFrom, updatedTo, deletedSelfLoops, deletedDuplicates };
}

async function rewriteEventParticipationForPair(
  client: pg.PoolClient,
  pair: HubMergePair,
): Promise<{
  readonly updatedParticipant: number;
  readonly updatedEvent: number;
  readonly deletedSelfLoops: number;
  readonly deletedDuplicates: number;
}> {
  const updatedParticipant =
    (
      await client.query(
        `UPDATE bb_canonical.event_participation
       SET participant_id = $2, updated_at = now()
       WHERE participant_id = $1`,
        [pair.absorbedId, pair.survivorId],
      )
    ).rowCount ?? 0;
  const updatedEvent =
    (
      await client.query(
        `UPDATE bb_canonical.event_participation
       SET event_id = $2, updated_at = now()
       WHERE event_id = $1`,
        [pair.absorbedId, pair.survivorId],
      )
    ).rowCount ?? 0;
  const deletedSelfLoops =
    (
      await client.query(
        `DELETE FROM bb_canonical.event_participation
       WHERE event_id = participant_id`,
      )
    ).rowCount ?? 0;
  const deletedDuplicates =
    (
      await client.query(
        `DELETE FROM bb_canonical.event_participation ep1
       USING bb_canonical.event_participation ep2
       WHERE ep1.event_id = ep2.event_id
         AND ep1.participant_id = ep2.participant_id
         AND ep1.role = ep2.role
         AND ep1.id > ep2.id`,
      )
    ).rowCount ?? 0;
  return { updatedParticipant, updatedEvent, deletedSelfLoops, deletedDuplicates };
}

async function rewriteReleaseEntitiesForPair(
  client: pg.PoolClient,
  pair: HubMergePair,
): Promise<{ readonly updated: number; readonly conflicts: readonly string[] }> {
  const conflictRes = await client.query<{ release_id: string }>(
    `SELECT re.release_id
     FROM bb_public.release_entities re
     WHERE re.entity_id = $1
       AND EXISTS (
         SELECT 1
         FROM bb_public.release_entities re2
         WHERE re2.release_id = re.release_id
           AND re2.entity_id = $2
       )`,
    [pair.absorbedId, pair.survivorId],
  );
  const updated =
    (
      await client.query(
        `UPDATE bb_public.release_entities re
       SET entity_id = $2
       WHERE re.entity_id = $1
         AND NOT EXISTS (
           SELECT 1
           FROM bb_public.release_entities re2
           WHERE re2.release_id = re.release_id
             AND re2.entity_id = $2
         )`,
        [pair.absorbedId, pair.survivorId],
      )
    ).rowCount ?? 0;
  return { updated, conflicts: conflictRes.rows.map((row) => row.release_id) };
}

async function rewriteSearchIndexForPair(
  client: pg.PoolClient,
  pair: HubMergePair,
): Promise<{ readonly updated: number; readonly conflicts: readonly string[] }> {
  const conflictRes = await client.query<{ release_id: string }>(
    `SELECT si.release_id
     FROM bb_public.search_index si
     WHERE si.entity_id = $1
       AND EXISTS (
         SELECT 1
         FROM bb_public.search_index si2
         WHERE si2.release_id = si.release_id
           AND si2.entity_id = $2
       )`,
    [pair.absorbedId, pair.survivorId],
  );
  const updated =
    (
      await client.query(
        `UPDATE bb_public.search_index si
       SET entity_id = $2
       WHERE si.entity_id = $1
         AND NOT EXISTS (
           SELECT 1
           FROM bb_public.search_index si2
           WHERE si2.release_id = si.release_id
             AND si2.entity_id = $2
         )`,
        [pair.absorbedId, pair.survivorId],
      )
    ).rowCount ?? 0;
  return { updated, conflicts: conflictRes.rows.map((row) => row.release_id) };
}

async function rewriteLandscapeCandidatesForPair(
  client: pg.PoolClient,
  pair: HubMergePair,
): Promise<number> {
  const result = await client.query(
    `UPDATE bb_research.landscape_candidates lc
     SET payload = jsonb_set(
           jsonb_set(
             payload,
             '{from_entity_id}',
             to_jsonb(
               CASE
                 WHEN payload->>'from_entity_id' = $1 THEN $2
                 ELSE payload->>'from_entity_id'
               END
             )
           ),
           '{to_entity_id}',
           to_jsonb(
             CASE
               WHEN payload->>'to_entity_id' = $1 THEN $2
               ELSE payload->>'to_entity_id'
             END
           )
         ),
         updated_at = now()
     WHERE payload->>'from_entity_id' = $1
        OR payload->>'to_entity_id' = $1`,
    [pair.absorbedId, pair.survivorId],
  );
  return result.rowCount ?? 0;
}

async function applyHubMerge(
  client: pg.PoolClient,
  pair: HubMergePair,
  absorbedAt: string,
): Promise<{
  readonly mergeId: string;
  readonly relationships: Awaited<ReturnType<typeof rewriteRelationshipsForPair>>;
  readonly participation: Awaited<ReturnType<typeof rewriteEventParticipationForPair>>;
  readonly releaseEntities: Awaited<ReturnType<typeof rewriteReleaseEntitiesForPair>>;
  readonly searchIndex: Awaited<ReturnType<typeof rewriteSearchIndexForPair>>;
  readonly landscapeCandidates: number;
}> {
  const mergeId = mergeLedgerId(pair.absorbedId);
  await client.query(
    `INSERT INTO bb_canonical.entity_merges (id, survivor_id, status, reason, actor_id)
     VALUES ($1, $2, 'active', $3, $4)`,
    [mergeId, pair.survivorId, pair.reason, ACTOR_ID],
  );
  await client.query(
    `INSERT INTO bb_canonical.entity_merge_absorbed (merge_id, absorbed_id)
     VALUES ($1, $2)`,
    [mergeId, pair.absorbedId],
  );

  const relationships = await rewriteRelationshipsForPair(client, pair);
  const participation = await rewriteEventParticipationForPair(client, pair);
  const releaseEntities = await rewriteReleaseEntitiesForPair(client, pair);
  const searchIndex = await rewriteSearchIndexForPair(client, pair);
  const landscapeCandidates = await rewriteLandscapeCandidatesForPair(client, pair);

  await client.query(
    `UPDATE bb_canonical.entities
     SET merge_state = $2::jsonb, updated_at = now()
     WHERE id = $1`,
    [pair.absorbedId, JSON.stringify(buildMergeStatePayload(pair, mergeId, absorbedAt))],
  );

  return {
    mergeId,
    relationships,
    participation,
    releaseEntities,
    searchIndex,
    landscapeCandidates,
  };
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const pool = new pg.Pool({ connectionString: cs, ssl });
  const client = await pool.connect();

  try {
    console.log('=== Hub duplicate merge ===');
    console.log(`Pairs: ${DEFAULT_HUB_MERGE_PAIRS.length}`);
    console.log(`Mode: ${DRY_RUN || !APPLY ? 'dry-run' : 'apply'}`);

    const coverageBefore = await loadEdgeCoverage(client);
    console.log(`Edge coverage before: ${formatEdgeCoverage(coverageBefore)}`);
    const degreesBefore = await loadDegreeSnapshots(client, DEFAULT_HUB_MERGE_PAIRS);
    console.log(formatDegreeSnapshot('Relationship degree before', degreesBefore));

    const plan: Array<{
      readonly pair: HubMergePair;
      readonly skipReason?: string;
    }> = [];

    for (const pair of DEFAULT_HUB_MERGE_PAIRS) {
      const absorbedExists = await entityExists(client, pair.absorbedId);
      const survivorExists = await entityExists(client, pair.survivorId);
      if (!absorbedExists || !survivorExists) {
        plan.push({
          pair,
          skipReason: `missing entity (${pair.absorbedId} exists=${absorbedExists}, ${pair.survivorId} exists=${survivorExists})`,
        });
        continue;
      }
      if (await mergeAlreadyApplied(client, pair.absorbedId)) {
        plan.push({ pair, skipReason: 'merge already active' });
        continue;
      }
      plan.push({ pair });
    }

    for (const entry of plan) {
      const label = `${entry.pair.absorbedId} → ${entry.pair.survivorId}`;
      if (entry.skipReason) {
        console.log(`SKIP ${label}: ${entry.skipReason}`);
        continue;
      }
      console.log(
        `PLAN ${label}: insert merge ledger, rewrite relationships/participation/candidates, soft-mark absorbed`,
      );
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDry run only — no writes made. Set DRY_RUN=0 and MERGE_DUPLICATE_HUBS_APPLY=1 to apply.',
      );
      return;
    }

    const absorbedAt = new Date().toISOString();
    await client.query('BEGIN');
    try {
      for (const entry of plan) {
        if (entry.skipReason) continue;
        const result = await applyHubMerge(client, entry.pair, absorbedAt);
        console.log(
          `APPLIED ${entry.pair.absorbedId} → ${entry.pair.survivorId} merge_id=${result.mergeId} ` +
            `relationships(from=${result.relationships.updatedFrom}, to=${result.relationships.updatedTo}, ` +
            `self=${result.relationships.deletedSelfLoops}, dup=${result.relationships.deletedDuplicates}) ` +
            `participation(part=${result.participation.updatedParticipant}, event=${result.participation.updatedEvent}, ` +
            `self=${result.participation.deletedSelfLoops}, dup=${result.participation.deletedDuplicates}) ` +
            `release_entities=${result.releaseEntities.updated} search_index=${result.searchIndex.updated} ` +
            `landscape_candidates=${result.landscapeCandidates}`,
        );
        if (result.releaseEntities.conflicts.length > 0) {
          console.log(
            `  REPUBLISH release_entities conflicts for releases: ${result.releaseEntities.conflicts.join(', ')}`,
          );
        }
        if (result.searchIndex.conflicts.length > 0) {
          console.log(
            `  REPUBLISH search_index conflicts for releases: ${result.searchIndex.conflicts.join(', ')}`,
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const degreesAfter = await loadDegreeSnapshots(client, DEFAULT_HUB_MERGE_PAIRS);
    console.log(formatDegreeSnapshot('Relationship degree after', degreesAfter));
    const coverageAfter = await loadEdgeCoverage(client);
    console.log(`Edge coverage after: ${formatEdgeCoverage(coverageAfter)}`);
    console.log(
      '\nOptional next step: rebuild release graph surfaces after canonical relationship changes:\n' +
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
