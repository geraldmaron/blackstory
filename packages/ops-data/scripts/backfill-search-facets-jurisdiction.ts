/**
 * Realign `bb_public.search_index.facets->>'jurisdictionState'` with the release projection.
 *
 * 4,100 of the 4,107 entities in the active release carry a `jurisdictionLabel` in
 * `bb_public.release_entities.projection` and nothing in the matching `search_index` facet. The
 * cost of that gap is visible on two surfaces at once. `/records` reads the search doc, so the
 * place column falls through to the literal "Place not recorded" for a record whose own entity
 * page prints a place, and the State facet offers six states with one or two records each out of
 * four thousand. Both surfaces are describing the index, not the archive.
 *
 * Despite the facet's name it holds the full jurisdiction label, not a state code. That is what
 * release-builder writes (`searchDocFor`), it is what the seven already-correct rows contain
 * ("Kendleton, Texas"), and `/records` derives the state from it with
 * `findUsStateFromJurisdictionLabel`. This script keeps that shape rather than inventing a
 * second one.
 *
 * The release projection is the authority; this only copies it onto the search doc. It invents
 * nothing and removes nothing: a row whose projection has no jurisdiction is left alone rather
 * than used to blank an existing facet. Measured before the first run, the drift is entirely
 * one-directional: 0 rows where the facet carried a jurisdiction the projection lacked, and 0
 * where both were set and disagreed. Both conditions are re-checked and reported on every run,
 * because that assumption is the only thing making a blind copy safe.
 *
 * Sibling of `backfill-search-facets-era.ts`, same shape and same guardrails.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-jurisdiction.ts
 *
 * Apply:
 *   DRY_RUN=0 BACKFILL_SEARCH_FACETS_JURISDICTION_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-jurisdiction.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_SEARCH_FACETS_JURISDICTION_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

/** Both sides are read as trimmed text, so a whitespace-only value counts as absent. */
const PROJ_JURIS = `btrim(coalesce(re.projection->>'jurisdictionLabel', ''))`;
const FACET_JURIS = `btrim(coalesce(si.facets->>'jurisdictionState', ''))`;

/**
 * Rows where the record's own projection states a jurisdiction and the served search doc does
 * not. Deliberately one-directional: an empty projection never blanks a populated facet.
 */
const STALE_PREDICATE = `
  si.release_id = r.release_id
  AND jsonb_typeof(si.facets) = 'object'
  AND ${PROJ_JURIS} <> ''
  AND ${FACET_JURIS} = ''
`;

const JOIN = `
     FROM bb_public.search_index si
     JOIN bb_public.v_active_release_id r ON r.release_id = si.release_id
     JOIN bb_public.release_entities re
       ON re.release_id = si.release_id AND re.entity_id = si.entity_id`;

async function countStale(client: pg.Client): Promise<number> {
  const { rows } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n ${JOIN} WHERE ${STALE_PREDICATE}`,
  );
  return rows[0]?.n ?? 0;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    console.log('=== Backfill search_index.facets.jurisdictionState from release projection ===');

    const total = await countStale(client);
    console.log(`Stale rows (projection has a jurisdiction, search facet empty): ${total}`);

    const { rows: byKind } = await client.query<{ kind: string; n: number }>(
      `SELECT si.kind, count(*)::int AS n ${JOIN} WHERE ${STALE_PREDICATE}
        GROUP BY 1 ORDER BY n DESC`,
    );
    for (const row of byKind) console.log(`  ${row.n}\t${row.kind}`);

    const { rows: sample } = await client.query<{
      entity_id: string;
      name: string;
      proj_juris: string;
    }>(
      `SELECT si.entity_id, si.name, ${PROJ_JURIS} AS proj_juris
       ${JOIN} WHERE ${STALE_PREDICATE} ORDER BY si.name LIMIT 5`,
    );
    console.log('Sample:');
    for (const row of sample) {
      console.log(`  ${row.name} (${row.entity_id}) → ${row.proj_juris}`);
    }

    // Guardrails. Neither is written by this script; a non-zero count means the drift is no
    // longer one-directional and the projection-as-authority assumption needs re-examining.
    const { rows: guard } = await client.query<{ facet_only: number; both_differ: number }>(
      `SELECT
         count(*) FILTER (WHERE ${PROJ_JURIS} = '' AND ${FACET_JURIS} <> '')::int AS facet_only,
         count(*) FILTER (WHERE ${PROJ_JURIS} <> '' AND ${FACET_JURIS} <> ''
                            AND ${PROJ_JURIS} IS DISTINCT FROM ${FACET_JURIS})::int AS both_differ
       ${JOIN} WHERE si.release_id = r.release_id`,
    );
    const facetOnly = guard[0]?.facet_only ?? 0;
    const bothDiffer = guard[0]?.both_differ ?? 0;
    console.log(
      `\nLeft untouched — facet has a jurisdiction but projection does not: ${facetOnly}` +
        `\nLeft untouched — both set and disagreeing: ${bothDiffer}`,
    );
    if (facetOnly > 0 || bothDiffer > 0) {
      console.log('  ^ neither case is repaired here; investigate before assuming a clean sync.');
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDry run only. Set DRY_RUN=0 BACKFILL_SEARCH_FACETS_JURISDICTION_APPLY=1 to apply.',
      );
      return;
    }

    const updated = await client.query(
      `UPDATE bb_public.search_index si
          SET facets = jsonb_set(
                si.facets,
                '{jurisdictionState}',
                to_jsonb(btrim(re.projection->>'jurisdictionLabel')),
                true
              )
         FROM bb_public.v_active_release_id r,
              bb_public.release_entities re
        WHERE re.release_id = si.release_id
          AND re.entity_id = si.entity_id
          AND ${STALE_PREDICATE}`,
    );
    console.log(`\nApplied: search_index rows updated = ${updated.rowCount ?? 0}`);
    console.log(`Remaining stale: ${await countStale(client)}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
