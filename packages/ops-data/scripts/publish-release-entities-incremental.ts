/**
 * Publishes selected landscape candidates through reviewed-claim, privacy, withdrawal and
 * content gates. --ids, --lane or --from-landscape-pending scope input; --republish permits
 * corrections to existing records. Default dry-run; writes require DRY_RUN=0 and
 * INCREMENTAL_PUBLISH_APPLY=1. Post-write taxonomy, relationships and divergence checks cover
 * the active release.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { PublicVisit, ReleaseSourceEntity } from '@repo/domain';
import {
  assessPublicationClaims,
  loadReviewedClaimAssessments,
  type ReviewedClaimAssessment,
} from './lib/confidence.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  assessLandscapeDepth,
  buildArtifactsForEntry,
  buildLiveDepthEntry,
  canonicalUpsertParamsFromLandscape,
  carryLiveClaims,
  catalogDecisionFromRow,
  claimCountRegressed,
  gateLandscapePublishCandidate,
  incrementalPublishProvenancePatch,
  liveLocationFromRow,
  parseCanonicalStatusSnapshot,
  visitOverrideFromCanonicalRow,
  type CanonicalEntityPublishRow,
  type CanonicalVisitRow,
  type CatalogDecisionRow,
  type LandscapePublishRow,
  type LivePublishedRow,
  type PublishCatalogDecision,
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
import {
  attachPublicCitationArchives,
  assertArchiveHydrationTargetIsUnsigned,
  loadPublicCitationArchives,
  type ReviewedCitationCapture,
} from './lib/citation-archive-publication.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_PATH = join(REPO_ROOT, '.cache/landscape-intake/incremental-publish-report.json');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.INCREMENTAL_PUBLISH_APPLY === '1';

/**
 * Use re.entity_id = ANY(ARRAY[lc.id, lc.source_item_id]) for release membership. The
 * equivalent OR can become a filter that scans the active release for each candidate instead of
 * an index condition. Check EXPLAIN when changing this predicate. A null source_item_id matches
 * neither form.
 */
const LANDSCAPE_PENDING_SQL = `
WITH active AS (
  SELECT release_id FROM published.active_release LIMIT 1
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
    JOIN published.release_entities re
      ON re.release_id = a.release_id
      AND re.entity_id = ANY(ARRAY[lc.id, lc.source_item_id])
  ) AS exact_in_release,
  EXISTS (
    SELECT 1
    FROM active a
    JOIN published.release_entities re
      ON re.release_id = a.release_id
      AND lower(re.display_name) = lower(lc.display_name)
      AND re.entity_id <> lc.id
      AND re.entity_id <> lc.source_item_id
  ) AS name_overlap,
  -- repo-63ka: a newer WS4 draft that has not been staged onto this row yet (the bridge,
  -- apply-enrichment-to-landscape.ts, is a hand-run step — see that script's own header). Read
  -- by assessLandscapeDepth so a 'template_only' verdict can say WHICH of the two identical-
  -- looking cases it is: no draft was ever written, or one was written but never staged.
  EXISTS (
    SELECT 1
    FROM research.entity_enrichment ee
    WHERE ee.entity_id = lc.id
      AND ee.status = 'enriched'
      AND (ee.notes->'draft'->>'summary') IS NOT NULL
      AND (ee.notes->'draft'->>'summary') IS DISTINCT FROM lc.summary
  ) AS enrichment_draft_unstaged
FROM research.landscape_candidates lc
WHERE lc.status = 'pending'
  -- repo-n7p6.15: never publish an entity that has been merged away. An absorbed record is not a
  -- separate thing, and without this filter it republishes as one: both SCLC records and both SNCC
  -- records were live in the active release six days after they were merged, because the merge
  -- wrote merge_state and nothing on the publish path ever read it.
  AND NOT EXISTS (
    SELECT 1 FROM canonical.entities me
     WHERE me.id IN (lc.id, lc.source_item_id)
       AND me.merge_state->>'status' = 'absorbed'
  )
ORDER BY lc.lane, lc.id
`;

const LANDSCAPE_BY_IDS_SQL = `
WITH active AS (
  SELECT release_id FROM published.active_release LIMIT 1
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
    JOIN published.release_entities re
      ON re.release_id = a.release_id
      AND re.entity_id = ANY(ARRAY[lc.id, lc.source_item_id])
  ) AS exact_in_release,
  EXISTS (
    SELECT 1
    FROM active a
    JOIN published.release_entities re
      ON re.release_id = a.release_id
      AND lower(re.display_name) = lower(lc.display_name)
      AND re.entity_id <> lc.id
      AND re.entity_id <> lc.source_item_id
  ) AS name_overlap,
  -- repo-63ka: a newer WS4 draft that has not been staged onto this row yet (the bridge,
  -- apply-enrichment-to-landscape.ts, is a hand-run step — see that script's own header). Read
  -- by assessLandscapeDepth so a 'template_only' verdict can say WHICH of the two identical-
  -- looking cases it is: no draft was ever written, or one was written but never staged.
  EXISTS (
    SELECT 1
    FROM research.entity_enrichment ee
    WHERE ee.entity_id = lc.id
      AND ee.status = 'enriched'
      AND (ee.notes->'draft'->>'summary') IS NOT NULL
      AND (ee.notes->'draft'->>'summary') IS DISTINCT FROM lc.summary
  ) AS enrichment_draft_unstaged
FROM research.landscape_candidates lc
WHERE lc.id = ANY($1::text[])
ORDER BY lc.id
`;

// Lane correction passes include non-pending rows. Combine with --republish to reevaluate
// already accepted or published records.
const LANDSCAPE_BY_LANE_SQL = `
WITH active AS (
  SELECT release_id FROM published.active_release LIMIT 1
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
    JOIN published.release_entities re
      ON re.release_id = a.release_id
      AND re.entity_id = ANY(ARRAY[lc.id, lc.source_item_id])
  ) AS exact_in_release,
  EXISTS (
    SELECT 1
    FROM active a
    JOIN published.release_entities re
      ON re.release_id = a.release_id
      AND lower(re.display_name) = lower(lc.display_name)
      AND re.entity_id <> lc.id
      AND re.entity_id <> lc.source_item_id
  ) AS name_overlap,
  -- repo-63ka: a newer WS4 draft that has not been staged onto this row yet (the bridge,
  -- apply-enrichment-to-landscape.ts, is a hand-run step — see that script's own header). Read
  -- by assessLandscapeDepth so a 'template_only' verdict can say WHICH of the two identical-
  -- looking cases it is: no draft was ever written, or one was written but never staged.
  EXISTS (
    SELECT 1
    FROM research.entity_enrichment ee
    WHERE ee.entity_id = lc.id
      AND ee.status = 'enriched'
      AND (ee.notes->'draft'->>'summary') IS NOT NULL
      AND (ee.notes->'draft'->>'summary') IS DISTINCT FROM lc.summary
  ) AS enrichment_draft_unstaged
FROM research.landscape_candidates lc
WHERE lc.lane = $1
ORDER BY lc.id
`;

const ACTIVE_RELEASE_SQL = `SELECT release_id FROM published.active_release LIMIT 1`;

const PENDING_COUNT_SQL = `
SELECT COUNT(*)::text AS n FROM research.landscape_candidates WHERE status = 'pending'
`;

const CANONICAL_STATUS_BY_IDS_SQL = `
SELECT id AS entity_id, living_status, status_history, kind_detail
FROM canonical.entities
WHERE id = ANY($1::text[])
`;

/**
 * Canonical visit-contact input for every entity this run is about to (re)build,
 * so a lane republish stops silently dropping the phone/website/hours/street a backfill wrote
 * onto `canonical.entity_visit` / `entity_locations` — data the landscape row this run
 * rebuilds `ReleaseSourceEntity` from never carries at all.
 *
 * Mirrors the join in sync-visit-to-projection.ts (the one-off script that, until now, was the
 * only path that ever wrote `projection.visit`), anchored on the id list this run is evaluating
 * rather than on already-published `published.release_entities` rows — a republish candidate may
 * not have one yet. `entity_locations` is joined LATERAL to take the most recently updated row
 * per entity, same as that script.
 */
const CANONICAL_VISIT_BY_IDS_SQL = `
SELECT ids.entity_id,
       v.phone_e164, v.phone_display, v.website, v.hours, v.visitability, v.source_ids,
       l.street, l.postal_code
  FROM UNNEST($1::text[]) AS ids(entity_id)
  LEFT JOIN canonical.entity_visit v ON v.entity_id = ids.entity_id
  LEFT JOIN LATERAL (
    SELECT street, postal_code
      FROM canonical.entity_locations el
     WHERE el.entity_id = ids.entity_id
       AND (el.street IS NOT NULL OR el.postal_code IS NOT NULL)
     ORDER BY el.updated_at DESC
     LIMIT 1
  ) l ON true
 WHERE v.entity_id IS NOT NULL OR l.street IS NOT NULL OR l.postal_code IS NOT NULL
`;

/**
 * Load standing catalog decisions against both candidate id and source_item_id, because either
 * can identify the same record. Apply this lookup to every selection mode, including --lane and
 * --ids, and report withheld records explicitly. A later clear_flag replaces the prior verdict
 * for that id.
 */
const CATALOG_DECISIONS_BY_IDS_SQL = `
SELECT entity_id, decision, reason
FROM ops.catalog_decisions
WHERE entity_id = ANY($1::text[])
`;

/**
 * Use the active release as the depth baseline for already published records.
 * buildLiveDepthEntry reads only these three columns; superseded releases must not decide
 * whether a reader-visible record regresses.
 */
const LIVE_PUBLISHED_BY_IDS_SQL = `
SELECT e.entity_id, e.summary, e.claims, e.projection
FROM published.release_entities e
JOIN published.active_release a ON a.release_id = e.release_id
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
  readonly reviewBasis: 'independent_review';
  readonly entityRow: ReleaseEntityUpsertRow;
  readonly searchRow: SearchIndexUpsertRow;
  readonly fromLandscape: boolean;
  readonly landscapeRow: LandscapePublishRow | null;
  readonly lintReport: PublishStatusLintReport;
  /**
   * Reports coordinates inherited from the published record so their lineage remains visible
   * when the landscape row has no location.
   */
  readonly locationInherited?: boolean;
};

function reviewedCitationCaptures(
  reviewedClaims: readonly ReviewedClaimAssessment[],
): readonly ReviewedCitationCapture[] {
  return reviewedClaims.flatMap((claim) =>
    claim.reviewedEvidenceCaptures.map((capture) => ({
      claimId: claim.claimId,
      sourceUrl: capture.sourceUrl,
      sourceItemId: capture.sourceItemId,
      captureId: capture.captureId,
      contentHashDigest: capture.contentHashDigest,
    })),
  );
}

function hydratePreparedArchives(
  rows: readonly PreparedPublish[],
  archives: ReadonlyMap<string, { readonly archivedUrl: string; readonly archivedAt: string }>,
): readonly { readonly row: PreparedPublish; readonly changed: boolean }[] {
  return rows.map((row) => {
    const projection = attachPublicCitationArchives(row.entityRow.projection, archives);
    return {
      row: { ...row, entityRow: { ...row.entityRow, projection } },
      changed: projection !== row.entityRow.projection,
    };
  });
}

/** Reads one string field out of a stored projection, whose static type is `unknown` jsonb. */
function projectionString(projection: unknown, key: string): string | undefined {
  if (projection === null || typeof projection !== 'object') return undefined;
  const value = (projection as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Writes the projection and nothing else.
 *
 * The eleven columns this statement used to carry — display_name, kind, summary, location,
 * geohash, lat, lng, claims, taxonomy, related, primary_image — are GENERATED ALWAYS from
 * `projection` in the database. Postgres rejects a write that supplies a value for a generated
 * column, so naming any of them here is an error, not a redundancy.
 */
async function upsertEntity(client: pg.PoolClient, row: ReleaseEntityUpsertRow): Promise<void> {
  await client.query(
    `INSERT INTO published.release_entities
      (release_id, entity_id, projection, created_at)
     VALUES ($1,$2,$3::jsonb,now())
     ON CONFLICT (release_id, entity_id) DO UPDATE SET
       projection = EXCLUDED.projection`,
    [row.release_id, row.entity_id, JSON.stringify(row.projection)],
  );
}

async function upsertSearchIndex(client: pg.PoolClient, row: SearchIndexUpsertRow): Promise<void> {
  await client.query(
    `INSERT INTO published.search_index
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
    `INSERT INTO canonical.entities
      (id, kind, entity_class, display_name, living_status, status_history, notability_basis, sensitivity, kind_detail)
     VALUES ($1, $2, $3, $4, $5, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       living_status = CASE
         WHEN EXCLUDED.kind = 'person' THEN EXCLUDED.living_status
         ELSE canonical.entities.living_status
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
    `UPDATE research.landscape_candidates
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
  readonly reviewedClaims: readonly ReviewedClaimAssessment[];
  readonly canonicalStatus?: ReturnType<typeof parseCanonicalStatusSnapshot>;
  readonly allowRepublish?: boolean;
  /**
   * The active-release row for an already published entity.
   */
  readonly livePublished?: LivePublishedRow;
  /** Raw canonical visit-contact input for this entity, when one exists. */
  readonly visitOverride?: PublicVisit;
  /** The standing `ops.catalog_decisions` verdict for this entity, when one exists. */
  readonly catalogDecision?: PublishCatalogDecision;
}): PreparedPublish | SkippedRow {
  if (input.fromLandscape && input.row) {
    // Computed here rather than in the batch load because the verdict needs the candidate row's
    // canonical_url: `assessLandscapeDepth` counts a claim as independent evidence only when it
    // cites a document OTHER than the record's own registry index entry.
    const liveDepth =
      input.livePublished === undefined
        ? undefined
        : assessLandscapeDepth(buildLiveDepthEntry(input.livePublished), input.row);
    const liveLocation =
      input.livePublished === undefined ? undefined : liveLocationFromRow(input.livePublished);
    const gate = gateLandscapePublishCandidate({
      row: input.row,
      releaseId: input.releaseId,
      generatedAt: input.generatedAt,
      allowRepublish: input.allowRepublish ?? false,
      ...(liveDepth !== undefined ? { liveDepth } : {}),
      reviewedClaims: input.reviewedClaims,
      ...(liveLocation !== undefined ? { liveLocation } : {}),
      ...(input.canonicalStatus !== undefined ? { canonicalStatus: input.canonicalStatus } : {}),
      ...(input.visitOverride !== undefined ? { visitOverride: input.visitOverride } : {}),
      ...(input.catalogDecision !== undefined ? { catalogDecision: input.catalogDecision } : {}),
    });
    if (!gate.eligible) {
      return { id: input.entityId, reason: gate.reason, detail: gate.detail };
    }
    // Combine candidate claims with separately cited published claims, then reassess the
    // combined set. Rebuilding from the landscape row alone would discard accumulated evidence.
    const carry = carryLiveClaims(gate.entry.claims ?? [], input.livePublished);
    const combined = assessPublicationClaims(
      { ...gate.entry, claims: carry.claims },
      input.reviewedClaims,
    );
    if (!combined.ok) {
      return { id: input.entityId, reason: 'claim_assessment_required', detail: combined.detail };
    }
    const entry: ReleaseSourceEntity = { ...gate.entry, claims: combined.claims };
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
      ...(input.catalogDecision !== undefined ? { catalogDecision: input.catalogDecision } : {}),
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
      reviewBasis: combined.reviewBasis,
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
      throw new Error('no active release pointer in published.active_release');
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

    const reviewedClaims = await loadReviewedClaimAssessments(
      client,
      sliced.map((item) => item.entityId),
    );

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

    // Both ids per candidate, not just the one this run would publish under: see
    // CATALOG_DECISIONS_BY_IDS_SQL. A `source_item_id` is null on plenty of rows and would
    // otherwise widen the array with nulls that match nothing.
    const decisionLookupIds = [
      ...new Set(
        sliced.flatMap((item) =>
          [item.entityId, item.row?.source_item_id].filter(
            (id): id is string => typeof id === 'string' && id.length > 0,
          ),
        ),
      ),
    ];
    const catalogDecisionRes = await client.query<CatalogDecisionRow>(
      CATALOG_DECISIONS_BY_IDS_SQL,
      [decisionLookupIds],
    );
    const catalogDecisionById = new Map(
      catalogDecisionRes.rows.map((row) => [row.entity_id, catalogDecisionFromRow(row)]),
    );

    let prepared: PreparedPublish[] = [];
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
      // A ruling recorded against either id withdraws the record, so take the retraction when
      // either row carries one rather than letting id order decide which verdict is seen.
      const decisionsForItem = [
        catalogDecisionById.get(item.entityId),
        item.row?.source_item_id ? catalogDecisionById.get(item.row.source_item_id) : undefined,
      ].filter((decision): decision is PublishCatalogDecision => decision !== undefined);
      const catalogDecision =
        decisionsForItem.find((decision) => decision.action === 'flag_for_retraction') ??
        decisionsForItem[0];
      const result = preparePublish({
        row: item.row,
        releaseId,
        generatedAt,
        entityId: item.entityId,
        fromLandscape: item.fromLandscape,
        reviewedClaims,
        allowRepublish,
        ...(livePublished !== undefined ? { livePublished } : {}),
        ...(canonicalStatus !== undefined ? { canonicalStatus } : {}),
        ...(visitOverride !== undefined ? { visitOverride } : {}),
        ...(catalogDecision !== undefined ? { catalogDecision } : {}),
      });
      if ('reason' in result) {
        skipped.push(result);
        skipCounts.set(result.reason, (skipCounts.get(result.reason) ?? 0) + 1);
      } else {
        prepared.push(result);
        lintReports.push(result.lintReport);
      }
    }

    // Hydrate archive pointers only after the final claim set is known. This keeps private
    // evidence tables out of public reads and ensures a later preservation job changes a release
    // only through an explicit publication run.
    const unhydratedPrepared = prepared;
    const citationArchives = await loadPublicCitationArchives(
      client,
      reviewedCitationCaptures(reviewedClaims),
      generatedAt,
    );
    const hydratedPrepared = hydratePreparedArchives(unhydratedPrepared, citationArchives);
    const archiveProjectionChanges = hydratedPrepared.filter((entry) => entry.changed).length;
    prepared = hydratedPrepared.map((entry) => entry.row);

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
      archivePointersSelected: citationArchives.size,
      archiveProjectionChanges,
      skipped: skipped.length,
      skipCounts: Object.fromEntries(skipCounts),
      publishedIds: prepared.map((row) => row.id),
      // Full list, not a sample: see `PreparedPublish.locationInherited`.
      locationInheritedIds: prepared.filter((row) => row.locationInherited).map((row) => row.id),
      // Report every record withheld by a withdrawal decision, beyond the abbreviated skip
      // list, so operators can verify that withdrawals remain effective.
      retractedIds: skipped
        .filter((row) => row.reason === 'catalog_decision_retracted')
        .map((row) => row.id),
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

    console.log('=== Incremental publish (published.release_entities) ===');
    console.log(`Active release: ${releaseId}`);
    console.log(`Scanned: ${sliced.length}`);
    console.log(`Eligible: ${prepared.length}`);
    console.log(`Skipped: ${skipped.length}`);
    console.log(`Pending before: ${pendingBefore}`);
    if (prepared.length > 0) {
      console.log('');
      console.log('Eligible IDs:');
      for (const row of prepared) {
        console.log(`  ${row.id} (basis=${row.reviewBasis})`);
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
    try {
      const release = await client.query<{ readonly signed_manifest: unknown }>(
        'SELECT signed_manifest FROM publication.releases WHERE id=$1 FOR UPDATE',
        [releaseId],
      );
      // Every incremental upsert mutates the release, even when archive hydration itself is a
      // no-op. Missing or malformed release state reaches the guard unchanged and fails closed.
      assertArchiveHydrationTargetIsUnsigned(release.rows[0]?.signed_manifest, prepared.length);

      if (prepared.length > 0) {
        const transactionReviewedClaims = await loadReviewedClaimAssessments(
          client,
          prepared.map((row) => row.entityRow.entity_id),
        );
        const transactionArchives = await loadPublicCitationArchives(
          client,
          reviewedCitationCaptures(transactionReviewedClaims),
          new Date().toISOString(),
          { lock: true },
        );
        const transactionPrepared = hydratePreparedArchives(
          unhydratedPrepared,
          transactionArchives,
        ).map((entry) => entry.row);
        const hydrationChanged = transactionPrepared.some(
          (row, index) =>
            JSON.stringify(row.entityRow.projection) !==
            JSON.stringify(prepared[index]?.entityRow.projection),
        );
        if (hydrationChanged) {
          throw new Error(
            'Archive eligibility changed after preflight; retry incremental publication',
          );
        }
        prepared = transactionPrepared;
      }
      for (const row of prepared) {
        await upsertEntity(client, row.entityRow);
        await upsertSearchIndex(client, row.searchRow);
        if (row.fromLandscape && row.landscapeRow) {
          await markLandscapeAccepted(client, row.id, row.entityRow.entity_id, row.landscapeRow);
        }
      }

      // Keep reconciliation under the same release-row lock as the entity upserts. A signer
      // cannot freeze the release between these derived writes.
      if (prepared.length > 0) {
        const taxonomyPlan = await planReleaseTaxonomySync(client, releaseId);
        if (taxonomyPlan.changed.length > 0) {
          await applyReleaseTaxonomySync(client, releaseId, taxonomyPlan);
          console.log(
            `Re-synced taxonomy from canonical for ${taxonomyPlan.changed.length} entities.`,
          );
        }

        // Resync relationships after the entity upserts so both endpoints can be found in the
        // transaction. Do this before rebuilding the graph, which reads projection.related;
        // source rows do not carry canonical edges.
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
          manageTransaction: false,
          enforceCoverage,
          ...(minDecadeCoverage !== undefined ? { minDecadeCoveragePct: minDecadeCoverage } : {}),
        });
        for (const line of formatReleaseGraphAuditLog(graphRebuild.audit)) {
          console.log(`  graph: ${line}`);
        }

        // The same client can read its uncommitted writes, so divergence validation remains
        // inside the transaction and any failure rolls the complete incremental update back.
        await assertNoProjectionDivergence(
          client,
          prepared.map((row) => row.entityRow.entity_id),
          { releaseId },
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
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
