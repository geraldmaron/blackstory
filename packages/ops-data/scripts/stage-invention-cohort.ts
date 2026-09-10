/**
 * Stage the invention cohort as landscape candidates so the incremental publisher
 * can admit them. Does not publish. Dry-run unless DRY_RUN=0 and APPLY=1.
 *
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx packages/ops-data/scripts/stage-invention-cohort.ts
 *   DRY_RUN=0 APPLY=1 node --conditions development --import tsx packages/ops-data/scripts/stage-invention-cohort.ts
 */
import pg from 'pg';
import { validateInventionCohort } from './lib/invention-cohort-validate.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { INVENTION_COHORT } from './data/invention-cohort.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.APPLY === '1';
const RUN_ID = 'run_invention_cohort_2026_09';
const PROGRAM_ID = 'invention-cohort';
const LANE = 'invention-cohort';

/**
 * What a re-stage does to a candidate's review status.
 *
 * Re-staging is how a corrected record reaches readers, so a row whose content actually moved
 * has to go back to `pending` and be looked at again. A row that did not move must not: resetting
 * an accepted candidate that nobody edited would drop already-published records back into the
 * review queue every time one sibling in the cohort is corrected, and the queue would stop
 * meaning anything.
 *
 * The comparison is `IS DISTINCT FROM` rather than `<>` so a null on either side compares as a
 * difference instead of swallowing the row. `payload` is jsonb, whose key order is normalized by
 * the type, so an unchanged payload compares equal however the script serialized it.
 */
const STATUS_ON_CONFLICT = `CASE
             WHEN landscape_candidates.display_name IS DISTINCT FROM EXCLUDED.display_name
               OR landscape_candidates.summary IS DISTINCT FROM EXCLUDED.summary
               OR landscape_candidates.canonical_url IS DISTINCT FROM EXCLUDED.canonical_url
               OR landscape_candidates.lat IS DISTINCT FROM EXCLUDED.lat
               OR landscape_candidates.lng IS DISTINCT FROM EXCLUDED.lng
               OR landscape_candidates.provenance IS DISTINCT FROM EXCLUDED.provenance
               OR landscape_candidates.payload IS DISTINCT FROM EXCLUDED.payload
             THEN 'pending'
             ELSE landscape_candidates.status
           END`;

/**
 * Refuse to stage a cohort with a mechanical defect.
 *
 * Every problem is reported at once rather than throwing on the first, so an author fixing a
 * batch gets the whole list from one run.
 */
function assertCohortValid(): void {
  const problems = validateInventionCohort(INVENTION_COHORT);
  if (problems.length > 0) {
    throw new Error(
      `invention cohort has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`,
    );
  }
}

async function main(): Promise<void> {
  assertCohortValid();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString);
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();
  try {
    console.log(`invention cohort: ${INVENTION_COHORT.length} records`);
    console.log(DRY_RUN || !APPLY ? 'dry-run' : 'apply');

    if (!DRY_RUN && APPLY) {
      await client.query(
        `INSERT INTO bb_research.source_program_runs
          (id, lane, source_program_id, source_program_name, retrieved_at, rows_fetched, candidate_count, summary, updated_at)
         VALUES ($1, 'other', $2, $3, now(), $4, $4, $5::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET
           rows_fetched = EXCLUDED.rows_fetched,
           candidate_count = EXCLUDED.candidate_count,
           summary = EXCLUDED.summary,
           updated_at = now()`,
        [
          RUN_ID,
          PROGRAM_ID,
          'Invention cohort',
          INVENTION_COHORT.length,
          JSON.stringify({ lane: LANE, kind: 'invention' }),
        ],
      );
    }

    for (const row of INVENTION_COHORT) {
      console.log(`  ${row.id}  ${row.summary.length}c  ${row.displayName}`);
      if (DRY_RUN || !APPLY) continue;
      await client.query(
        `INSERT INTO bb_research.landscape_candidates
          (id, run_id, lane, source_program_id, source_item_id, display_name, kind, summary,
           lat, lng, canonical_url, research_lane_only, status, provenance, payload, discovered_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'invention',$7,$8,$9,$10,true,'pending',$11::jsonb,$12::jsonb,now(),now())
         ON CONFLICT (lane, source_item_id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           kind = EXCLUDED.kind,
           summary = EXCLUDED.summary,
           lat = EXCLUDED.lat,
           lng = EXCLUDED.lng,
           canonical_url = EXCLUDED.canonical_url,
           status = ${STATUS_ON_CONFLICT},
           provenance = EXCLUDED.provenance,
           payload = EXCLUDED.payload,
           updated_at = now()`,
        [
          row.id,
          RUN_ID,
          LANE,
          PROGRAM_ID,
          row.id,
          row.displayName,
          row.summary,
          row.lat,
          row.lng,
          row.canonicalUrl,
          JSON.stringify({
            sourceCity: row.city,
            sourceState: row.state,
            sourceCategory: 'Works',
          }),
          JSON.stringify({
            city: row.city,
            state: row.state,
            historicalContext: row.historicalContext,
            impactStatement: row.impactStatement,
            contributors: row.contributors,
            topicIds: ['invention'],
            eraBuckets: [row.era],
            confidence: 0.82,
            geocode: { precision: 'city' },
            evidenceCitations: row.evidence,
            patentNumber: row.patentNumber,
          }),
        ],
      );
    }

    console.log(INVENTION_COHORT.map((row) => row.id).join(','));
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
