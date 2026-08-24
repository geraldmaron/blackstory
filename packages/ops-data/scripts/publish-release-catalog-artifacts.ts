/**
 * Publish the active release's catalog artifacts (`entities.json` + `search-index.json`)
 * to the Supabase `public-media` bucket (ADR-004 read-through cache; repo-csw0).
 *
 * Reads `bb_public.*` for the active release, builds the aggregate artifacts with
 * `buildReleaseCatalogArtifacts`, and upserts them at
 * `public/releases/{releaseId}/…` via the Storage REST API. The web app (and any other
 * consumer with `APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL` configured) then serves catalog
 * reads from CDN-cached Storage instead of pulling multi-MB projections from Postgres
 * on every cold start.
 *
 * Event-driven, not blind-poll (repo-csw0 follow-up): `bb_public.release_catalog_publish_watermark`
 * is set dirty by a statement-level trigger on any write to `release_entities` / `search_index`
 * (see `supabase/migrations/20260808020846_release_catalog_publish_watermark.sql`). This script
 * checks that watermark BEFORE doing any expensive work, so a scheduled run that finds nothing
 * changed costs one single-row SELECT — not a 13MB rebuild + upload. When something did change,
 * each artifact's upload is further skipped independently if its content hash matches what's
 * already published (a touch-and-rewrite-same-value write still marks dirty but need not
 * re-upload or force a CDN cache invalidation).
 *
 * Race safety: the watermark's `dirty_at` is captured ONCE at the start, before the read. On
 * success, `published_at` is advanced to that captured value — not to "now" — so a write that
 * lands mid-run (after the catalog read started) stays flagged dirty and is picked up next run,
 * rather than being silently skipped because "now" had already moved past it.
 *
 * Manual runs (see usage below) always do real work — DRY_RUN inspects without ever touching
 * the watermark; FORCE=1 does a real publish while ignoring the watermark and hash checks.
 *
 * Usage — manual run:
 *   cd apps/web && set -a && . ./.env.local && set +a && cd ../../ && \
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/publish-release-catalog-artifacts.ts
 *
 * Scheduled run: .github/workflows/publish-release-catalog-artifacts.yml. The workflow's
 * PRIMARY trigger is workflow_dispatch right after an operator runs an ops-data script; the
 * cron is a DAILY tick ('17 9 * * *') that bounds worst-case staleness after a forgotten
 * publish. It polled every 5 minutes until 2026-08-08 and was deliberately slowed: 288 runs/day
 * to detect a human-initiated action is noise, not coverage. Do not read the watermark's
 * cheapness as a reason to restore polling — read it as the reason a missed tick is recoverable.
 *
 * Env: DATABASE_URL (or APP_DATABASE_URL), SUPABASE_URL, SUPABASE_SECRET_KEY
 * (or SUPABASE_SERVICE_ROLE_KEY). DRY_RUN=1 builds and reports without uploading or touching
 * the watermark. FORCE=1 bypasses both the watermark skip and the per-artifact hash skip.
 * Consumers validate `releaseId` against the live active-release pointer, so a stale
 * artifact is ignored, never served.
 */
import pg from 'pg';
import { mapPostgresSearchIndexRow, type PublicSearchIndexRow } from '@repo/schemas';
import { sha256Json, type JsonValue } from '@repo/domain';
import { buildReleaseCatalogArtifacts } from '../src/firestore/release-artifacts.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { shouldSkipPublish, shouldUploadArtifact } from './lib/release-catalog-publish-decision.ts';

const PUBLIC_MEDIA_BUCKET = process.env.APP_PUBLIC_MEDIA_BUCKET?.trim() || 'public-media';

/**
 * What the CDN and browsers are told about a published artifact.
 *
 * WHY THIS IS LONG (measured 2026-08-24). It was `max-age=3600`, under a comment that said
 * "cache aggressively" — one hour is not aggressive for an object that changes a few times a
 * month. `entities.json` for the active release is **16.0 MB**. At a one-hour TTL every
 * Cloudflare PoP that serves a request re-fetches all 16 MB from Storage every hour, forever,
 * for bytes that did not change. That is billed Storage egress, and at ~20-30 active PoPs it is
 * hundreds of GB/month on its own.
 *
 * WHY A LONG TTL IS SAFE HERE, which is not obvious. The object path is release-versioned
 * (`public/releases/{releaseId}/…`), but that alone does NOT make the URL immutable: this script
 * uploads with `x-upsert: true`, and the watermark trigger fires on any write to
 * `release_entities` / `search_index` for the release that is already active. So editing the
 * live release rewrites the same URL, and a naive `immutable` would pin stale data at the edge
 * until the releaseId changed.
 *
 * It is safe because Supabase's Smart CDN purges on overwrite. Verified empirically on
 * 2026-08-24: uploaded a probe object, confirmed `cf-cache-status: HIT`, overwrote it, and the
 * very next request served the new body. Re-verify this before shortening the reasoning — the
 * whole TTL rests on it.
 *
 * `max-age` (browser) stays short because Smart CDN purges the EDGE, not somebody's browser
 * cache; `s-maxage` is the edge TTL that actually carries the saving. Same shape as
 * `ATLAS_CATALOG_CACHE_CONTROL` in apps/web.
 */
const PUBLIC_ARTIFACT_CACHE_CONTROL =
  'max-age=300, s-maxage=31536000, stale-while-revalidate=86400';

type WatermarkRow = {
  readonly dirty_at: Date | null;
  readonly published_at: Date | null;
  readonly published_entities_hash: string | null;
  readonly published_search_index_hash: string | null;
};

function requireEnv(...names: readonly string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing required env: ${names.join(' or ')}`);
}

async function uploadJson(objectPath: string, body: string): Promise<void> {
  const base = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
  const secretKey = requireEnv('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${base}/storage/v1/object/${PUBLIC_MEDIA_BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      apikey: secretKey,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': PUBLIC_ARTIFACT_CACHE_CONTROL,
      'x-upsert': 'true',
    },
    body,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `upload failed (${response.status}) for ${objectPath}: ${detail.slice(0, 300)}`,
    );
  }
}

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === '1';
  const force = process.env.FORCE === '1';
  const rawConnection = requireEnv('DATABASE_URL', 'APP_DATABASE_URL');
  const { connectionString, ssl } = normalizePgConnectionString(rawConnection);
  const client = new pg.Client({ connectionString, ...(ssl ? { ssl } : {}) });
  await client.connect();
  try {
    // Capture the watermark BEFORE any expensive read. A write landing after this point stays
    // flagged dirty (see the race-safety note at the top of the file) and is caught next run.
    const watermark = await client.query<WatermarkRow>(
      `SELECT dirty_at, published_at, published_entities_hash, published_search_index_hash
       FROM bb_public.release_catalog_publish_watermark WHERE id = 'catalog' LIMIT 1`,
    );
    const dirtyAt = watermark.rows[0]?.dirty_at ?? null;
    const publishedAt = watermark.rows[0]?.published_at ?? null;

    if (shouldSkipPublish({ dryRun, force, dirtyAt, publishedAt })) {
      console.log(
        `up to date (dirty_at=${dirtyAt?.toISOString()} <= published_at=${publishedAt?.toISOString()}) — skipping`,
      );
      return;
    }

    const active = await client.query<{ release_id: string; activated_at: Date }>(
      `SELECT release_id, activated_at FROM bb_public.active_release WHERE id = 'active' LIMIT 1`,
    );
    const releaseId = active.rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release found in bb_public.active_release');

    const projections = await client.query<{ projection: JsonValue }>(
      `SELECT projection FROM bb_public.release_entities WHERE release_id = $1 ORDER BY entity_id`,
      [releaseId],
    );
    const searchRows = await client.query<PublicSearchIndexRow>(
      `SELECT id, release_id, entity_id, name, name_lower, aliases, topics, kind, status,
              geohash, related_count, claim_count, facets
       FROM bb_public.search_index WHERE release_id = $1 ORDER BY id`,
      [releaseId],
    );

    const searchDocs: JsonValue[] = [];
    let droppedSearchRows = 0;
    for (const row of searchRows.rows) {
      const mapped = mapPostgresSearchIndexRow(row);
      if (mapped) searchDocs.push(mapped as unknown as JsonValue);
      else droppedSearchRows += 1;
    }

    const artifacts = buildReleaseCatalogArtifacts({
      releaseId,
      generatedAt: new Date().toISOString(),
      projections: projections.rows.map((row) => row.projection),
      searchDocs,
    });

    const entitiesBody = `${JSON.stringify(artifacts.entitiesList)}\n`;
    const searchBody = `${JSON.stringify(artifacts.searchIndex)}\n`;
    console.log(
      `release ${releaseId}: ${artifacts.entitiesList.entityCount} entities ` +
        `(${(entitiesBody.length / 1e6).toFixed(1)}MB), ${artifacts.searchIndex.docCount} search docs ` +
        `(${(searchBody.length / 1e6).toFixed(1)}MB), ${droppedSearchRows} unmappable search rows dropped`,
    );
    if (dryRun) {
      console.log('DRY_RUN=1 — skipping upload and watermark update');
      return;
    }

    // Content-only hashes, deliberately NOT artifacts.entitiesListHash / searchIndexHash —
    // those hash the full artifact object including generatedAt, a fresh timestamp on every
    // run, so they can never match run-to-run even when the underlying data is identical.
    // Hashing just the entities/docs arrays is what actually answers "did the content change".
    const newEntitiesHash = sha256Json(
      projections.rows.map((row) => row.projection) as unknown as JsonValue,
    ).digest;
    const newSearchHash = sha256Json(searchDocs as unknown as JsonValue).digest;
    const prevEntitiesHash = watermark.rows[0]?.published_entities_hash ?? null;
    const prevSearchHash = watermark.rows[0]?.published_search_index_hash ?? null;

    const base = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
    const publicBase = `${base}/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}`;

    if (shouldUploadArtifact({ force, newHash: newEntitiesHash, previousHash: prevEntitiesHash })) {
      await uploadJson(artifacts.entitiesListPath, entitiesBody);
      console.log(`uploaded ${publicBase}/${artifacts.entitiesListPath}`);
    } else {
      console.log(`entities.json unchanged (hash match) — upload skipped`);
    }

    if (shouldUploadArtifact({ force, newHash: newSearchHash, previousHash: prevSearchHash })) {
      await uploadJson(artifacts.searchIndexPath, searchBody);
      console.log(`uploaded ${publicBase}/${artifacts.searchIndexPath}`);
    } else {
      console.log(`search-index.json unchanged (hash match) — upload skipped`);
    }

    // Advance published_at to the dirty_at we captured at the START of this run, not "now" —
    // a write that landed mid-run (after we snapshotted the watermark) must stay dirty so the
    // next run picks it up, rather than being masked because "now" had already moved past it.
    await client.query(
      `UPDATE bb_public.release_catalog_publish_watermark
       SET published_at = COALESCE($1::timestamptz, now()),
           published_entities_hash = $2,
           published_search_index_hash = $3
       WHERE id = 'catalog'`,
      [dirtyAt ? dirtyAt.toISOString() : null, newEntitiesHash, newSearchHash],
    );

    console.log(`consumer env: APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL=${publicBase}`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
