/**
 * repo-n7p6.5 (WS5 bridge) — copies a validated WS4 draft (bb_research.entity_enrichment,
 * status='enriched', notes.draft) onto its bb_research.landscape_candidates row, in the exact
 * shape publish-release-entities-incremental.ts already knows how to read: `summary` (the DB
 * column) and `payload.historicalContext` / `payload.topicIds` / `payload.eraBuckets` /
 * `payload.keywords` (see lib/incremental-publish.ts buildReleaseSourceFromLandscape).
 *
 * This script does NOT publish anything — it only stages the landscape row. Publishing to
 * bb_public.release_entities is publish-release-entities-incremental.ts, run separately (with
 * --republish for entities already live) after reviewing this script's dry-run.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 APPLY_ENRICHMENT_TO_LANDSCAPE_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/apply-enrichment-to-landscape.ts --entity-ids=id1,id2,...
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.APPLY_ENRICHMENT_TO_LANDSCAPE_APPLY === '1';

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

const ENTITY_IDS = flag('entity-ids', '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);
const LANES = flag('lanes', '')
  .split(',')
  .map((lane) => lane.trim())
  .filter((lane) => lane.length > 0);

type EnrichedRow = {
  readonly entity_id: string;
  readonly notes: {
    readonly draft?: {
      readonly summary?: unknown;
      readonly historicalContext?: unknown;
      readonly topicIds?: unknown;
      readonly eraBuckets?: unknown;
      readonly keywords?: unknown;
    };
  };
};

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  if (ENTITY_IDS.length === 0 && LANES.length === 0) {
    throw new Error('Pass --entity-ids=id1,id2,... and/or --lanes=lane1,lane2');
  }
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  const params: unknown[] = [];
  let idClause = '';
  let laneClause = '';
  if (ENTITY_IDS.length > 0) {
    params.push(ENTITY_IDS);
    idClause = `entity_id = ANY($${params.length}::text[])`;
  }
  if (LANES.length > 0) {
    params.push(LANES);
    laneClause = `lane = ANY($${params.length}::text[])`;
  }
  const whereClause = [idClause, laneClause].filter(Boolean).join(' OR ');

  const rows = await pool.query<EnrichedRow>(
    `SELECT entity_id, notes
       FROM bb_research.entity_enrichment
      WHERE status = 'enriched' AND (${whereClause})
      ORDER BY entity_id`,
    params,
  );
  console.log(`Found ${rows.rows.length} enriched entit(ies) to stage onto landscape_candidates.`);

  const staged: {
    entityId: string;
    summaryLen: number;
    topicIds: number;
    eraBuckets: number;
    keywords: number;
  }[] = [];
  const skipped: { entityId: string; reason: string }[] = [];

  for (const row of rows.rows) {
    const draft = row.notes.draft;
    if (draft === undefined) {
      skipped.push({
        entityId: row.entity_id,
        reason: 'no draft in notes (unexpected for status=enriched)',
      });
      continue;
    }
    const summary = typeof draft.summary === 'string' ? draft.summary : undefined;
    if (summary === undefined || summary.length < 120 || summary.length > 400) {
      skipped.push({
        entityId: row.entity_id,
        reason: `summary missing or out of bounds (${summary?.length ?? 'n/a'})`,
      });
      continue;
    }
    staged.push({
      entityId: row.entity_id,
      summaryLen: summary.length,
      topicIds: Array.isArray(draft.topicIds) ? draft.topicIds.length : 0,
      eraBuckets: Array.isArray(draft.eraBuckets) ? draft.eraBuckets.length : 0,
      keywords: Array.isArray(draft.keywords) ? draft.keywords.length : 0,
    });
  }

  for (const item of staged) {
    console.log(
      `  ${item.entityId}: summary=${item.summaryLen} chars, topicIds=${item.topicIds}, ` +
        `eraBuckets=${item.eraBuckets}, keywords=${item.keywords}`,
    );
  }
  if (skipped.length > 0) {
    console.log(`\nSkipped ${skipped.length}:`);
    for (const item of skipped) console.log(`  ${item.entityId}: ${item.reason}`);
  }

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN=1 (default): no database writes. ' +
        'Set DRY_RUN=0 APPLY_ENRICHMENT_TO_LANDSCAPE_APPLY=1 to apply.',
    );
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows.rows) {
      const draft = row.notes.draft;
      if (draft === undefined) continue;
      const summary = typeof draft.summary === 'string' ? draft.summary : undefined;
      if (summary === undefined || summary.length < 120 || summary.length > 400) continue;
      await client.query(
        `UPDATE bb_research.landscape_candidates
            SET summary = $2,
                payload = payload || $3::jsonb,
                updated_at = now()
          WHERE id = $1`,
        [
          row.entity_id,
          summary,
          JSON.stringify({
            historicalContext:
              typeof draft.historicalContext === 'string' ? draft.historicalContext : undefined,
            topicIds: Array.isArray(draft.topicIds) ? draft.topicIds : undefined,
            eraBuckets: Array.isArray(draft.eraBuckets) ? draft.eraBuckets : undefined,
            keywords: Array.isArray(draft.keywords) ? draft.keywords : undefined,
          }),
        ],
      );
    }
    await client.query('COMMIT');
    console.log(`\nApplied: ${staged.length} landscape_candidates row(s) staged with WS4 drafts.`);
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
