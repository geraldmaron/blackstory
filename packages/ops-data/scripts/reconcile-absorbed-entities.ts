/**
 * repo-n7p6.15 — make an entity merge STAY merged.
 *
 * merge-duplicate-hubs.ts performs a merge correctly: it marks the absorbed entity
 * `merge_state.status='absorbed'`, records the ledger row, and repoints every edge onto the
 * survivor. What it cannot do is keep that true. Nothing downstream reads `merge_state`, so an
 * absorbed id stays a live, writable target across the whole pipeline:
 *
 *   - `publish-release-entities-incremental.ts` selects `FROM bb_canonical.entities WHERE id =
 *     ANY(...)` with no merge filter, so an absorbed entity publishes like any other. Both SCLC
 *     records and both SNCC records were live in the active release, six days after they were
 *     merged on 2026-07-29 — a reader searching "SCLC" got two results for one organization.
 *   - Relationship inference re-created 41 edges pointing at the absorbed ids on 2026-08-04,
 *     re-splitting the graph the merge had just joined.
 *
 * So this is a reconciler, not a one-shot repair, and it is deliberately generic over the merge
 * ledger rather than hardcoded to a pair: it re-derives the absorbed→survivor map from every
 * ACTIVE merge and re-asserts it. Running it twice is a no-op. Run it after any pass that writes
 * relationships. The durable half of the fix is the publish-side filter (see
 * `absorbedEntityIds` usage in publish-release-entities-incremental.ts) — this script repairs
 * what already drifted.
 *
 * Reversed merges (`entity_merges.status <> 'active'`) are ignored, so un-merging an entity and
 * re-running does not re-absorb it.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/reconcile-absorbed-entities.ts
 *
 * Apply:
 *   DRY_RUN=0 RECONCILE_ABSORBED_ENTITIES_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/reconcile-absorbed-entities.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.RECONCILE_ABSORBED_ENTITIES_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

type MergePair = { readonly absorbedId: string; readonly survivorId: string };

/**
 * The absorbed→survivor map, from ACTIVE ledger rows only.
 *
 * Chains are resolved transitively (A absorbed into B, B later absorbed into C, so A resolves to
 * C) with a bounded walk — a cycle in the ledger would otherwise spin here, and a cycle is a data
 * bug we should report rather than hang on.
 */
async function loadActiveMerges(client: pg.PoolClient): Promise<readonly MergePair[]> {
  const { rows } = await client.query<{ absorbed_id: string; survivor_id: string }>(
    `SELECT a.absorbed_id, m.survivor_id
       FROM bb_canonical.entity_merge_absorbed a
       JOIN bb_canonical.entity_merges m ON m.id = a.merge_id
      WHERE m.status = 'active'`,
  );
  const direct = new Map(rows.map((r) => [r.absorbed_id, r.survivor_id]));
  const resolved: MergePair[] = [];
  for (const [absorbedId, firstSurvivor] of direct) {
    let survivorId = firstSurvivor;
    const seen = new Set<string>([absorbedId]);
    while (direct.has(survivorId)) {
      if (seen.has(survivorId)) {
        throw new Error(
          `merge ledger contains a cycle involving ${absorbedId}; refusing to reconcile`,
        );
      }
      seen.add(survivorId);
      survivorId = direct.get(survivorId)!;
    }
    if (survivorId !== absorbedId) resolved.push({ absorbedId, survivorId });
  }
  return resolved;
}

type Counts = Record<string, number>;

async function repointGraph(client: pg.PoolClient, pairs: readonly MergePair[]): Promise<Counts> {
  const absorbed = pairs.map((p) => p.absorbedId);
  const survivorOf = Object.fromEntries(pairs.map((p) => [p.absorbedId, p.survivorId]));
  const counts: Counts = {
    relationships_from: 0,
    relationships_to: 0,
    relationship_self_loops: 0,
    relationship_duplicates: 0,
    participation_participant: 0,
    participation_event: 0,
    participation_duplicates: 0,
  };
  if (absorbed.length === 0) return counts;

  // A jsonb map keeps this one statement per column rather than one per pair.
  const map = JSON.stringify(survivorOf);
  counts.relationships_from =
    (
      await client.query(
        `UPDATE bb_canonical.entity_relationships
            SET from_entity_id = $1::jsonb ->> from_entity_id, updated_at = now()
          WHERE from_entity_id = ANY($2::text[])`,
        [map, absorbed],
      )
    ).rowCount ?? 0;
  counts.relationships_to =
    (
      await client.query(
        `UPDATE bb_canonical.entity_relationships
            SET to_entity_id = $1::jsonb ->> to_entity_id, updated_at = now()
          WHERE to_entity_id = ANY($2::text[])`,
        [map, absorbed],
      )
    ).rowCount ?? 0;
  // Repointing can fold an edge onto itself ("SCLC related_to SCLC") or onto an edge the survivor
  // already had. Both are artifacts of the merge, not real graph facts.
  //
  // Both cleanups are SCOPED to the survivors. An unscoped `DELETE ... WHERE r1.id > r2.id` over
  // the whole table is what merge-duplicate-hubs.ts does, and it is a trap: a reconciler that
  // repoints nothing still deletes rows anywhere in the graph. It cost real data the first time
  // this script ran (see the note on the participation dedupe below).
  const survivors = [...new Set(pairs.map((p) => p.survivorId))];
  counts.relationship_self_loops =
    (
      await client.query(
        `DELETE FROM bb_canonical.entity_relationships
          WHERE from_entity_id = to_entity_id AND from_entity_id = ANY($1::text[])`,
        [survivors],
      )
    ).rowCount ?? 0;
  counts.relationship_duplicates =
    (
      await client.query(
        `DELETE FROM bb_canonical.entity_relationships r1
          USING bb_canonical.entity_relationships r2
          WHERE r1.from_entity_id = r2.from_entity_id
            AND r1.to_entity_id = r2.to_entity_id
            AND r1.relationship_type = r2.relationship_type
            AND r1.id > r2.id
            AND (r1.from_entity_id = ANY($1::text[]) OR r1.to_entity_id = ANY($1::text[]))`,
        [survivors],
      )
    ).rowCount ?? 0;

  counts.participation_participant =
    (
      await client.query(
        `UPDATE bb_canonical.event_participation
            SET participant_id = $1::jsonb ->> participant_id, updated_at = now()
          WHERE participant_id = ANY($2::text[])`,
        [map, absorbed],
      )
    ).rowCount ?? 0;
  counts.participation_event =
    (
      await client.query(
        `UPDATE bb_canonical.event_participation
            SET event_id = $1::jsonb ->> event_id, updated_at = now()
          WHERE event_id = ANY($2::text[])`,
        [map, absorbed],
      )
    ).rowCount ?? 0;
  // Scoped to survivors, and keyed on `role` as well as the endpoints.
  //
  // The first run of this script keyed only on (event_id, participant_id) and ran unscoped. It
  // deleted 54 rows while repointing zero — every one of them a pre-existing pair that differed
  // only by role, nothing to do with the merge. `role` is a real distinction here (mentioned,
  // associated, participant, attendee), so collapsing on the pair alone destroys information.
  // The rows were regenerable from backfill-event-participation.ts, which is the only reason
  // that was recoverable.
  counts.participation_duplicates =
    (
      await client.query(
        `DELETE FROM bb_canonical.event_participation p1
          USING bb_canonical.event_participation p2
          WHERE p1.event_id = p2.event_id
            AND p1.participant_id = p2.participant_id
            AND p1.role IS NOT DISTINCT FROM p2.role
            AND p1.id > p2.id
            AND (p1.event_id = ANY($1::text[]) OR p1.participant_id = ANY($1::text[]))`,
        [survivors],
      )
    ).rowCount ?? 0;
  return counts;
}

/**
 * Unpublishes absorbed entities from the ACTIVE release.
 *
 * Deleting the release row is the correct operation, not blanking a field: the merge's whole
 * claim is that this record is not a separate thing. Its claims and summary are preserved in
 * bb_canonical, and the merge ledger row makes the removal reversible.
 */
async function unpublishAbsorbed(
  client: pg.PoolClient,
  pairs: readonly MergePair[],
): Promise<Counts> {
  const absorbed = pairs.map((p) => p.absorbedId);
  if (absorbed.length === 0) return { release_entities: 0, search_index: 0 };
  const releaseEntities =
    (
      await client.query(
        `DELETE FROM bb_public.release_entities
          WHERE entity_id = ANY($1::text[])
            AND release_id = (SELECT release_id FROM bb_public.v_active_release_id)`,
        [absorbed],
      )
    ).rowCount ?? 0;
  const searchIndex =
    (
      await client.query(
        `DELETE FROM bb_public.search_index
          WHERE entity_id = ANY($1::text[])
            AND release_id = (SELECT release_id FROM bb_public.v_active_release_id)`,
        [absorbed],
      )
    ).rowCount ?? 0;
  return { release_entities: releaseEntities, search_index: searchIndex };
}

/**
 * Repoints published references to absorbed ids onto the survivor, in `related[]` (top-level and
 * inside `projection`) and in `projection.mentionedEntityIds`.
 *
 * Remap, not delete. A record that referenced SCLC still references SCLC — the merge changed
 * which row carries that name, not whether the relationship happened. Dropping the reference
 * would silently shrink the graph; leaving it would leave a link to an unpublished record. Both
 * lists are then deduplicated, and a reference that now points at the record itself is removed.
 */
async function remapReleaseReferences(
  client: pg.PoolClient,
  pairs: readonly MergePair[],
): Promise<number> {
  if (pairs.length === 0) return 0;
  const map = JSON.stringify(Object.fromEntries(pairs.map((p) => [p.absorbedId, p.survivorId])));
  const absorbed = pairs.map((p) => p.absorbedId);
  const { rowCount } = await client.query(
    `WITH active AS (SELECT release_id FROM bb_public.v_active_release_id)
     UPDATE bb_public.release_entities e
        SET related = (
              SELECT coalesce(jsonb_agg(DISTINCT y), '[]'::jsonb)
                FROM jsonb_array_elements(coalesce(e.related, '[]'::jsonb)) x,
                LATERAL (
                  SELECT jsonb_set(x, '{id}', to_jsonb(coalesce($1::jsonb ->> (x->>'id'), x->>'id')))
                ) AS t(y)
               WHERE coalesce($1::jsonb ->> (x->>'id'), x->>'id') <> e.entity_id
            ),
            projection = jsonb_set(
              jsonb_set(
                e.projection, '{related}',
                (
                  SELECT coalesce(jsonb_agg(DISTINCT y), '[]'::jsonb)
                    FROM jsonb_array_elements(coalesce(e.projection->'related', '[]'::jsonb)) x,
                    LATERAL (
                      SELECT jsonb_set(x, '{id}', to_jsonb(coalesce($1::jsonb ->> (x->>'id'), x->>'id')))
                    ) AS t(y)
                   WHERE coalesce($1::jsonb ->> (x->>'id'), x->>'id') <> e.entity_id
                )
              ),
              '{mentionedEntityIds}',
              (
                SELECT coalesce(jsonb_agg(DISTINCT z), '[]'::jsonb)
                  FROM jsonb_array_elements_text(
                         coalesce(e.projection->'mentionedEntityIds', '[]'::jsonb)
                       ) m,
                  LATERAL (SELECT coalesce($1::jsonb ->> m, m)) AS t(z)
                 WHERE coalesce($1::jsonb ->> m, m) <> e.entity_id
              )
            )
       FROM active a
      WHERE e.release_id = a.release_id
        AND (
          e.related::text LIKE ANY (SELECT '%' || x || '%' FROM unnest($2::text[]) x)
          OR e.projection::text LIKE ANY (SELECT '%' || x || '%' FROM unnest($2::text[]) x)
        )`,
    [map, absorbed],
  );
  return rowCount ?? 0;
}

async function reportDrift(
  client: pg.PoolClient,
  pairs: readonly MergePair[],
): Promise<{ edges: number; published: number; relatedRefs: number }> {
  const absorbed = pairs.map((p) => p.absorbedId);
  if (absorbed.length === 0) return { edges: 0, published: 0, relatedRefs: 0 };
  const edges = await client.query<{ n: string }>(
    `SELECT count(*)::text n FROM bb_canonical.entity_relationships
      WHERE from_entity_id = ANY($1::text[]) OR to_entity_id = ANY($1::text[])`,
    [absorbed],
  );
  const published = await client.query<{ n: string }>(
    `SELECT count(*)::text n FROM bb_public.release_entities
      WHERE entity_id = ANY($1::text[])
        AND release_id = (SELECT release_id FROM bb_public.v_active_release_id)`,
    [absorbed],
  );
  const relatedRefs = await client.query<{ n: string }>(
    `SELECT count(*)::text n
       FROM bb_public.release_entities e, bb_public.v_active_release_id a
      WHERE e.release_id = a.release_id
        AND (
          EXISTS (
            SELECT 1 FROM jsonb_array_elements(coalesce(e.related, '[]'::jsonb)) x
             WHERE x->>'id' = ANY($1::text[])
          )
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(
                          coalesce(e.projection->'mentionedEntityIds', '[]'::jsonb)) m
             WHERE m = ANY($1::text[])
          )
        )`,
    [absorbed],
  );
  return {
    edges: Number(edges.rows[0]?.n ?? 0),
    published: Number(published.rows[0]?.n ?? 0),
    relatedRefs: Number(relatedRefs.rows[0]?.n ?? 0),
  };
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const pool = new pg.Pool({ connectionString: cs, ssl });
  const client = await pool.connect();
  try {
    console.log('=== Reconcile absorbed entities ===');
    const pairs = await loadActiveMerges(client);
    console.log(`Active merges: ${pairs.length}`);
    for (const pair of pairs) console.log(`  ${pair.absorbedId} -> ${pair.survivorId}`);

    const before = await reportDrift(client, pairs);
    console.log(
      `\nDrift: ${before.edges} canonical edge(s) on absorbed ids, ` +
        `${before.published} absorbed entity/entities still published, ` +
        `${before.relatedRefs} published record(s) linking to an absorbed id.`,
    );

    if (before.edges === 0 && before.published === 0 && before.relatedRefs === 0) {
      console.log('\nNothing to reconcile.');
      return;
    }
    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 RECONCILE_ABSORBED_ENTITIES_APPLY=1 to apply.');
      return;
    }

    await client.query('BEGIN');
    const graph = await repointGraph(client, pairs);
    const related = await remapReleaseReferences(client, pairs);
    const unpublished = await unpublishAbsorbed(client, pairs);
    await client.query('COMMIT');

    console.log('\nApplied:');
    for (const [key, value] of Object.entries({ ...graph, ...unpublished })) {
      console.log(`  ${key}: ${value}`);
    }
    console.log(`  release_references_remapped: ${related}`);

    const after = await reportDrift(client, pairs);
    console.log(
      `\nRemaining drift: edges=${after.edges} published=${after.published} relatedRefs=${after.relatedRefs}`,
    );
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
