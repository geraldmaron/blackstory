/**
 * Stage the four missing inventors as landscape candidates so the incremental publisher can
 * admit them.
 *
 * `personReviewApproved` in ./lib/incremental-publish.ts blocks every person row from
 * incremental publish until `payload.personReview` carries approved/approvedBy/approvedAt/basis.
 * This script records that marker, and the `basis` it records is the per-record `reviewBasis`
 * string — a named death date and where it is published — rather than a bare "reviewed". All
 * four subjects died between 1806 and 2015, so there is no living-person privacy interest to
 * weigh; the gate exists to catch the case where there is one, and it still does.
 *
 * `approvedBy` comes from PERSON_REVIEW_APPROVED_BY so the approval stays attributable to
 * whoever ran the apply, not to the file.
 *
 * Dry-run unless DRY_RUN=0 and APPLY=1.
 *
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx packages/ops-data/scripts/stage-inventor-cohort.ts
 *   DRY_RUN=0 APPLY=1 node --conditions development --import tsx packages/ops-data/scripts/stage-inventor-cohort.ts
 */
import pg from 'pg';
import { SUMMARY_MAX_CHARS, SUMMARY_MIN_CHARS } from './lib/entity-enrichment-llm.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { INVENTOR_COHORT } from './data/inventor-cohort.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.APPLY === '1';
const APPROVED_BY = process.env.PERSON_REVIEW_APPROVED_BY?.trim() || '';
const RUN_ID = 'run_inventor_cohort_2026_09';
const PROGRAM_ID = 'inventor-cohort';
const LANE = 'inventor-cohort';

function assertCohortBounds(): void {
  if (!DRY_RUN && APPLY && APPROVED_BY.length === 0) {
    // An approval with nobody's name on it is not a review. Fail before writing rather than
    // publishing four person rows whose recorded approver is the empty string.
    throw new Error(
      'PERSON_REVIEW_APPROVED_BY is required to apply (it is recorded as the approver)',
    );
  }
  for (const row of INVENTOR_COHORT) {
    if (row.summary.length < SUMMARY_MIN_CHARS || row.summary.length > SUMMARY_MAX_CHARS) {
      throw new Error(
        `${row.id} summary length ${row.summary.length} outside ${SUMMARY_MIN_CHARS}..${SUMMARY_MAX_CHARS}`,
      );
    }
    if (row.historicalContext.trim().length === 0) {
      throw new Error(`${row.id} is missing historicalContext`);
    }
    if (row.evidence.length === 0) {
      throw new Error(`${row.id} has no evidence citation`);
    }
  }
}

async function main(): Promise<void> {
  assertCohortBounds();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString);
  const client = new pg.Client({ connectionString: cs, ...(ssl ? { ssl } : {}) });
  await client.connect();
  try {
    console.log(`inventor cohort: ${INVENTOR_COHORT.length} records`);
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
          'Inventor cohort',
          INVENTOR_COHORT.length,
          JSON.stringify({ lane: LANE, kind: 'person' }),
        ],
      );
    }

    for (const row of INVENTOR_COHORT) {
      console.log(
        `  ${row.id}  ${row.summary.length}c  ${row.displayName}  (${row.namedOn.join(', ')})`,
      );
      if (DRY_RUN || !APPLY) continue;
      await client.query(
        `INSERT INTO bb_research.landscape_candidates
          (id, run_id, lane, source_program_id, source_item_id, display_name, kind, summary,
           lat, lng, canonical_url, research_lane_only, status, provenance, payload, discovered_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'person',$7,$8,$9,$10,true,'pending',$11::jsonb,$12::jsonb,now(),now())
         ON CONFLICT (lane, source_item_id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           kind = EXCLUDED.kind,
           summary = EXCLUDED.summary,
           lat = EXCLUDED.lat,
           lng = EXCLUDED.lng,
           canonical_url = EXCLUDED.canonical_url,
           status = 'pending',
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
            sourceCategory: 'People',
          }),
          JSON.stringify({
            city: row.city,
            state: row.state,
            historicalContext: row.historicalContext,
            topicIds: ['invention'],
            eraBuckets: [row.era],
            confidence: 0.82,
            geocode: { precision: 'city' },
            evidenceCitations: row.evidence,
            namedOn: row.namedOn,
            personReview: {
              approved: true,
              approvedBy: APPROVED_BY,
              approvedAt: new Date().toISOString(),
              basis: row.reviewBasis,
            },
          }),
        ],
      );
    }

    console.log(INVENTOR_COHORT.map((row) => row.id).join(','));
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
