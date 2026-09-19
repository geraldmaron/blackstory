/**
 * Publishes active-release entities and search artifacts to Supabase Storage. Skip clean
 * watermarks and unchanged content hashes. Capture dirty_at before reads and advance
 * published_at only through that captured point so concurrent writes remain pending. Retries
 * must preserve upload success/failure accurately. Runs explicitly; no schedule is installed.
 */
import pg from 'pg';
import { mapPostgresSearchIndexRow, type PublicSearchIndexRow } from '@repo/schemas';
import { sha256Json, type JsonValue } from '@repo/domain';
import { buildReleaseCatalogArtifacts } from '../src/records/release-artifacts.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { shouldSkipPublish } from './lib/release-catalog-publish-decision.ts';
import {
  publishArtifactWithRetry,
  uploadArtifactJson,
} from './lib/release-catalog-publish-upload.ts';

const PUBLIC_MEDIA_BUCKET = process.env.APP_PUBLIC_MEDIA_BUCKET?.trim() || 'public-media';

/**
 * Short browser caching limits stale client copies; longer edge caching reduces repeated
 * Storage reads. Same-release overwrites require verified CDN invalidation because the URL
 * itself is not immutable. Recheck overwrite behavior when changing storage or CDN
 * configuration.
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

async function persistEntitiesHash(client: pg.Client, hash: string): Promise<void> {
  await client.query(
    `UPDATE published.release_catalog_publish_watermark
     SET published_entities_hash = $1
     WHERE id = 'catalog'`,
    [hash],
  );
}

async function persistSearchIndexHash(client: pg.Client, hash: string): Promise<void> {
  await client.query(
    `UPDATE published.release_catalog_publish_watermark
     SET published_search_index_hash = $1
     WHERE id = 'catalog'`,
    [hash],
  );
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
       FROM published.release_catalog_publish_watermark WHERE id = 'catalog' LIMIT 1`,
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
      `SELECT release_id, activated_at FROM published.active_release WHERE id = 'active' LIMIT 1`,
    );
    const releaseId = active.rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release found in published.active_release');

    const projections = await client.query<{ projection: JsonValue }>(
      `SELECT projection FROM published.release_entities WHERE release_id = $1 ORDER BY entity_id`,
      [releaseId],
    );
    const searchRows = await client.query<PublicSearchIndexRow>(
      `SELECT id, release_id, entity_id, name, name_lower, aliases, topics, kind, status,
              geohash, related_count, claim_count, facets
       FROM published.search_index WHERE release_id = $1 ORDER BY id`,
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
    const uploadConfig = {
      supabaseUrl: base,
      secretKey: requireEnv('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'),
      bucket: PUBLIC_MEDIA_BUCKET,
      cacheControl: PUBLIC_ARTIFACT_CACHE_CONTROL,
    };

    // Each artifact is retried with backoff and, only on actual success, immediately persists
    // its OWN published-hash column (see lib/release-catalog-publish-upload.ts). A rejection
    // here — retries exhausted — propagates straight to main().catch below and skips the
    // published_at UPDATE entirely, so a half-completed publish can never look "done": the next
    // run's hash comparison will skip whichever artifact already succeeded and retry only the
    // one that actually failed.
    const entitiesResult = await publishArtifactWithRetry(
      {
        objectPath: artifacts.entitiesListPath,
        body: entitiesBody,
        newHash: newEntitiesHash,
        previousHash: prevEntitiesHash,
        force,
      },
      {
        upload: (objectPath, body) => uploadArtifactJson(objectPath, body, uploadConfig),
        persistHash: (hash) => persistEntitiesHash(client, hash),
      },
    );
    console.log(
      entitiesResult.uploaded
        ? `uploaded ${publicBase}/${artifacts.entitiesListPath}`
        : `entities.json unchanged (hash match) — upload skipped`,
    );

    const searchResult = await publishArtifactWithRetry(
      {
        objectPath: artifacts.searchIndexPath,
        body: searchBody,
        newHash: newSearchHash,
        previousHash: prevSearchHash,
        force,
      },
      {
        upload: (objectPath, body) => uploadArtifactJson(objectPath, body, uploadConfig),
        persistHash: (hash) => persistSearchIndexHash(client, hash),
      },
    );
    console.log(
      searchResult.uploaded
        ? `uploaded ${publicBase}/${artifacts.searchIndexPath}`
        : `search-index.json unchanged (hash match) — upload skipped`,
    );

    // Only reached once BOTH artifacts are confirmed current. Advance published_at to the
    // dirty_at we captured at the START of this run, not "now" — a write that landed mid-run
    // (after we snapshotted the watermark) must stay dirty so the next run picks it up, rather
    // than being masked because "now" had already moved past it.
    await client.query(
      `UPDATE published.release_catalog_publish_watermark
       SET published_at = COALESCE($1::timestamptz, now())
       WHERE id = 'catalog'`,
      [dirtyAt ? dirtyAt.toISOString() : null],
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
