/**
 * Place-like wrong-set status fixes with terminal or corrected status_history entries.
 * Ambiguous historic-but-operating rows are staged to landscape_candidates (status-review lane).
 *
 * Default dry-run. Apply fixes:
 *   DRY_RUN=0 BACKFILL_PLACE_STATUS_APPLY=1
 * Stage review candidates:
 *   DRY_RUN=0 STAGE_PLACE_STATUS_REVIEW_APPLY=1
 */
import pg from 'pg';
import { currentStatus } from '../../domain/src/entity-status.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  applyStatusFix,
  PLACE_STATUS_FIXES,
  PLACE_STATUS_FIX_ENTITY_IDS,
  STATUS_REVIEW_LANE,
  STATUS_REVIEW_PROGRAM_ID,
  statusReviewRunId,
} from './lib/status-backfill.ts';
import type { StatusHistoryEntry } from '../../domain/src/entity-status.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_PLACE_STATUS_APPLY === '1';
const STAGE_REVIEW = process.env.STAGE_PLACE_STATUS_REVIEW_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

type ReviewCandidate = {
  readonly id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly status: string | null;
};

function isCemeteryOrBurialSite(name: string): boolean {
  return /\bcemetery\b|\bburial\b|\bgraveyard\b/i.test(name);
}

async function stageReviewCandidates(
  client: pg.Client,
  candidates: readonly ReviewCandidate[],
): Promise<number> {
  const runId = statusReviewRunId();
  let inserted = 0;

  if (!DRY_RUN && STAGE_REVIEW && candidates.length > 0) {
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
    const sourceItemId = candidate.id;
    const landscapeId = `landcand_status_${candidate.id}`.replace(/[^a-zA-Z0-9_]+/g, '_').slice(0, 180);
    console.log(
      `  STAGE ${candidate.id} (${candidate.display_name}) -> lane=${STATUS_REVIEW_LANE}`,
    );

    if (DRY_RUN || !STAGE_REVIEW) continue;

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
        sourceItemId,
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

  return inserted;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const reviewCandidates = await client.query<ReviewCandidate>(
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

    console.log('=== backfill-place-status ===');
    console.log(`deterministic fixes: ${PLACE_STATUS_FIXES.length}`);

    for (const fix of PLACE_STATUS_FIXES) {
      const { rows } = await client.query<{ status_history: StatusHistoryEntry<string>[] }>(
        `SELECT status_history FROM bb_canonical.entities WHERE id = $1`,
        [fix.entityId],
      );
      const row = rows[0];
      if (!row) {
        console.log(`  SKIP missing ${fix.entityId}`);
        continue;
      }
      const nextHistory = applyStatusFix(row.status_history ?? [], fix);
      const current = currentStatus(nextHistory);
      console.log(
        `  ${fix.entityId}: ${fix.priorStatus} -> ${fix.nextStatus} (current open: ${current ?? 'none'}) — ${fix.note}`,
      );

      if (DRY_RUN || !APPLY) continue;

      await client.query(
        `UPDATE bb_canonical.entities
         SET status_history = $2::jsonb, updated_at = now()
         WHERE id = $1`,
        [fix.entityId, JSON.stringify(nextHistory)],
      );
      console.log(`  applied ${fix.entityId}`);
    }

    const ambiguous = reviewCandidates.rows.filter((candidate) => {
      if (PLACE_STATUS_FIX_ENTITY_IDS.has(candidate.id)) return false;
      if (isCemeteryOrBurialSite(candidate.display_name)) return false;
      return true;
    });

    console.log(`review-lane historic-but-operating: ${ambiguous.length}`);
    const staged = await stageReviewCandidates(client, ambiguous);

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 BACKFILL_PLACE_STATUS_APPLY=1 to apply fixes.');
    }
    if (DRY_RUN || !STAGE_REVIEW) {
      console.log(
        `Review staging dry-run (${staged} would insert). Set DRY_RUN=0 STAGE_PLACE_STATUS_REVIEW_APPLY=1 to stage.`,
      );
    } else {
      console.log(`Staged ${staged} new review rows to bb_research.landscape_candidates.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
