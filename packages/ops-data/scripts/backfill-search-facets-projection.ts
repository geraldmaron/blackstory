/**
 * repo-2t04.16 — realign named ARRAY facet keys on `bb_public.search_index.facets` with the
 * release projection.
 *
 * Generalizes the four single-key siblings (`-era`, `-jurisdiction`, `-status`, `-confidence`),
 * which are the same query four times over with the key changed. Those still work and are left
 * alone; folding them into this one is tracked separately rather than done here, because
 * rewriting four working repair scripts is not the job that found this. New array facets should
 * come here instead of becoming a fifth copy.
 *
 * WHY A COPY AND NOT A REPUBLISH
 * The projection is already correct — this only copies it onto the search doc, so it needs no
 * builder run and cannot alter prose, claims, status or geometry. A republish would rebuild all
 * of that to fix a facet. `backfill-search-facets-era.ts` reached the same conclusion for the
 * same reason.
 *
 * THE ONE-DIRECTIONAL RULE, AND WHERE IT DOES NOT HOLD
 * A row is touched only when the projection carries a non-empty array AND the search facet is
 * empty (key absent, not an array, or a zero-length array). Two conditions are reported and
 * never written:
 *   - facet-only: the facet has values the projection lacks;
 *   - both-set-and-differing: both carry values and they disagree.
 * Measured on 2026-09-10 across the active release, `topicIds` and `mentionedEntityIds` are
 * clean on both counts, but `notabilityBasis` and `notabilityLabels` each have 52 rows where
 * both sides are set and disagree. That is the reason this script reports rather than resolves:
 * 52 records disagree about why they are in the archive, and picking a winner by script is an
 * editorial decision, not a data-sync one. Those rows are skipped and counted.
 *
 * SCOPE
 * `FACET_KEYS` and `KIND` keep a run small enough to verify. The catalog-wide population is
 * large and not all of it is this bug: `notabilityBasis` is empty on ~4,135 rows for reasons
 * that predate the incremental publisher (see repo-bsi9x, repo-kdmrc). Run scoped, check the
 * numbers, then widen.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   FACET_KEYS=topicIds,notabilityBasis,notabilityLabels KIND=invention \
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-projection.ts
 *
 * Apply:
 *   FACET_KEYS=topicIds,notabilityBasis,notabilityLabels KIND=invention \
 *   DRY_RUN=0 BACKFILL_SEARCH_FACETS_PROJECTION_APPLY=1 node --conditions development \
 *     --import tsx packages/ops-data/scripts/backfill-search-facets-projection.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_SEARCH_FACETS_PROJECTION_APPLY === '1';

/**
 * Array facets the search-doc reader can only get from `facets`.
 *
 * `mentionedEntityIds` is in the default list even though inventions publish it empty: the
 * default is what the key set means, not what one cohort happens to need, and an empty
 * projection is skipped by the stale predicate anyway.
 */
const DEFAULT_KEYS = [
  'topicIds',
  'mentionedEntityIds',
  'notabilityBasis',
  'notabilityLabels',
] as const;

/**
 * Rejects anything that is not a plain identifier. These land in SQL by interpolation, since a
 * jsonb key path cannot be a bind parameter.
 */
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/u;

function facetKeys(): readonly string[] {
  const raw = process.env.FACET_KEYS?.trim();
  const keys = raw
    ? raw
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
    : [...DEFAULT_KEYS];
  for (const key of keys) {
    if (!KEY_PATTERN.test(key))
      throw new Error(`Refusing unsafe facet key: ${JSON.stringify(key)}`);
  }
  if (keys.length === 0) throw new Error('FACET_KEYS resolved to an empty list');
  return keys;
}

function kindFilter(): string | undefined {
  const raw = process.env.KIND?.trim();
  if (!raw) return undefined;
  if (!/^[a-z_]+$/u.test(raw))
    throw new Error(`Refusing unsafe kind filter: ${JSON.stringify(raw)}`);
  return raw;
}

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

/** A non-empty JSON array at `<side>-><key>`; anything else counts as absent. */
function nonEmptyArray(side: string, key: string): string {
  return `(${side} ? '${key}' AND jsonb_typeof(${side}->'${key}') = 'array'
           AND jsonb_array_length(${side}->'${key}') > 0)`;
}

const JOIN = `
     FROM bb_public.search_index si
     JOIN bb_public.v_active_release_id r ON r.release_id = si.release_id
     JOIN bb_public.release_entities re
       ON re.release_id = si.release_id AND re.entity_id = si.entity_id`;

async function main(): Promise<void> {
  const keys = facetKeys();
  const kind = kindFilter();
  const kindClause = kind ? ` AND si.kind = '${kind}'` : '';

  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    console.log('=== Realign search_index.facets array keys from the release projection ===');
    console.log(`Keys:  ${keys.join(', ')}`);
    console.log(`Scope: ${kind ? `kind = ${kind}` : 'whole active release'}\n`);

    let totalUpdated = 0;
    for (const key of keys) {
      const projSet = nonEmptyArray('re.projection', key);
      const facetSet = nonEmptyArray('si.facets', key);
      const stale = `${projSet} AND NOT ${facetSet}`;

      const { rows } = await client.query<{
        stale: number;
        facet_only: number;
        differ: number;
      }>(
        `SELECT count(*) FILTER (WHERE ${stale})::int AS stale,
                count(*) FILTER (WHERE NOT ${projSet} AND ${facetSet})::int AS facet_only,
                count(*) FILTER (WHERE ${projSet} AND ${facetSet}
                                   AND re.projection->'${key}' IS DISTINCT FROM si.facets->'${key}')::int AS differ
         ${JOIN} WHERE si.release_id = r.release_id${kindClause}`,
      );
      const counts = rows[0] ?? { stale: 0, facet_only: 0, differ: 0 };
      console.log(
        `${key}\n  stale (projection set, facet empty): ${counts.stale}` +
          `\n  left untouched — facet set, projection empty: ${counts.facet_only}` +
          `\n  left untouched — both set and disagreeing:   ${counts.differ}`,
      );
      if (counts.differ > 0) {
        console.log('  ^ a disagreement is an editorial call, not a sync; not resolved here.');
      }

      if (DRY_RUN || !APPLY) {
        console.log('');
        continue;
      }

      const updated = await client.query(
        `UPDATE bb_public.search_index si
            SET facets = jsonb_set(si.facets, '{${key}}', re.projection->'${key}', true)
           FROM bb_public.v_active_release_id r,
                bb_public.release_entities re
          WHERE re.release_id = si.release_id
            AND re.entity_id = si.entity_id
            AND si.release_id = r.release_id
            AND jsonb_typeof(si.facets) = 'object'
            AND ${stale}${kindClause}`,
      );
      totalUpdated += updated.rowCount ?? 0;
      console.log(`  applied: ${updated.rowCount ?? 0} rows\n`);
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        'Dry run only. Set DRY_RUN=0 BACKFILL_SEARCH_FACETS_PROJECTION_APPLY=1 to apply.',
      );
      return;
    }
    console.log(`Total rows updated: ${totalUpdated}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
