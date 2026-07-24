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
 * `taxonomy` jsonb, preserving any other keys already there (e.g. `notabilityLabels`).
 */
export async function applyReleaseTaxonomySync(
  client: Pool | PoolClient,
  releaseId: string,
  plan: ReleaseTaxonomySyncReport,
): Promise<void> {
  for (const row of plan.changed) {
    await client.query(
      `
      UPDATE bb_public.release_entities
      SET taxonomy = COALESCE(taxonomy, '{}'::jsonb)
        || jsonb_build_object('topicIds', $1::text[], 'topicTags', $2::text[])
      WHERE release_id = $3 AND entity_id = $4
      `,
      [row.afterTopicIds, row.afterTopicTags, releaseId, row.entityId],
    );
  }
}
