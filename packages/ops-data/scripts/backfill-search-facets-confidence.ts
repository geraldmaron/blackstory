/**
 * Backfill `bb_public.search_index.facets.confidenceTier` from release projection claims.
 *
 * Records evidence floors need the highest accepted-claim confidence on the search index so
 * `/records` can slim off full `release_entities` hydrate. Older rows only carry `claim_count`,
 * which must never be treated as a grade.
 *
 * Derivation matches `highestClaimConfidenceTier` in `@repo/domain` publication release-builder,
 * which in turn restates `recordConfidenceTier` in `@repo/public-contracts/evidence`: the
 * strongest claim on the record, capped unless two lineages that are allowed to corroborate
 * support it. Wikipedia and the record's own index row are not among them.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-confidence.ts
 *
 * Apply:
 *   DRY_RUN=0 BACKFILL_SEARCH_FACETS_CONFIDENCE_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-search-facets-confidence.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_SEARCH_FACETS_CONFIDENCE_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

/** The record's claims, as an array whatever the projection holds. */
const CLAIMS = `
  case when jsonb_typeof(re.projection->'claims') = 'array'
    then re.projection->'claims' else '[]'::jsonb end
`;

/**
 * Distinct citation lineages on the record.
 *
 * Mirrors `claimLineageKey` in release-builder and `citationLineageKey` in
 * `@repo/public-contracts/evidence`: subdomain prefixes dropped, the Wikipedia family collapsed
 * to one key, so a single publisher spelled several ways cannot corroborate itself.
 */
const LINEAGE_KEY = `
  case when lower(claim->>'citationSource') like '%wikipedia%'
         or lower(claim->>'citationSource') like '%wikidata%' then 'wikipedia'
    else regexp_replace(lower(btrim(claim->>'citationSource')), '^(www|en|en\\.m|m)\\.', '')
  end
`;

/** Every lineage cited, Wikipedia and provenance included. Decides graded vs `unrated`. */
const CITED_LINEAGE_COUNT = `(
  select count(distinct ${LINEAGE_KEY})
  from jsonb_array_elements(${CLAIMS}) claim
  where coalesce(btrim(claim->>'citationSource'), '') <> ''
)`;

/**
 * Lineages allowed to corroborate. Mirrors `corroboratingLineageCount` in
 * `@repo/public-contracts/evidence`: Wikipedia carries a claim but never corroborates one, and a
 * record's own index row is provenance, not a second opinion. The row states its own role in
 * `claimRole`; the predicate list is the bridge for claims published before that field existed
 * and comes out with its TypeScript twin (repo-8dmey).
 */
const CORROBORATING_LINEAGE_COUNT = `(
  select count(distinct ${LINEAGE_KEY})
  from jsonb_array_elements(${CLAIMS}) claim
  where coalesce(btrim(claim->>'citationSource'), '') <> ''
    and ${LINEAGE_KEY} <> 'wikipedia'
    and case
          when coalesce(btrim(claim->>'claimRole'), '') <> ''
            then lower(btrim(claim->>'claimRole')) <> 'record_index'
          else lower(btrim(coalesce(claim->>'predicate', '')))
               not in ('listing', 'significant for', 'documented_site')
        end
)`;

const STRONGEST_TIER = `
  case
    when exists (
      select 1 from jsonb_array_elements(${CLAIMS}) claim
      where claim->>'confidenceLevel' = 'high'
    ) then 'high'
    when exists (
      select 1 from jsonb_array_elements(${CLAIMS}) claim
      where claim->>'confidenceLevel' = 'medium'
    ) then 'medium'
    when exists (
      select 1 from jsonb_array_elements(${CLAIMS}) claim
      where claim->>'confidenceLevel' = 'low'
    ) then 'low'
    else 'unrated'
  end
`;

/**
 * Same rule as release-builder `highestClaimConfidenceTier`: the strongest claim on the record,
 * capped by corroboration. A record cited to a single lineage cannot hold the top tier, however
 * authoritative that lineage is — the bare maximum this replaced graded 4,152 of 4,167 published
 * records `high` and made the reader-facing meter meaningless (repo-ngojq).
 *
 * Corroboration then excludes two citations that are not second opinions: Wikipedia, which may
 * carry a claim but never corroborate one, and the record's own index row, which let 784 records
 * reach the top tier on one federal listing served by two agencies. Top tier is 572 records under
 * this expression, from 1,807 when any two hosts counted (repo-goyut, repo-6jizv).
 *
 * Records prefers this facet over full-entity hydrate whenever the search index carries it, so
 * this expression and the TypeScript rule have to agree or Records and Explore will show
 * different grades for the same record.
 */
const COMPUTED_TIER = `
  case
    when (${STRONGEST_TIER}) = 'unrated' then 'unrated'
    when (${CITED_LINEAGE_COUNT}) = 0 then 'unrated'
    when (${CORROBORATING_LINEAGE_COUNT}) > 1 then (${STRONGEST_TIER})
    when (${STRONGEST_TIER}) = 'high' then 'medium'
    else 'low'
  end
`;

const CURRENT_TIER = `coalesce(si.facets->>'confidenceTier', '')`;

const STALE_PREDICATE = `
  si.release_id = r.release_id
  AND jsonb_typeof(si.facets) = 'object'
  AND ${CURRENT_TIER} IS DISTINCT FROM (${COMPUTED_TIER})
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
    const before = await countStale(client);
    console.log(`stale confidenceTier facets: ${before}`);
    if (before === 0) {
      console.log('nothing to do');
      return;
    }
    if (DRY_RUN || !APPLY) {
      console.log(
        'dry run only (set DRY_RUN=0 BACKFILL_SEARCH_FACETS_CONFIDENCE_APPLY=1 to write)',
      );
      return;
    }
    const result = await client.query(
      `UPDATE bb_public.search_index si
         SET facets = jsonb_set(
           si.facets,
           '{confidenceTier}',
           to_jsonb((${COMPUTED_TIER})::text),
           true
         )
         FROM bb_public.v_active_release_id r
         JOIN bb_public.release_entities re
           ON re.release_id = r.release_id
         WHERE si.release_id = r.release_id
           AND re.entity_id = si.entity_id
           AND jsonb_typeof(si.facets) = 'object'
           AND ${CURRENT_TIER} IS DISTINCT FROM (${COMPUTED_TIER})`,
    );
    const after = await countStale(client);
    console.log(`updated rows: ${result.rowCount ?? 0}; remaining stale: ${after}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
