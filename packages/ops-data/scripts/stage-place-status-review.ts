/**
 * Stage ambiguous historic-but-operating place rows to landscape_candidates (status-review lane).
 *
 * Default dry-run. Apply:
 *   DRY_RUN=0 STAGE_PLACE_STATUS_REVIEW_APPLY=1
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { PLACE_STATUS_FIX_ENTITY_IDS, STATUS_REVIEW_LANE, STATUS_REVIEW_PROGRAM_ID, statusReviewRunId } from './lib/status-backfill.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.STAGE_PLACE_STATUS_REVIEW_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

function isCemeteryOrBurialSite(name: string): boolean {
  return /\bcemetery\b|\bburial\b|\bgraveyard\b/i.test(name);
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const { rows } = await client.query<{
      id: string;
      display_name: string;
      kind: string;
      status: string | null;
    }>(
      `SELECT e.id, e.display_name, e.kind, (e.status_history->0->>'status') AS status
       FROM bb_canonical.entities e
       WHERE e.kind IN ('place', 'school', 'organization', 'institution')
         AND jsonb_array_length(e.status_history) = 1
         AND e.status_history->0->>'status' = 'historic'
         AND (
           e.display_name ILIKE '%museum%'
           OR e.display_name ILIKE '%central high%'
           OR e.display_name ILIKE '%wright%'
           OR e.display_name ILIKE '%historical park%'
         )
       ORDER BY e.display_name`,
    );

    const candidates = rows.filter(
      (row) => !PLACE_STATUS_FIX_ENTITY_IDS.has(row.id) && !isCemeteryOrBurialSite(row.display_name),
    );

    console.log('=== stage-place-status-review ===');
    console.log(`ambiguous candidates: ${candidates.length}`);

    const runId = statusReviewRunId();
    let inserted = 0;

    if (!DRY_RUN && APPLY && candidates.length > 0) {
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
          runId,
          STATUS_REVIEW_PROGRAM_ID,
          'Entity status integrity review',
          candidates.length,
          JSON.stringify({ lane: STATUS_REVIEW_LANE, reason: 'historic_but_operating_ambiguous' }),
        ],
      );
    }

    for (const candidate of candidates) {
      const landscapeId = `landcand_status_${candidate.id}`.replace(/[^a-zA-Z0-9_]+/g, '_').slice(0, 180);
      console.log(`  ${candidate.id} (${candidate.display_name})`);

      if (DRY_RUN || !APPLY) continue;

      const result = await client.query(
        `INSERT INTO bb_research.landscape_candidates
          (id, run_id, lane, source_program_id, source_item_id, display_name, kind, summary,
           canonical_url, research_lane_only, status, provenance, payload, discovered_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,'pending',$10::jsonb,$11::jsonb,now(),now())
         ON CONFLICT (lane, source_item_id) DO NOTHING
         RETURNING id`,
        [
          landscapeId,
          runId,
          STATUS_REVIEW_LANE,
          STATUS_REVIEW_PROGRAM_ID,
          candidate.id,
          candidate.display_name,
          candidate.kind,
          `Historic-but-operating review: ${candidate.display_name} currently ${candidate.status ?? 'unknown'}.`,
          '',
          JSON.stringify({
            entity_id: candidate.id,
            current_status: candidate.status,
            review_reason: 'historic_but_operating_ambiguous',
          }),
          JSON.stringify({
            entity_id: candidate.id,
            suggested_action: 'confirm active vs historic',
          }),
        ],
      );
      if ((result.rowCount ?? 0) > 0) inserted += 1;
    }

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 STAGE_PLACE_STATUS_REVIEW_APPLY=1 to stage.');
    } else {
      console.log(`\nStaged ${inserted} new rows to bb_research.landscape_candidates (lane=${STATUS_REVIEW_LANE}).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
