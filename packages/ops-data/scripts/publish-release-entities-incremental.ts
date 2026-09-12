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
import type { PublicVisit, ReleaseSourceEntity } from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  assessLandscapeDepth,
  buildArtifactsForEntry,
  buildLiveDepthEntry,
  canonicalUpsertParamsFromLandscape,
  carryLiveClaims,
  claimCountRegressed,
  gateLandscapePublishCandidate,
  incrementalPublishProvenancePatch,
  liveClaimConfidence,
  liveLocationFromRow,
  parseCanonicalStatusSnapshot,
  visitOverrideFromCanonicalRow,
  type CanonicalEntityPublishRow,
  type CanonicalVisitRow,
  type LandscapePublishRow,
  type LivePublishedRow,
  type PublishGateSkipReason,
  type PublishStatusLintReport,
  type ReleaseEntityUpsertRow,
  type SearchIndexUpsertRow,
} from './lib/incremental-publish.ts';
import { mergePublishStatusLintReports } from './lib/publish-status-linter.ts';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';
import {
  formatReleaseGraphAuditLog,
  rebuildReleaseGraphForRelease,
} from './lib/release-graph-publish.ts';
import {
  publishRegressionFailureMessage,
  runPublishRegressionGates,
} from './lib/publish-regression-gates.ts';
import { assertNoProjectionDivergence } from './lib/projection-divergence.ts';
import { applyReleaseTaxonomySync, planReleaseTaxonomySync } from './lib/release-taxonomy-sync.ts';
import { applyReleaseRelatedSync, planReleaseRelatedSync } from './lib/release-related-sync.ts';

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

/**
 * Canonical visit-contact input for every entity this run is about to (re)build,
 * so a lane republish stops silently dropping the phone/website/hours/street a backfill wrote
 * onto `bb_canonical.entity_visit` / `entity_locations` — data the landscape row this run
 * rebuilds `ReleaseSourceEntity` from never carries at all.
 *
 * Mirrors the join in sync-visit-to-projection.ts (the one-off script that, until now, was the
 * only path that ever wrote `projection.visit`), anchored on the id list this run is evaluating
 * rather than on already-published `bb_public.release_entities` rows — a republish candidate may
 * not have one yet. `entity_locations` is joined LATERAL to take the most recently updated row
 * per entity, same as that script.
 */
const CANONICAL_VISIT_BY_IDS_SQL = `
SELECT ids.entity_id,
       v.phone_e164, v.phone_display, v.website, v.hours, v.visitability, v.source_ids,
       l.street, l.postal_code
  FROM UNNEST($1::text[]) AS ids(entity_id)
  LEFT JOIN bb_canonical.entity_visit v ON v.entity_id = ids.entity_id
  LEFT JOIN LATERAL (
    SELECT street, postal_code
      FROM bb_canonical.entity_locations el
     WHERE el.entity_id = ids.entity_id
       AND (el.street IS NOT NULL OR el.postal_code IS NOT NULL)
     ORDER BY el.updated_at DESC
     LIMIT 1
  ) l ON true
 WHERE v.entity_id IS NOT NULL OR l.street IS NOT NULL OR l.postal_code IS NOT NULL
`;

/**
 * repo-b4ad: what is CURRENTLY published for these entities, so the depth gate can ask the
 * non-regression question ("is this better than what readers see?") instead of the admission
 * question ("is this good enough to publish at all?") for a record that is already live.
 *
 * Only the three columns `assessLandscapeDepth` reads — see `buildLiveDepthEntry`. Scoped to the
 * ACTIVE release: a row from a superseded release is not what any reader is looking at, and
 * treating it as the live baseline would compare the candidate against text nobody can see.
 */
const LIVE_PUBLISHED_BY_IDS_SQL = `
SELECT e.entity_id, e.summary, e.claims, e.projection
FROM bb_public.release_entities e
JOIN bb_public.active_release a ON a.release_id = e.release_id
WHERE e.entity_id = ANY($1::text[])
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

/**
 * The decade-coverage floor this publish accepts, as a percentage.
 *
 * Coverage is research completeness, not build integrity (see assertReleaseGraphAuditOrThrow).
 * Withdrawing designation dates that were never eras took real coverage to ~49%, so a fixed 90%
 * bar can now only be cleared by publishing dates the sources do not support. The floor stays 90
 * by default and still fails closed; going below it requires stating the number, which is echoed
 * to the log and stored in the report so the decision is visible after the fact.
 */
function readMinDecadeCoverage(): number | undefined {
  const raw = readArg('--min-decade-coverage=');
  if (raw === undefined) return undefined;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    console.error(`--min-decade-coverage must be a percentage between 0 and 100 (got "${raw}")`);
    process.exit(2);
  }
  return parsed;
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
  /**
   * repo-lai8y: this record's coordinates came from what it already publishes, not from its
   * landscape row. Reported per id so a coordinate with no visible lineage on the landscape row
   * is never silent — the one real objection to inheriting a location is that an auditor later
   * cannot tell where the point came from.
   */
  readonly locationInherited?: boolean;
};

/** Reads one string field out of a stored projection, whose static type is `unknown` jsonb. */
function projectionString(projection: unknown, key: string): string | undefined {
  if (projection === null || typeof projection !== 'object') return undefined;
  const value = (projection as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

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
  /** The active-release row for this entity, when it is already live (repo-b4ad). */
  readonly livePublished?: LivePublishedRow;
  /** Raw canonical visit-contact input for this entity, when one exists. */
  readonly visitOverride?: PublicVisit;
}): PreparedPublish | SkippedRow {
  if (input.fromLandscape && input.row) {
    // Computed here rather than in the batch load because the verdict needs the candidate row's
    // canonical_url: `assessLandscapeDepth` counts a claim as independent evidence only when it
    // cites a document OTHER than the record's own registry index entry.
    const liveDepth =
      input.livePublished === undefined
        ? undefined
        : assessLandscapeDepth(buildLiveDepthEntry(input.livePublished), input.row);
    const liveConfidence =
      input.livePublished === undefined ? undefined : liveClaimConfidence(input.livePublished);
    // repo-lai8y: the location this record already publishes, for the gate's regression clause on
    // a landscape row that never carried coordinates. Read off the same live row as the depth and
    // confidence verdicts above.
    const liveLocation =
      input.livePublished === undefined ? undefined : liveLocationFromRow(input.livePublished);
    const gate = gateLandscapePublishCandidate({
      row: input.row,
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
      allowRepublish: input.allowRepublish ?? false,
      ...(liveDepth !== undefined ? { liveDepth } : {}),
      ...(liveConfidence !== undefined ? { liveConfidence } : {}),
      ...(liveLocation !== undefined ? { liveLocation } : {}),
      ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
      ...(input.visitOverride !== undefined ? { visitOverride: input.visitOverride } : {}),
    });
    if (!gate.eligible) {
      return { id: input.entityId, reason: gate.reason, detail: gate.detail };
    }
    // A landscape row proves what a candidate can prove today, not what the record has
    // accumulated, so building claims from it alone drops every separately-cited fact the record
    // already publishes. The union keeps both; the regression check below is its control, not a
    // second implementation (repo-cjlkp).
    const carry = carryLiveClaims(gate.entry.claims ?? [], input.livePublished);
    const entry: ReleaseSourceEntity = { ...gate.entry, claims: carry.claims };
    if (claimCountRegressed(carry.claims, input.livePublished)) {
      return {
        id: input.entityId,
        reason: 'claim_count_regression',
        detail: `republish would publish ${carry.claims.length} claims where ${carry.liveCount} are live`,
      };
    }
    const built = buildArtifactsForEntry({
      entry,
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
      ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
      ...(input.visitOverride !== undefined ? { visitOverride: input.visitOverride } : {}),
      // Forwarded, not re-derived: the gate already decided this record's location and this build
      // must produce the row the gate approved (`matchMethod` lives only here).
      ...(gate.locationOverride !== undefined ? { locationOverride: gate.locationOverride } : {}),
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
      ...(gate.locationOverride !== undefined ? { locationInherited: true } : {}),
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
  const minDecadeCoverage = readMinDecadeCoverage();
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

    const canonicalVisitRes = await client.query<{ entity_id: string } & CanonicalVisitRow>(
      CANONICAL_VISIT_BY_IDS_SQL,
      [sliced.map((item) => item.entityId)],
    );
    const canonicalVisitById = new Map(canonicalVisitRes.rows.map((row) => [row.entity_id, row]));

    const liveRes = await client.query<LivePublishedRow & { readonly entity_id: string }>(
      LIVE_PUBLISHED_BY_IDS_SQL,
      [sliced.map((item) => item.entityId)],
    );
    const livePublishedById = new Map(liveRes.rows.map((row) => [row.entity_id, row]));

    const prepared: PreparedPublish[] = [];
    const skipped: SkippedRow[] = [];
    const skipCounts = new Map<string, number>();
    const lintReports: PublishStatusLintReport[] = [];

    for (const item of sliced) {
      const canonicalVisitRow = canonicalVisitById.get(item.entityId);
      const visitOverride =
        item.row && canonicalVisitRow
          ? visitOverrideFromCanonicalRow(item.row, canonicalVisitRow)
          : undefined;
      const livePublished = livePublishedById.get(item.entityId);
      const canonicalStatus = canonicalById.get(item.entityId);
      const result = preparePublish({
        row: item.row,
        releaseId,
        generatedAt,
        entityId: item.entityId,
        fromLandscape: item.fromLandscape,
        allowRepublish,
        ...(livePublished !== undefined ? { livePublished } : {}),
        ...(canonicalStatus !== undefined ? { canonicalStatus } : {}),
        ...(visitOverride !== undefined ? { visitOverride } : {}),
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
      projectionStatuses: prepared.map((row) => {
        const status = projectionString(row.entityRow.projection, 'status');
        const livingStatus = projectionString(row.entityRow.projection, 'livingStatus');
        return {
          entityId: row.entityRow.entity_id,
          ...(status !== undefined ? { status } : {}),
          ...(livingStatus !== undefined ? { livingStatus } : {}),
        };
      }),
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
      // Full list, not a sample: see `PreparedPublish.locationInherited`.
      locationInheritedIds: prepared.filter((row) => row.locationInherited).map((row) => row.id),
      skippedSample: skipped.slice(0, 20),
      // Recorded so an accepted coverage floor is auditable after the fact, not just a flag
      // someone typed once.
      decadeCoverageFloorPct: minDecadeCoverage ?? 90,
      decadeCoverageFloorAcknowledged: minDecadeCoverage !== undefined,
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

      // repo-66mv1: ReleaseSourceEntity carries no relationship edges, so every row this run
      // rebuilt from source just wrote `related: []` — a republish silently stripped the
      // connections off already-live records and the "How this record connects" beat vanished.
      // Re-derive from canonical here, after the commit, so co-published neighbors are visible
      // to the both-endpoints-released join, and before the graph rebuild below, which reads
      // projection.related. This is the same shape as the taxonomy re-sync above and for the same
      // reason: canonical knows something the source row never carried.
      const relatedPlan = await planReleaseRelatedSync(client, releaseId);
      if (relatedPlan.changed.length > 0) {
        await applyReleaseRelatedSync(client, releaseId, relatedPlan);
        console.log(
          `Re-synced related[] from canonical edges for ${relatedPlan.changed.length} entities` +
            `${relatedPlan.repaired > 0 ? ` (${relatedPlan.repaired} had no connections at all)` : ''}.`,
        );
      }

      const enforceCoverage = process.env.ENFORCE_DECADE_COVERAGE !== '0';
      console.log(
        enforceCoverage
          ? `  graph: decade coverage floor ${minDecadeCoverage ?? 90}%` +
              `${minDecadeCoverage === undefined ? ' (default)' : ' (acknowledged via --min-decade-coverage)'}`
          : '  graph: decade coverage NOT ENFORCED (ENFORCE_DECADE_COVERAGE=0)',
      );
      const graphRebuild = await rebuildReleaseGraphForRelease(client, {
        releaseId,
        generatedAt,
        dryRun: false,
        enforceCoverage,
        ...(minDecadeCoverage !== undefined ? { minDecadeCoveragePct: minDecadeCoverage } : {}),
      });
      for (const line of formatReleaseGraphAuditLog(graphRebuild.audit)) {
        console.log(`  graph: ${line}`);
      }

      // Everything above this line wrote derived copies — the release_entities columns, the
      // search_index row, the two post-commit re-syncs — of facts readers only ever get from
      // `projection`. Measure the rows this run touched against it rather than assuming.
      //
      // FATAL since repo-ttlce. This reported instead of throwing for one stated reason:
      // `applyReleaseTaxonomySync` wrote the taxonomy column without the projection or the search
      // index, so a throw would have aborted every publish that touches topics over a defect the
      // run did not introduce. That write path now updates all three in one statement, so a
      // divergence reported here is this run's own — and every previous time these stores drifted
      // it was silent, which is the whole argument for failing loudly instead.
      //
      // It examines only the ids this run prepared (`PROJECTION_DIVERGENCE_SQL` filters on them),
      // so the 1,729 rows repo-p1m1y is still repairing cannot trip it.
      //
      // The upserts are ALREADY COMMITTED when this runs — the commit is what makes the derived
      // copies readable to compare. So this does not undo the publish and the message must not
      // imply it did; it stops the run before the artifact-republish reminder, which is the next
      // thing an operator would act on, and exits non-zero.
      try {
        await assertNoProjectionDivergence(
          client,
          prepared.map((row) => row.entityRow.entity_id),
          { releaseId },
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${detail}\n\n` +
            `The ${prepared.length} upserts above ARE COMMITTED — this check runs after COMMIT, ` +
            'because the derived copies have to be readable to be compared. Nothing was rolled ' +
            'back. Repair the diverged rows (see backfill-search-facets-projection.ts) before ' +
            'republishing the catalog artifacts, or readers will serve the diverged copy.',
          { cause: error },
        );
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
    remindToRepublishCatalogArtifacts(prepared.length);
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
