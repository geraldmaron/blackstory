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
 * Run after every release activation (and after in-place release mutations such as
 * incremental publishes) so the artifact tracks `bb_public`:
 *
 *   cd apps/web && set -a && . ./.env.local && set +a && cd ../../ && \
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/publish-release-catalog-artifacts.ts
 *
 * Env: DATABASE_URL (or APP_DATABASE_URL), SUPABASE_URL, SUPABASE_SECRET_KEY
 * (or SUPABASE_SERVICE_ROLE_KEY). DRY_RUN=1 builds and reports without uploading.
 * Consumers validate `releaseId` against the live active-release pointer, so a stale
 * artifact is ignored, never served.
 */
import pg from 'pg';
import { mapPostgresSearchIndexRow, type PublicSearchIndexRow } from '@repo/schemas';
import type { JsonValue } from '@repo/domain';
import { buildReleaseCatalogArtifacts } from '../src/firestore/release-artifacts.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const PUBLIC_MEDIA_BUCKET = process.env.APP_PUBLIC_MEDIA_BUCKET?.trim() || 'public-media';

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
      // Cache aggressively at the CDN: the object path is release-versioned and consumers
      // discover the current releaseId from the live active_release pointer.
      'cache-control': 'max-age=3600',
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
  const rawConnection = requireEnv('DATABASE_URL', 'APP_DATABASE_URL');
  const { connectionString, ssl } = normalizePgConnectionString(rawConnection);
  const client = new pg.Client({ connectionString, ...(ssl ? { ssl } : {}) });
  await client.connect();
  try {
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
      console.log('DRY_RUN=1 — skipping upload');
      return;
    }

    await uploadJson(artifacts.entitiesListPath, entitiesBody);
    await uploadJson(artifacts.searchIndexPath, searchBody);
    const base = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
    const publicBase = `${base}/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}`;
    console.log(`uploaded ${publicBase}/${artifacts.entitiesListPath}`);
    console.log(`uploaded ${publicBase}/${artifacts.searchIndexPath}`);
    console.log(`consumer env: APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL=${publicBase}`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
