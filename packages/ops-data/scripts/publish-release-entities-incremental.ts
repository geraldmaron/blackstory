/**
 * Incremental upsert of selected entity rows into bb_public.release_entities (+ search_index).
 * Sources rows exclusively from bb_research.landscape_candidates — the IDs you pass or gated
 * landscape pending. (Fixture-catalog sourcing was removed when entity data moved to Supabase.)
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *
 *   # Dry-run gated landscape pending (default)
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/publish-release-entities-incremental.ts --from-landscape-pending
 *
 *   # Dry-run explicit IDs (resolved from landscape rows)
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/publish-release-entities-incremental.ts \
 *     --ids=dc-black-history-sites-b10,dc-black-history-sites-b11
 *
 *   # Dry-run a correction pass over an already-published lane (repo-n7p6.1): re-derives every
 *   # row in the lane regardless of status and, with --republish, doesn't skip rows already live
 *   # in the active release ('already_in_public') the way a normal new-candidate publish would.
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/publish-release-entities-incremental.ts \
 *     --lane=nrhp-black-heritage --republish
 *
 * Apply (requires explicit flag):
 *   DRY_RUN=0 INCREMENTAL_PUBLISH_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/publish-release-entities-incremental.ts --from-landscape-pending
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  buildArtifactsForEntry,
  canonicalUpsertParamsFromLandscape,
  gateLandscapePublishCandidate,
  incrementalPublishProvenancePatch,
  parseCanonicalStatusSnapshot,
  type CanonicalEntityPublishRow,
  type LandscapePublishRow,
  type PublishGateSkipReason,
  type PublishStatusLintReport,
  type ReleaseEntityUpsertRow,
  type SearchIndexUpsertRow,
} from './lib/incremental-publish.ts';
import { mergePublishStatusLintReports } from './lib/publish-status-linter.ts';
import {
  formatReleaseGraphAuditLog,
  rebuildReleaseGraphForRelease,
} from './lib/release-graph-publish.ts';
import {
  publishRegressionFailureMessage,
  runPublishRegressionGates,
} from './lib/publish-regression-gates.ts';
import { applyReleaseTaxonomySync, planReleaseTaxonomySync } from './lib/release-taxonomy-sync.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_PATH = join(REPO_ROOT, '.cache/landscape-intake/incremental-publish-report.json');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.INCREMENTAL_PUBLISH_APPLY === '1';

/**
 * All three LANDSCAPE_* queries below test release membership with
 * `re.entity_id = ANY(ARRAY[lc.id, lc.source_item_id])`. Do not "simplify" that back to
 * `(re.entity_id = lc.id OR re.entity_id = lc.source_item_id)`.
 *
 * The two forms are logically identical and the planner does not treat them the same. As an OR,
 * Postgres uses the (release_id, entity_id) primary key as an Index Only Scan but demotes the OR
 * to a Filter, so the subplan walks every entity in the active release once per candidate row.
 * Measured on 2026-08-09: subplan cost 174.17, whole-query cost 434,525, mean execution 44.8s
 * (max 50.0s) over 30,965 rows. As an array-ANY it becomes an Index Cond — subplan cost 2.86,
 * query cost 9,950, roughly 44x cheaper.
 *
 * A NULL `source_item_id` never matches under either form, so the semantics are unchanged.
 */
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
      AND re.entity_id = ANY(ARRAY[lc.id, lc.source_item_id])
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
  -- repo-n7p6.15: never publish an entity that has been merged away. An absorbed record is not a
  -- separate thing, and without this filter it republishes as one: both SCLC records and both SNCC
  -- records were live in the active release six days after they were merged, because the merge
  -- wrote merge_state and nothing on the publish path ever read it.
  AND NOT EXISTS (
    SELECT 1 FROM bb_canonical.entities me
     WHERE me.id IN (lc.id, lc.source_item_id)
       AND me.merge_state->>'status' = 'absorbed'
  )
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
      AND re.entity_id = ANY(ARRAY[lc.id, lc.source_item_id])
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

// repo-n7p6.1: a correction pass (e.g. the NRHP raw-code-leak fix) needs to re-derive every row
// in one lane regardless of status — unlike LANDSCAPE_PENDING_SQL, no `status = 'pending'` filter.
// Combine with --republish so gateLandscapePublishCandidate doesn't skip the already-accepted /
// already-published rows this is meant to correct.
const LANDSCAPE_BY_LANE_SQL = `
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
      AND re.entity_id = ANY(ARRAY[lc.id, lc.source_item_id])
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
WHERE lc.lane = $1
ORDER BY lc.id
`;

const ACTIVE_RELEASE_SQL = `SELECT release_id FROM bb_public.active_release LIMIT 1`;

const PENDING_COUNT_SQL = `
SELECT COUNT(*)::text AS n FROM bb_research.landscape_candidates WHERE status = 'pending'
`;

const CANONICAL_STATUS_BY_IDS_SQL = `
SELECT id AS entity_id, living_status, status_history, kind_detail
FROM bb_canonical.entities
WHERE id = ANY($1::text[])
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
  readonly reason: PublishGateSkipReason | 'status_linter_error';
  readonly detail: string;
};

type PreparedPublish = {
  readonly id: string;
  readonly confidence: number;
  readonly entityRow: ReleaseEntityUpsertRow;
  readonly searchRow: SearchIndexUpsertRow;
  readonly fromLandscape: boolean;
  readonly landscapeRow: LandscapePublishRow | null;
  readonly lintReport: PublishStatusLintReport;
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
  landscapeRow: LandscapePublishRow,
): Promise<void> {
  const canonical = canonicalUpsertParamsFromLandscape(landscapeRow, entityId);
  await client.query(
    `INSERT INTO bb_canonical.entities
      (id, kind, entity_class, display_name, living_status, status_history, notability_basis, sensitivity, kind_detail)
     VALUES ($1, $2, $3, $4, $5, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       living_status = CASE
         WHEN EXCLUDED.kind = 'person' THEN EXCLUDED.living_status
         ELSE bb_canonical.entities.living_status
       END,
       updated_at = now()`,
    [
      canonical.id,
      canonical.kind,
      canonical.entityClass,
      canonical.displayName,
      canonical.livingStatus,
    ],
  );
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
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly entityId: string;
  readonly fromLandscape: boolean;
  readonly canonicalStatus?: ReturnType<typeof parseCanonicalStatusSnapshot>;
  readonly allowRepublish?: boolean;
}): PreparedPublish | SkippedRow {
  if (input.fromLandscape && input.row) {
    const gate = gateLandscapePublishCandidate({
      row: input.row,
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
      allowRepublish: input.allowRepublish ?? false,
      ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
    });
    if (!gate.eligible) {
      return { id: input.entityId, reason: gate.reason, detail: gate.detail };
    }
    const built = buildArtifactsForEntry({
      entry: gate.entry,
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
      ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
    });
    if (!built.ok) {
      return {
        id: input.entityId,
        reason: built.reason,
        detail: built.reason === 'build_failed' ? built.detail : built.detail,
      };
    }
    return {
      id: input.entityId,
      confidence: gate.confidence,
      entityRow: built.entityRow,
      searchRow: built.searchRow,
      fromLandscape: true,
      landscapeRow: input.row,
      lintReport: built.lintReport,
    };
  }

  return {
    id: input.entityId,
    reason: 'build_failed',
    detail: 'no landscape row for id',
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
  const laneArg = readArg('--lane=');
  const allowRepublish = hasFlag('--republish');
  if (!fromLandscapePending && explicitIds.length === 0 && !laneArg) {
    console.error('Pass --from-landscape-pending and/or --ids=id1,id2 and/or --lane=<lane>');
    process.exit(2);
  }

  const limit = readLimit();
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

    let laneRows: LandscapePublishRow[] = [];
    if (laneArg) {
      const { rows } = await client.query<LandscapePublishRow>(LANDSCAPE_BY_LANE_SQL, [laneArg]);
      laneRows = rows;
    }

    const pendingBefore = Number(
      (await client.query<{ n: string }>(PENDING_COUNT_SQL)).rows[0]?.n ?? 0,
    );

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

    for (const row of laneRows) {
      if (toEvaluate.some((entry) => entry.entityId === row.id)) continue;
      toEvaluate.push({ entityId: row.id, row, fromLandscape: true });
    }

    for (const entityId of explicitIds) {
      if (toEvaluate.some((entry) => entry.entityId === entityId)) continue;
      const row =
        landscapeRows.find((candidate) => candidate.id === entityId) ??
        laneRows.find((candidate) => candidate.id === entityId) ??
        null;
      toEvaluate.push({ entityId, row, fromLandscape: row !== null });
    }

    const sliced = limit !== undefined ? toEvaluate.slice(0, limit) : toEvaluate;

    const canonicalRes = await client.query<CanonicalEntityPublishRow>(
      CANONICAL_STATUS_BY_IDS_SQL,
      [sliced.map((item) => item.entityId)],
    );
    const canonicalById = new Map(
      canonicalRes.rows.map((row) => [row.entity_id, parseCanonicalStatusSnapshot(row)]),
    );

    const prepared: PreparedPublish[] = [];
    const skipped: SkippedRow[] = [];
    const skipCounts = new Map<string, number>();
    const lintReports: PublishStatusLintReport[] = [];

    for (const item of sliced) {
      const result = preparePublish({
        row: item.row,
        releaseId,
        generatedAt,
        entityId: item.entityId,
        fromLandscape: item.fromLandscape,
        allowRepublish,
        ...(canonicalById.get(item.entityId) !== undefined
          ? { canonicalStatus: canonicalById.get(item.entityId) }
          : {}),
      });
      if ('reason' in result) {
        skipped.push(result);
        skipCounts.set(result.reason, (skipCounts.get(result.reason) ?? 0) + 1);
      } else {
        prepared.push(result);
        lintReports.push(result.lintReport);
      }
    }

    const lintSummary = mergePublishStatusLintReports(lintReports);

    const regressionGates = runPublishRegressionGates({
      statusLintReports: lintReports,
      projectionStatuses: prepared.map((row) => ({
        entityId: row.entityRow.entity_id,
        status: row.entityRow.projection.status as string | undefined,
        livingStatus: row.entityRow.projection.livingStatus as string | undefined,
      })),
    });
    if (regressionGates.hasErrors) {
      throw new Error(publishRegressionFailureMessage(regressionGates));
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
      statusLinter: {
        errors: lintSummary.findings.filter((finding) => finding.severity === 'error').length,
        warnings: lintSummary.findings.filter((finding) => finding.severity === 'warn').length,
        findings: lintSummary.findings.slice(0, 50),
      },
      regressionGates: {
        errors: regressionGates.findings.filter((finding) => finding.severity === 'error').length,
        warnings: regressionGates.findings.filter((finding) => finding.severity === 'warn').length,
        findings: regressionGates.findings.slice(0, 20),
      },
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
    if (lintSummary.hasWarnings) {
      console.log('');
      console.log(
        `Status linter warnings: ${lintSummary.findings.filter((f) => f.severity === 'warn').length}`,
      );
      for (const finding of lintSummary.findings
        .filter((f) => f.severity === 'warn')
        .slice(0, 10)) {
        console.log(`  [warn] ${finding.entityId}: ${finding.message}`);
      }
    }
    console.log('');
    console.log(`Report: ${REPORT_PATH}`);

    if (DRY_RUN) {
      console.log(
        'DRY_RUN=1 (default): no database writes. Set DRY_RUN=0 INCREMENTAL_PUBLISH_APPLY=1 to apply.',
      );
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
      if (row.fromLandscape && row.landscapeRow) {
        await markLandscapeAccepted(client, row.id, row.entityRow.entity_id, row.landscapeRow);
      }
    }
    await client.query('COMMIT');

    // repo-xez5.12 follow-up: taxonomy (topicIds/topicTags) lives on
    // bb_canonical.entities.kind_detail->'classification', not on whatever this run built the
    // entity row from (landscape payload / fixture) — those never carry topics. Any entity this
    // run just published that ALREADY has canonical kind_detail (e.g. re-publishing something an
    // editorial pass already tagged) would otherwise ship with the taxonomy this run computed
    // (usually blank) instead of what canonical actually knows. Re-sync from canonical
    // immediately after commit so this incremental path can't reopen the taxonomy-drop gap that
    // the one-time backfill (sync-release-taxonomy-from-canonical.ts) just fixed for the rest of
    // the release. Idempotent and cheap (single scan of the release) — safe to run every time.
    if (prepared.length > 0) {
      const taxonomyPlan = await planReleaseTaxonomySync(client, releaseId);
      if (taxonomyPlan.changed.length > 0) {
        await applyReleaseTaxonomySync(client, releaseId, taxonomyPlan);
        console.log(
          `Re-synced taxonomy from canonical for ${taxonomyPlan.changed.length} entities.`,
        );
      }

      const graphRebuild = await rebuildReleaseGraphForRelease(client, {
        releaseId,
        generatedAt,
        dryRun: false,
        enforceCoverage: process.env.ENFORCE_DECADE_COVERAGE !== '0',
      });
      for (const line of formatReleaseGraphAuditLog(graphRebuild.audit)) {
        console.log(`  graph: ${line}`);
      }
    }

    const pendingAfter = Number(
      (await client.query<{ n: string }>(PENDING_COUNT_SQL)).rows[0]?.n ?? 0,
    );
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
