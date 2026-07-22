/**
 * Track B — DB-only dedup for bb_research.landscape_candidates vs active release.
 * Phase 1: exact-ID catalog dupes → accepted (no republish).
 * Phase 2: name-overlap catalog_enrich → merged + provenance link (no new pins).
 * Leaves clean pending untouched.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/dedup-landscape-track-b.ts
 *
 * Apply exact-ID dedup:
 *   DRY_RUN=0 DEDUP_LANDSCAPE_APPLY=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/dedup-landscape-track-b.ts
 *
 * Apply catalog-enrich (name-overlap merge/link only):
 *   DRY_RUN=0 CATALOG_ENRICH_APPLY=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/dedup-landscape-track-b.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_PATH = join(REPO_ROOT, '.cache/landscape-intake/track-b-dedup-report.json');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY_DEDUP = process.env.DEDUP_LANDSCAPE_APPLY === '1';
const APPLY_CATALOG_ENRICH = process.env.CATALOG_ENRICH_APPLY === '1';

/** Name-overlap intake → existing release entity (no second pin). */
const CATALOG_ENRICH_PAIRS: Readonly<Record<string, string>> = {
  'dc-black-history-sites-i31': 'ent_15th_st_church_001',
  'dc-black-history-sites-l3': 'ent_howard_theatre_dc_001',
  'dc-black-history-sites-s14': 'gap_national_mall',
  'dc-black-history-sites-i104': 'gap_university_of_the_district_of_columbia',
  'us-ed-hbcu-131399': 'gap_university_of_the_district_of_columbia',
  'us-ed-hbcu-140571': 'gap_morris_brown_college',
  'us-ed-hbcu-176406': 'gap_tougaloo_college',
  'us-ed-hbcu-177940': 'ent_lincoln_university_pa_001',
  'us-ed-hbcu-199157': 'gap_north_carolina_central_university',
  'us-ed-hbcu-218733': 'gap_south_carolina_state_university',
};

/** Already promoted live — skip writes even if still pending (should be accepted). */
const PROMOTED_LIVE_IDS = new Set([
  'dc-black-history-sites-b16',
  'dc-black-history-sites-b3',
  'dc-black-history-sites-b8',
  'dc-black-history-sites-c10',
  'dc-black-history-sites-c24',
  'dc-black-history-sites-c4',
  'dc-black-history-sites-c6',
  'dc-black-history-sites-c7',
  'dc-black-history-sites-i1',
  'dc-black-history-sites-i101',
  'dc-black-history-sites-i105',
  'dc-black-history-sites-i17',
  'dc-black-history-sites-i38',
  'dc-black-history-sites-i57',
  'dc-black-history-sites-i6',
  'dc-black-history-sites-i68',
  'dc-black-history-sites-i95',
  'dc-black-history-sites-ps11',
  'dc-black-history-sites-s10',
  'dc-black-history-sites-s18',
  'dc-black-history-sites-s8',
]);

type PendingRow = {
  readonly id: string;
  readonly lane: string;
  readonly display_name: string;
  readonly source_item_id: string;
  readonly exact_in_release: boolean;
  readonly name_overlap: boolean;
  readonly matched_entity_id: string | null;
};

const CLASSIFY_SQL = `
WITH active AS (
  SELECT release_id FROM bb_public.active_release LIMIT 1
),
pending AS (
  SELECT
    lc.id,
    lc.lane,
    lc.display_name,
    lc.source_item_id
  FROM bb_research.landscape_candidates lc
  WHERE lc.status = 'pending'
),
exact AS (
  SELECT p.id
  FROM pending p
  CROSS JOIN active a
  JOIN bb_public.release_entities re
    ON re.release_id = a.release_id
    AND (re.entity_id = p.id OR re.entity_id = p.source_item_id)
)
SELECT
  p.id,
  p.lane,
  p.display_name,
  p.source_item_id,
  EXISTS (SELECT 1 FROM exact e WHERE e.id = p.id) AS exact_in_release,
  EXISTS (
    SELECT 1
    FROM active a
    JOIN bb_public.release_entities re
      ON re.release_id = a.release_id
    WHERE lower(re.display_name) = lower(p.display_name)
      AND p.id NOT IN (SELECT id FROM exact)
  ) AS name_overlap,
  (
    SELECT re.entity_id
    FROM active a
    JOIN bb_public.release_entities re
      ON re.release_id = a.release_id
    WHERE re.entity_id = p.id OR re.entity_id = p.source_item_id
    LIMIT 1
  ) AS matched_entity_id
FROM pending p
ORDER BY p.lane, p.id
`;

const NAME_OVERLAP_DETAIL_SQL = `
WITH active AS (
  SELECT release_id FROM bb_public.active_release LIMIT 1
),
exact AS (
  SELECT lc.id
  FROM bb_research.landscape_candidates lc
  CROSS JOIN active a
  JOIN bb_public.release_entities re
    ON re.release_id = a.release_id
    AND (re.entity_id = lc.id OR re.entity_id = lc.source_item_id)
  WHERE lc.status = 'pending'
)
SELECT
  lc.id AS candidate_id,
  lc.display_name AS candidate_name,
  re.entity_id AS release_entity_id,
  re.display_name AS release_display_name
FROM bb_research.landscape_candidates lc
CROSS JOIN active a
JOIN bb_public.release_entities re
  ON re.release_id = a.release_id
  AND lower(re.display_name) = lower(lc.display_name)
WHERE lc.status = 'pending'
  AND lc.id NOT IN (SELECT id FROM exact)
ORDER BY lc.display_name, lc.id
`;

function dedupProvenancePatch(matchedEntityId: string | null): Record<string, unknown> {
  const at = new Date().toISOString();
  return {
    dedup_already_in_public: at,
    dedupReason: 'dedup_already_in_public',
    dedupAt: at,
    ...(matchedEntityId ? { matchedReleaseEntityId: matchedEntityId } : {}),
  };
}

function catalogEnrichProvenancePatch(releaseEntityId: string): Record<string, unknown> {
  const at = new Date().toISOString();
  return {
    catalog_enrich: at,
    catalogEnrichReason: 'catalog_enrich',
    catalogEnrichAt: at,
    matchedReleaseEntityId: releaseEntityId,
  };
}

type CatalogEnrichRow = {
  readonly candidate_id: string;
  readonly candidate_status: string;
  readonly candidate_name: string;
  readonly release_entity_id: string;
  readonly release_exists: boolean;
};

const CATALOG_ENRICH_VALIDATE_SQL = `
WITH active AS (
  SELECT release_id FROM bb_public.active_release LIMIT 1
),
pairs AS (
  SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(candidate_id text, release_entity_id text)
)
SELECT
  p.candidate_id,
  lc.status AS candidate_status,
  lc.display_name AS candidate_name,
  p.release_entity_id,
  EXISTS (
    SELECT 1
    FROM active a
    JOIN bb_public.release_entities re
      ON re.release_id = a.release_id
      AND re.entity_id = p.release_entity_id
  ) AS release_exists
FROM pairs p
LEFT JOIN bb_research.landscape_candidates lc ON lc.id = p.candidate_id
ORDER BY p.candidate_id
`;

async function applyAccepted(
  client: pg.PoolClient,
  rowId: string,
  matchedEntityId: string | null,
): Promise<void> {
  await client.query(
    `UPDATE bb_research.landscape_candidates
     SET status = 'accepted',
         provenance = provenance || $2::jsonb,
         updated_at = now()
     WHERE id = $1 AND status = 'pending'`,
    [rowId, JSON.stringify(dedupProvenancePatch(matchedEntityId))],
  );
}

async function applyCatalogEnrich(
  client: pg.PoolClient,
  candidateId: string,
  releaseEntityId: string,
): Promise<void> {
  await client.query(
    `UPDATE bb_research.landscape_candidates
     SET status = 'merged',
         provenance = provenance || $2::jsonb,
         updated_at = now()
     WHERE id = $1 AND status = 'pending'`,
    [candidateId, JSON.stringify(catalogEnrichProvenancePatch(releaseEntityId))],
  );
}

async function runCatalogEnrichPhase(client: pg.PoolClient): Promise<{
  merged: number;
  skipped: number;
  leftPending: number;
}> {
  const pairPayload = Object.entries(CATALOG_ENRICH_PAIRS).map(([candidateId, releaseEntityId]) => ({
    candidate_id: candidateId,
    release_entity_id: releaseEntityId,
  }));

  const { rows } = await client.query<CatalogEnrichRow>(CATALOG_ENRICH_VALIDATE_SQL, [
    JSON.stringify(pairPayload),
  ]);

  const toMerge = rows.filter(
    (row) => row.candidate_status === 'pending' && row.release_exists,
  );
  const skipped = rows.filter(
    (row) => row.candidate_status !== 'pending' || !row.release_exists,
  );

  const pendingCount = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM bb_research.landscape_candidates WHERE status = 'pending'`,
  );
  const leftPendingBefore = Number(pendingCount.rows[0]?.n ?? 0);

  console.log('=== Track B — catalog enrich (name-overlap merge/link) ===');
  console.log(`Pairs configured: ${Object.keys(CATALOG_ENRICH_PAIRS).length}`);
  console.log(`Eligible to merge: ${toMerge.length}`);
  console.log(`Skipped: ${skipped.length}`);
  console.log(`Pending before: ${leftPendingBefore}`);
  console.log('');

  if (toMerge.length > 0) {
    console.log('Merge/link (intake → release entity, no new pin):');
    for (const row of toMerge) {
      console.log(
        `  ${row.candidate_id} "${row.candidate_name}" → ${row.release_entity_id}`,
      );
    }
  }
  if (skipped.length > 0) {
    console.log('');
    console.log('Skipped:');
    for (const row of skipped) {
      const reason =
        row.candidate_status === null
          ? 'candidate not found'
          : row.candidate_status !== 'pending'
            ? `status=${row.candidate_status}`
            : !row.release_exists
              ? 'release entity missing'
              : 'unknown';
      console.log(`  ${row.candidate_id} → ${row.release_entity_id} (${reason})`);
    }
  }

  if (DRY_RUN) {
    console.log('');
    console.log(
      'DRY_RUN=1 (default): no database writes. Set DRY_RUN=0 CATALOG_ENRICH_APPLY=1 to apply.',
    );
    return {
      merged: toMerge.length,
      skipped: skipped.length,
      leftPending: leftPendingBefore,
    };
  }
  if (!APPLY_CATALOG_ENRICH) {
    console.error('Refusing to write: set CATALOG_ENRICH_APPLY=1 with DRY_RUN=0');
    process.exit(2);
  }

  await client.query('BEGIN');
  for (const row of toMerge) {
    await applyCatalogEnrich(client, row.candidate_id, row.release_entity_id);
  }
  await client.query('COMMIT');

  const statusAfter = await client.query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::text AS n
     FROM bb_research.landscape_candidates
     GROUP BY status
     ORDER BY status`,
  );
  const pendingAfter = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM bb_research.landscape_candidates WHERE status = 'pending'`,
  );
  const leftPending = Number(pendingAfter.rows[0]?.n ?? 0);

  console.log('');
  console.log('Status after apply:');
  for (const row of statusAfter.rows) {
    console.log(`  ${row.status}: ${row.n}`);
  }
  console.log(`Applied ${toMerge.length} catalog-enrich merges.`);

  return {
    merged: toMerge.length,
    skipped: skipped.length,
    leftPending,
  };
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
    if (APPLY_CATALOG_ENRICH || process.env.TRACK_B_PHASE === 'catalog_enrich') {
      const result = await runCatalogEnrichPhase(client);
      console.log('');
      console.log(
        `TRACK B ENRICH DONE | merged ${result.merged} | skipped ${result.skipped} | left_pending ${result.leftPending}`,
      );
      return;
    }

    const statusBefore = await client.query<{ status: string; n: string }>(
      `SELECT status, COUNT(*)::text AS n
       FROM bb_research.landscape_candidates
       GROUP BY status
       ORDER BY status`,
    );

    const { rows } = await client.query<PendingRow>(CLASSIFY_SQL);
    const exactDupes = rows.filter((row) => row.exact_in_release);
    const nameOverlap = rows.filter((row) => !row.exact_in_release && row.name_overlap);
    const cleanPending = rows.filter((row) => !row.exact_in_release && !row.name_overlap);

    const toAccept = exactDupes.filter((row) => !PROMOTED_LIVE_IDS.has(row.id));
    const skippedPromoted = exactDupes.filter((row) => PROMOTED_LIVE_IDS.has(row.id));

    const overlapDetail = await client.query<{
      candidate_id: string;
      candidate_name: string;
      release_entity_id: string;
      release_display_name: string;
    }>(NAME_OVERLAP_DETAIL_SQL);

    const report = {
      generatedAt: new Date().toISOString(),
      dryRun: DRY_RUN || !APPLY_DEDUP,
      statusBefore: Object.fromEntries(statusBefore.rows.map((r) => [r.status, Number(r.n)])),
      pendingTotal: rows.length,
      exactInRelease: exactDupes.length,
      toAccept: toAccept.length,
      skippedPromotedLive: skippedPromoted.length,
      nameOverlapParked: nameOverlap.length,
      cleanPendingLeft: cleanPending.length,
      acceptIds: toAccept.map((r) => r.id),
      skippedPromotedIds: skippedPromoted.map((r) => r.id),
      nameOverlap: overlapDetail.rows,
      cleanPendingSample: cleanPending.slice(0, 5).map((r) => r.id),
    };

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

    console.log('=== Track B — landscape dedup (DB-only) ===');
    console.log(`Pending scanned: ${rows.length}`);
    console.log(`Exact ID in release: ${exactDupes.length}`);
    console.log(`To accept (excl. promoted-live): ${toAccept.length}`);
    console.log(`Skipped (promoted-live, no double-write): ${skippedPromoted.length}`);
    console.log(`Name-overlap (catalog-enrich, stay pending): ${nameOverlap.length}`);
    console.log(`Clean pending (left untouched): ${cleanPending.length}`);
    console.log('');
    if (toAccept.length > 0) {
      console.log('Accept IDs:');
      for (const row of toAccept) {
        console.log(`  ${row.id} → ${row.matched_entity_id ?? row.id}`);
      }
    }
    if (overlapDetail.rows.length > 0) {
      console.log('');
      console.log('Name-overlap (enrich, not re-pin):');
      for (const row of overlapDetail.rows) {
        console.log(
          `  ${row.candidate_id} "${row.candidate_name}" ~ ${row.release_entity_id} "${row.release_display_name}"`,
        );
      }
    }
    console.log('');
    console.log(`Report: ${REPORT_PATH}`);

    if (DRY_RUN) {
      console.log('DRY_RUN=1 (default): no database writes. Set DRY_RUN=0 DEDUP_LANDSCAPE_APPLY=1 to apply.');
      return;
    }
    if (!APPLY_DEDUP) {
      console.error('Refusing to write: set DEDUP_LANDSCAPE_APPLY=1 with DRY_RUN=0');
      process.exit(2);
    }

    await client.query('BEGIN');
    for (const row of toAccept) {
      await applyAccepted(client, row.id, row.matched_entity_id);
    }
    await client.query('COMMIT');

    const statusAfter = await client.query<{ status: string; n: string }>(
      `SELECT status, COUNT(*)::text AS n
       FROM bb_research.landscape_candidates
       GROUP BY status
       ORDER BY status`,
    );
    console.log('');
    console.log('Status after apply:');
    for (const row of statusAfter.rows) {
      console.log(`  ${row.status}: ${row.n}`);
    }
    console.log(`Applied ${toAccept.length} accepted updates.`);
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
