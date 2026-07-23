/**
 * Incremental upsert of selected entity rows into bb_public.release_entities (+ search_index).
 * Never replays the full national-catalog directory — only the IDs you pass or gated landscape pending.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *
 *   # Dry-run gated landscape pending (default)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/publish-release-entities-incremental.ts --from-landscape-pending
 *
 *   # Dry-run explicit IDs (catalog fixture preferred, else landscape row)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/publish-release-entities-incremental.ts \
 *     --ids=dc-black-history-sites-b10,dc-black-history-sites-b11
 *
 * Apply (requires explicit flag):
 *   DRY_RUN=0 INCREMENTAL_PUBLISH_APPLY=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/publish-release-entities-incremental.ts --from-landscape-pending
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { ReleaseSourceEntity } from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  buildArtifactsForEntry,
  gateLandscapePublishCandidate,
  incrementalPublishProvenancePatch,
  loadCatalogEntriesById,
  type LandscapePublishRow,
  type PublishGateSkipReason,
  type ReleaseEntityUpsertRow,
  type SearchIndexUpsertRow,
} from './lib/incremental-publish.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const CATALOG_DIR = join(REPO_ROOT, 'packages/firebase/fixtures/national-catalog');
const REPORT_PATH = join(REPO_ROOT, '.cache/landscape-intake/incremental-publish-report.json');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.INCREMENTAL_PUBLISH_APPLY === '1';

const LANDSCAPE_PENDING_SQL = `
WITH active AS (
  SELECT release_id FROM bb_public.active_release LIMIT 1
)
SELECT
  lc.id,
  lc.lane,
  lc.kind,
  lc.display_name,
  lc.summary,
  lc.lat,
  lc.lng,
  lc.canonical_url,
  lc.source_item_id,
  lc.provenance,
  lc.payload,
  EXISTS (
    SELECT 1
    FROM active a
    JOIN bb_public.release_entities re
      ON re.release_id = a.release_id
      AND (re.entity_id = lc.id OR re.entity_id = lc.source_item_id)
  ) AS exact_in_release,
  EXISTS (
    SELECT 1
    FROM active a
    JOIN bb_public.release_entities re
      ON re.release_id = a.release_id
      AND lower(re.display_name) = lower(lc.display_name)
      AND re.entity_id <> lc.id
      AND re.entity_id <> lc.source_item_id
  ) AS name_overlap
FROM bb_research.landscape_candidates lc
WHERE lc.status = 'pending'
ORDER BY lc.lane, lc.id
`;

const LANDSCAPE_BY_IDS_SQL = `
WITH active AS (
  SELECT release_id FROM bb_public.active_release LIMIT 1
)
SELECT
  lc.id,
  lc.lane,
  lc.kind,
  lc.display_name,
  lc.summary,
  lc.lat,
  lc.lng,
  lc.canonical_url,
  lc.source_item_id,
  lc.provenance,
  lc.payload,
  EXISTS (
    SELECT 1
    FROM active a
    JOIN bb_public.release_entities re
      ON re.release_id = a.release_id
      AND (re.entity_id = lc.id OR re.entity_id = lc.source_item_id)
  ) AS exact_in_release,
  EXISTS (
    SELECT 1
    FROM active a
    JOIN bb_public.release_entities re
      ON re.release_id = a.release_id
      AND lower(re.display_name) = lower(lc.display_name)
      AND re.entity_id <> lc.id
      AND re.entity_id <> lc.source_item_id
  ) AS name_overlap
FROM bb_research.landscape_candidates lc
WHERE lc.id = ANY($1::text[])
ORDER BY lc.id
`;

const ACTIVE_RELEASE_SQL = `SELECT release_id FROM bb_public.active_release LIMIT 1`;

const PENDING_COUNT_SQL = `
SELECT COUNT(*)::text AS n FROM bb_research.landscape_candidates WHERE status = 'pending'
`;

function readArg(prefix: string): string | undefined {
  const hit = process.argv.find((entry) => entry.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readLimit(): number | undefined {
  const raw = readArg('--limit=');
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readIdsArg(): readonly string[] {
  const raw = readArg('--ids=');
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

type SkippedRow = {
  readonly id: string;
  readonly reason: PublishGateSkipReason;
  readonly detail: string;
};

type PreparedPublish = {
  readonly id: string;
  readonly confidence: number;
  readonly entityRow: ReleaseEntityUpsertRow;
  readonly searchRow: SearchIndexUpsertRow;
  readonly fromLandscape: boolean;
};

async function upsertEntity(client: pg.PoolClient, row: ReleaseEntityUpsertRow): Promise<void> {
  await client.query(
    `INSERT INTO bb_public.release_entities
      (release_id, entity_id, display_name, kind, summary, location, geohash, lat, lng,
       claims, taxonomy, related, projection, created_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,now())
     ON CONFLICT (release_id, entity_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       kind = EXCLUDED.kind,
       summary = EXCLUDED.summary,
       location = EXCLUDED.location,
       geohash = EXCLUDED.geohash,
       lat = EXCLUDED.lat,
       lng = EXCLUDED.lng,
       claims = EXCLUDED.claims,
       taxonomy = EXCLUDED.taxonomy,
       related = EXCLUDED.related,
       projection = EXCLUDED.projection`,
    [
      row.release_id,
      row.entity_id,
      row.display_name,
      row.kind,
      row.summary,
      JSON.stringify(row.location),
      row.geohash,
      row.lat,
      row.lng,
      JSON.stringify(row.claims),
      JSON.stringify(row.taxonomy),
      JSON.stringify(row.related),
      JSON.stringify(row.projection),
    ],
  );
}

async function upsertSearchIndex(client: pg.PoolClient, row: SearchIndexUpsertRow): Promise<void> {
  await client.query(
    `INSERT INTO bb_public.search_index
      (id, release_id, entity_id, name, name_lower, aliases, topics, kind, status, geohash,
       related_count, claim_count, facets, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,now())
     ON CONFLICT (id) DO UPDATE SET
       release_id = EXCLUDED.release_id,
       entity_id = EXCLUDED.entity_id,
       name = EXCLUDED.name,
       name_lower = EXCLUDED.name_lower,
       aliases = EXCLUDED.aliases,
       topics = EXCLUDED.topics,
       kind = EXCLUDED.kind,
       status = EXCLUDED.status,
       geohash = EXCLUDED.geohash,
       related_count = EXCLUDED.related_count,
       claim_count = EXCLUDED.claim_count,
       facets = EXCLUDED.facets`,
    [
      row.id,
      row.release_id,
      row.entity_id,
      row.name,
      row.name_lower,
      row.aliases,
      row.topics,
      row.kind,
      row.status,
      row.geohash,
      row.related_count,
      row.claim_count,
      JSON.stringify(row.facets),
    ],
  );
}

async function markLandscapeAccepted(
  client: pg.PoolClient,
  candidateId: string,
  entityId: string,
): Promise<void> {
  await client.query(
    `UPDATE bb_research.landscape_candidates
     SET status = 'accepted',
         provenance = provenance || $2::jsonb,
         updated_at = now()
     WHERE id = $1`,
    [candidateId, JSON.stringify(incrementalPublishProvenancePatch(entityId))],
  );
}

function preparePublish(input: {
  readonly row: LandscapePublishRow | null;
  readonly catalogEntry: ReleaseSourceEntity | undefined;
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly entityId: string;
  readonly fromLandscape: boolean;
}): PreparedPublish | SkippedRow {
  if (input.fromLandscape && input.row) {
    const gate = gateLandscapePublishCandidate({
      row: input.row,
      ...(input.catalogEntry ? { catalogEntry: input.catalogEntry } : {}),
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
    });
    if (!gate.eligible) {
      return { id: input.entityId, reason: gate.reason, detail: gate.detail };
    }
    const built = buildArtifactsForEntry({
      entry: gate.entry,
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
    });
    if (!built.ok) {
      return { id: input.entityId, reason: 'build_failed', detail: `${built.reason}: ${built.detail}` };
    }
    return {
      id: input.entityId,
      confidence: gate.confidence,
      entityRow: built.entityRow,
      searchRow: built.searchRow,
      fromLandscape: true,
    };
  }

  if (!input.catalogEntry) {
    return {
      id: input.entityId,
      reason: 'build_failed',
      detail: 'no catalog entry or landscape row for id',
    };
  }

  const built = buildArtifactsForEntry({
    entry: input.catalogEntry,
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
  });
  if (!built.ok) {
    return { id: input.entityId, reason: 'build_failed', detail: `${built.reason}: ${built.detail}` };
  }
  return {
    id: input.entityId,
    confidence: 1,
    entityRow: built.entityRow,
    searchRow: built.searchRow,
    fromLandscape: false,
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('DATABASE_URL (or APP_DATABASE_URL) is required');
    process.exit(2);
  }

  const fromLandscapePending = hasFlag('--from-landscape-pending');
  const explicitIds = readIdsArg();
  if (!fromLandscapePending && explicitIds.length === 0) {
    console.error('Pass --from-landscape-pending and/or --ids=id1,id2');
    process.exit(2);
  }

  const limit = readLimit();
  const catalogIndex = loadCatalogEntriesById(CATALOG_DIR);
  const generatedAt = new Date().toISOString();

  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    max: 2,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });

  const client = await pool.connect();
  try {
    const activeRes = await client.query<{ release_id: string }>(ACTIVE_RELEASE_SQL);
    const releaseId = activeRes.rows[0]?.release_id;
    if (!releaseId) {
      throw new Error('no active release pointer in bb_public.active_release');
    }

    let landscapeRows: LandscapePublishRow[] = [];
    if (fromLandscapePending) {
      const { rows } = await client.query<LandscapePublishRow>(LANDSCAPE_PENDING_SQL);
      landscapeRows = rows;
    } else if (explicitIds.length > 0) {
      const { rows } = await client.query<LandscapePublishRow>(LANDSCAPE_BY_IDS_SQL, [explicitIds]);
      landscapeRows = rows;
    }

    const pendingBefore = Number((await client.query<{ n: string }>(PENDING_COUNT_SQL)).rows[0]?.n ?? 0);

    const toEvaluate: Array<{
      readonly entityId: string;
      readonly row: LandscapePublishRow | null;
      readonly fromLandscape: boolean;
    }> = [];

    if (fromLandscapePending) {
      for (const row of landscapeRows) {
        toEvaluate.push({ entityId: row.id, row, fromLandscape: true });
      }
    }

    for (const entityId of explicitIds) {
      if (toEvaluate.some((entry) => entry.entityId === entityId)) continue;
      const row = landscapeRows.find((candidate) => candidate.id === entityId) ?? null;
      toEvaluate.push({ entityId, row, fromLandscape: row !== null });
    }

    const sliced = limit !== undefined ? toEvaluate.slice(0, limit) : toEvaluate;

    const prepared: PreparedPublish[] = [];
    const skipped: SkippedRow[] = [];
    const skipCounts = new Map<PublishGateSkipReason, number>();

    for (const item of sliced) {
      const catalogEntry = catalogIndex.get(item.entityId);
      const result = preparePublish({
        row: item.row,
        catalogEntry,
        releaseId,
        generatedAt,
        entityId: item.entityId,
        fromLandscape: item.fromLandscape,
      });
      if ('reason' in result) {
        skipped.push(result);
        skipCounts.set(result.reason, (skipCounts.get(result.reason) ?? 0) + 1);
      } else {
        prepared.push(result);
      }
    }

    const report = {
      generatedAt,
      dryRun: DRY_RUN || !APPLY,
      releaseId,
      mode: fromLandscapePending ? 'from-landscape-pending' : 'explicit-ids',
      pendingBefore,
      scanned: sliced.length,
      eligible: prepared.length,
      skipped: skipped.length,
      skipCounts: Object.fromEntries(skipCounts),
      publishedIds: prepared.map((row) => row.id),
      skippedSample: skipped.slice(0, 20),
    };

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

    console.log('=== Incremental publish (bb_public.release_entities) ===');
    console.log(`Active release: ${releaseId}`);
    console.log(`Scanned: ${sliced.length}`);
    console.log(`Eligible: ${prepared.length}`);
    console.log(`Skipped: ${skipped.length}`);
    console.log(`Pending before: ${pendingBefore}`);
    if (prepared.length > 0) {
      console.log('');
      console.log('Eligible IDs:');
      for (const row of prepared) {
        console.log(`  ${row.id} (conf=${row.confidence.toFixed(3)})`);
      }
    }
    if (skipped.length > 0) {
      console.log('');
      console.log('Skip counts:');
      for (const [reason, count] of skipCounts) {
        console.log(`  ${reason}: ${count}`);
      }
    }
    console.log('');
    console.log(`Report: ${REPORT_PATH}`);

    if (DRY_RUN) {
      console.log('DRY_RUN=1 (default): no database writes. Set DRY_RUN=0 INCREMENTAL_PUBLISH_APPLY=1 to apply.');
      console.log(
        `INCREMENTAL PUBLISH | committed: pending | published: 0 | left_pending: ${pendingBefore}`,
      );
      return;
    }
    if (!APPLY) {
      console.error('Refusing to write: set INCREMENTAL_PUBLISH_APPLY=1 with DRY_RUN=0');
      process.exit(2);
    }

    await client.query('BEGIN');
    for (const row of prepared) {
      await upsertEntity(client, row.entityRow);
      await upsertSearchIndex(client, row.searchRow);
      if (row.fromLandscape) {
        await markLandscapeAccepted(client, row.id, row.entityRow.entity_id);
      }
    }
    await client.query('COMMIT');

    const pendingAfter = Number((await client.query<{ n: string }>(PENDING_COUNT_SQL)).rows[0]?.n ?? 0);
    console.log('');
    console.log(`Applied ${prepared.length} incremental upserts.`);
    console.log(`Pending after: ${pendingAfter}`);
    console.log(
      `INCREMENTAL PUBLISH | committed: pending | published: ${prepared.length} | left_pending: ${pendingAfter}`,
    );
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
