/**
 * Shared logic for syncing `bb_public.release_entities.taxonomy` from the canonical source of
 * truth, `bb_canonical.entities.kind_detail->'classification'` (topicIds/topicTags).
 *
 * Root cause this closes: the release-build path that created the currently active release wrote
 * `taxonomy` without reading `kind_detail.classification` at all, so 1,167 of 1,375 entities in
 * the active release shipped with blank topics despite having real topic data in canonical. There
 * was also no ongoing sync — if a later editorial pass updates an entity's `kind_detail`, nothing
 * propagated that into the already-published release row, so the same gap could reopen for any
 * future release. This module is the one place that mapping happens, callable both as a one-time
 * backfill and as a step every release-affecting operation should call afterward.
 */
import type { Pool, PoolClient } from 'pg';
import { isValidTopicId } from '@repo/domain';

export type ReleaseTaxonomySyncRow = {
  readonly entityId: string;
  readonly beforeTopicIds: readonly string[];
  readonly beforeTopicTags: readonly string[];
  readonly afterTopicIds: readonly string[];
  readonly afterTopicTags: readonly string[];
  readonly droppedInvalidTopicIds: readonly string[];
};

export type ReleaseTaxonomySyncReport = {
  readonly releaseId: string;
  readonly scanned: number;
  readonly changed: readonly ReleaseTaxonomySyncRow[];
  readonly unchanged: number;
  readonly noCanonicalTopics: number;
};

function asStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Computes the corrected `taxonomy` for every entity in `releaseId`, without writing anything.
 * Use this to preview a sync (dry-run) or as the basis for an apply pass.
 */
export async function planReleaseTaxonomySync(
  client: Pool | PoolClient,
  releaseId: string,
): Promise<ReleaseTaxonomySyncReport> {
  const result = await client.query<{
    entity_id: string;
    taxonomy: Record<string, unknown> | null;
    classification: Record<string, unknown> | null;
  }>(
    `
    SELECT
      re.entity_id,
      re.taxonomy,
      e.kind_detail -> 'classification' AS classification
    FROM bb_public.release_entities re
    JOIN bb_canonical.entities e ON e.id = re.entity_id
    WHERE re.release_id = $1
    ORDER BY re.entity_id
    `,
    [releaseId],
  );

  const changed: ReleaseTaxonomySyncRow[] = [];
  let unchanged = 0;
  let noCanonicalTopics = 0;

  for (const row of result.rows) {
    const classification = row.classification ?? {};
    const canonicalTopicIds = asStringArray(classification.topicIds);
    const canonicalTopicTags = asStringArray(classification.topicTags);

    if (canonicalTopicIds.length === 0 && canonicalTopicTags.length === 0) {
      noCanonicalTopics += 1;
      continue;
    }

    const validTopicIds = canonicalTopicIds.filter((id) => isValidTopicId(id));
    const droppedInvalidTopicIds = canonicalTopicIds.filter((id) => !isValidTopicId(id));

    const existingTaxonomy = row.taxonomy ?? {};
    const beforeTopicIds = asStringArray(existingTaxonomy.topicIds);
    const beforeTopicTags = asStringArray(existingTaxonomy.topicTags);

    const idsMatch =
      beforeTopicIds.length === validTopicIds.length &&
      beforeTopicIds.every((id, i) => id === validTopicIds[i]);
    const tagsMatch =
      beforeTopicTags.length === canonicalTopicTags.length &&
      beforeTopicTags.every((tag, i) => tag === canonicalTopicTags[i]);

    if (idsMatch && tagsMatch) {
      unchanged += 1;
      continue;
    }

    changed.push({
      entityId: row.entity_id,
      beforeTopicIds,
      beforeTopicTags,
      afterTopicIds: validTopicIds,
      afterTopicTags: canonicalTopicTags,
      droppedInvalidTopicIds,
    });
  }

  return { releaseId, scanned: result.rows.length, changed, unchanged, noCanonicalTopics };
}

/**
 * Applies a previously computed plan: merges `topicIds`/`topicTags` into each row's existing
 * `taxonomy` jsonb, preserving any other keys already there (e.g. `notabilityLabels`) — and into
 * the two derived stores that carry the same fact.
 *
 * repo-ttlce: this used to write the `taxonomy` column ALONE. Readers never see that column —
 * `fetchPublicEntityProjection` and its siblings serve `projection`, and topic browse reads
 * `search_index.topics` — so every sync that changed an entity's topics left both of them stale,
 * and the publisher calls this on every run that touches topics. Together with the `??`
 * fallthrough in `toSearchIndexRow` that is how 2,141 live rows reached a state where the
 * taxonomy column was right, the projection was right, and the search index had nothing
 * (repo-p1m1y, measured 2026-09-12).
 *
 * BLAST RADIUS. `planReleaseTaxonomySync` scans the WHOLE release, not this run's ids, so a
 * one-entity publish can now rewrite reader-visible topics on any row whose taxonomy column
 * disagrees with canonical. That was already true of the taxonomy column; widening it to the
 * projection and the search index is what makes it reader-visible. Every such write is internally
 * consistent across the three stores, so it cannot trip the publisher's divergence check, but a
 * run that reports more changed rows than it published is doing exactly this and is not a bug.
 *
 * One statement, not three, so a row cannot end up with its taxonomy updated and its projection
 * not. The two `UPDATE`s are a single data-modifying CTE: they see the same snapshot and commit
 * or fail together, and the second one is driven by what the first actually matched rather than
 * by re-stating the key.
 *
 * Still four parameters. A fifth would be the pre-computed topics column, and it is deliberately
 * derived in SQL instead: the `CASE` below is the same rule as `searchTopicsFromProjection` in
 * `lib/projection-divergence.ts` (non-empty tags, else ids). `array_length` returns NULL rather
 * than 0 for an empty array, hence the COALESCE — without it the `CASE` would fall to the ids
 * branch by accident rather than by rule, which is the same class of mistake as the `??` this
 * bead is fixing.
 */
export async function applyReleaseTaxonomySync(
  client: Pool | PoolClient,
  releaseId: string,
  plan: ReleaseTaxonomySyncReport,
): Promise<void> {
  for (const row of plan.changed) {
    await client.query(
      `
      WITH synced AS (
        UPDATE bb_public.release_entities
        SET taxonomy = COALESCE(taxonomy, '{}'::jsonb)
          || jsonb_build_object('topicIds', $1::text[], 'topicTags', $2::text[]),
            projection = COALESCE(projection, '{}'::jsonb)
          || jsonb_build_object('topicIds', $1::text[], 'topicTags', $2::text[])
        WHERE release_id = $3 AND entity_id = $4
        RETURNING release_id, entity_id
      )
      UPDATE bb_public.search_index si
      SET topics = CASE
            WHEN COALESCE(array_length($2::text[], 1), 0) > 0 THEN $2::text[]
            ELSE $1::text[]
          END,
          facets = COALESCE(si.facets, '{}'::jsonb)
        || jsonb_build_object('topicIds', $1::text[], 'topicTags', $2::text[])
      FROM synced s
      WHERE si.release_id = s.release_id AND si.entity_id = s.entity_id
      `,
      [row.afterTopicIds, row.afterTopicTags, releaseId, row.entityId],
    );
  }
}
