/**
 * Track C — weed obvious noise from bb_research.landscape_candidates before promote passes.
 * Default dry-run; apply requires DRY_RUN=0 WEED_LANDSCAPE_APPLY=1 DATABASE_URL=…
 *
 * Usage (from repo root):
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/weed-landscape-intake.ts
 *
 *   DRY_RUN=0 WEED_LANDSCAPE_APPLY=1 DATABASE_URL=postgresql://… \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/weed-landscape-intake.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  bucketWeedClassifications,
  classifyLandscapeWeed,
  type LandscapeWeedRow,
  type WeedClassification,
} from './lib/landscape-intake-weed.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_PATH = join(REPO_ROOT, '.cache/landscape-intake/weed-report.json');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.WEED_LANDSCAPE_APPLY === '1';

type DbRow = {
  readonly id: string;
  readonly lane: string;
  readonly display_name: string;
  readonly status: string;
  readonly source_category: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly canonical_url: string | null;
  readonly catalog_duplicate: boolean;
};

const SELECT_CANDIDATES = `
  SELECT
    lc.id,
    lc.lane,
    lc.display_name,
    lc.status,
    lc.provenance->>'sourceCategory' AS source_category,
    lc.lat,
    lc.lng,
    lc.canonical_url,
    EXISTS (
      SELECT 1
      FROM bb_public.release_entities p
      WHERE lc.lat IS NOT NULL
        AND lc.lng IS NOT NULL
        AND p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND (
          similarity(
            lower(regexp_replace(lc.display_name, '[^a-zA-Z0-9 ]', '', 'g')),
            lower(regexp_replace(p.display_name, '[^a-zA-Z0-9 ]', '', 'g'))
          ) > 0.6
          OR lower(regexp_replace(lc.display_name, '[^a-zA-Z0-9 ]', '', 'g'))
             = lower(regexp_replace(p.display_name, '[^a-zA-Z0-9 ]', '', 'g'))
        )
        AND abs(lc.lat - p.lat) < 0.01
        AND abs(lc.lng - p.lng) < 0.01
    ) AS catalog_duplicate
  FROM bb_research.landscape_candidates lc
  WHERE lc.status = 'pending'
  ORDER BY lc.lane, lc.id
`;

function toLandscapeRow(row: DbRow): LandscapeWeedRow {
  return {
    id: row.id,
    lane: row.lane,
    displayName: row.display_name,
    status: row.status,
    sourceCategory: row.source_category,
    lat: row.lat,
    lng: row.lng,
    canonicalUrl: row.canonical_url,
  };
}

function weedProvenancePatch(classification: WeedClassification): Record<string, unknown> {
  return {
    weedTrack: 'C',
    weedRule: classification.ruleId,
    weedReason: classification.reason,
    weedAt: new Date().toISOString(),
  };
}

async function applyWeed(
  client: pg.PoolClient,
  rowId: string,
  classification: WeedClassification,
): Promise<void> {
  if (classification.action === 'leave' || classification.targetStatus === undefined) return;
  await client.query(
    `UPDATE bb_research.landscape_candidates
     SET status = $2,
         provenance = provenance || $3::jsonb,
         updated_at = now()
     WHERE id = $1 AND status = 'pending'`,
    [rowId, classification.targetStatus, JSON.stringify(weedProvenancePatch(classification))],
  );
}

function renderTriageTable(buckets: ReturnType<typeof bucketWeedClassifications>): string {
  const lines = [
    '| Action | Count | Reason |',
    '| --- | ---: | --- |',
    ...buckets.map(
      (bucket) => `| ${bucket.action} (${bucket.ruleId}) | ${bucket.count} | ${bucket.reason} |`,
    ),
  ];
  return lines.join('\n');
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('DATABASE_URL (or APP_DATABASE_URL) is required');
    process.exit(2);
  }

  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    max: 2,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });

  const client = await pool.connect();
  try {
    const { rows } = await client.query<DbRow>(SELECT_CANDIDATES);
    const classified = rows.map((row) => {
      const classification = classifyLandscapeWeed({
        row: toLandscapeRow(row),
        catalogDuplicate: row.catalog_duplicate,
      });
      return classification ? { id: row.id, classification } : null;
    }).filter((entry): entry is { id: string; classification: WeedClassification } => entry !== null);

    const buckets = bucketWeedClassifications(classified);
    const actionable = classified.filter(
      (entry) => entry.classification.action !== 'leave',
    );
    const weeded = actionable.filter((entry) => entry.classification.action === 'dead_letter');
    const parked = actionable.filter((entry) => entry.classification.action === 'park');
    const leftForTrackB = classified.filter((entry) => entry.classification.action === 'leave');
    const untouched = rows.length - classified.length;

    const quarantineCount = (
      await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM bb_research.model_output_quarantine`,
      )
    ).rows[0]?.n ?? '0';
    const graylistCount = (
      await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM bb_ops.discovery_graylist`,
      )
    ).rows[0]?.n ?? '0';

    const report = {
      generatedAt: new Date().toISOString(),
      dryRun: DRY_RUN || !APPLY,
      pendingBefore: rows.length,
      weeded: weeded.length,
      parked: parked.length,
      leftForTrackB: leftForTrackB.length,
      untouchedEnrichmentReady: untouched,
      modelOutputQuarantine: Number(quarantineCount),
      discoveryGraylist: Number(graylistCount),
      buckets,
    };

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

    console.log('=== Track C — landscape intake weed ===');
    console.log(`Pending scanned: ${rows.length}`);
    console.log(`Weed actions (dead_letter): ${weeded.length}`);
    console.log(`Park actions (quarantined): ${parked.length}`);
    console.log(`Left for Track B: ${leftForTrackB.length}`);
    console.log(`Untouched (enrichment-ready): ${untouched}`);
    console.log(`model_output_quarantine: ${quarantineCount}`);
    console.log(`discovery_graylist: ${graylistCount}`);
    console.log('');
    console.log(renderTriageTable(buckets));
    console.log('');
    console.log(`Report: ${REPORT_PATH}`);

    if (DRY_RUN) {
      console.log('DRY_RUN=1 (default): no database writes. Set DRY_RUN=0 WEED_LANDSCAPE_APPLY=1 to apply.');
      return;
    }
    if (!APPLY) {
      console.error('Refusing to write: set WEED_LANDSCAPE_APPLY=1 with DRY_RUN=0');
      process.exit(2);
    }

    await client.query('BEGIN');
    for (const entry of actionable) {
      await applyWeed(client, entry.id, entry.classification);
    }
    await client.query('COMMIT');
    console.log(`Applied ${actionable.length} weed updates.`);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
