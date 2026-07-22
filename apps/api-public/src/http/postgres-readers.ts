/**
 * Server-side Postgres readers for active-release public projections in `bb_public.*`.
 * Mirrors `apps/web/src/lib/public-data/postgres-readers.ts` for the mobile `/v1` API surface.
 */
import type { PublicSearchProjectionDoc } from '@repo/schemas';
import { mapPostgresSearchIndexRow } from './postgres-search-index.js';
import { parseActiveRelease, parseEntityProjection } from './postgres-projection.js';
import { queryPostgres } from './postgres-client.js';

export const POSTGRES_ENTITY_BATCH_SIZE = 100;

type ActiveReleaseRow = {
  readonly release_id: string;
  readonly activated_at: Date | string;
  readonly search_index_version: string | null;
  readonly manifest_hash: string | null;
};

type ProjectionRow = {
  readonly projection: unknown;
};

export type PostgresQueryFn = (
  sql: string,
  params?: readonly unknown[],
) => Promise<readonly unknown[]>;

function toIsoTimestamp(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

export async function fetchActiveRelease(
  query: PostgresQueryFn = queryPostgres,
): Promise<ReturnType<typeof parseActiveRelease>> {
  const rows = (await query(
    `SELECT release_id, activated_at, search_index_version, manifest_hash
     FROM bb_public.active_release
     WHERE id = 'active'
     LIMIT 1`,
  )) as ActiveReleaseRow[];
  const row = rows[0];
  if (!row) return undefined;
  return parseActiveRelease({
    releaseId: row.release_id,
    activatedAt: toIsoTimestamp(row.activated_at),
    searchIndexVersion: row.search_index_version ?? 'unknown',
    manifestHash: row.manifest_hash ?? '0'.repeat(64),
  });
}

export async function fetchPublicEntityProjection(
  releaseId: string,
  entityId: string,
  query: PostgresQueryFn = queryPostgres,
): Promise<ReturnType<typeof parseEntityProjection>> {
  const rows = (await query(
    `SELECT projection
     FROM bb_public.release_entities
     WHERE release_id = $1 AND entity_id = $2
     LIMIT 1`,
    [releaseId, entityId],
  )) as ProjectionRow[];
  const projection = rows[0]?.projection;
  return projection !== undefined ? parseEntityProjection(projection) : undefined;
}

export async function listPublicEntityProjections(
  releaseId: string,
  query: PostgresQueryFn = queryPostgres,
): Promise<readonly NonNullable<ReturnType<typeof parseEntityProjection>>[]> {
  const rows = (await query(
    `SELECT projection
     FROM bb_public.release_entities
     WHERE release_id = $1
     ORDER BY entity_id`,
    [releaseId],
  )) as ProjectionRow[];
  const entities: NonNullable<ReturnType<typeof parseEntityProjection>>[] = [];
  for (const row of rows) {
    const parsed = parseEntityProjection(row.projection);
    if (parsed) entities.push(parsed);
  }
  return entities;
}

export async function listPublicSearchIndexDocs(
  releaseId: string,
  query: PostgresQueryFn = queryPostgres,
): Promise<readonly PublicSearchProjectionDoc[]> {
  const rows = (await query(
    `SELECT id, release_id, entity_id, name, name_lower, aliases, topics, kind, status,
            geohash, related_count, claim_count, facets
     FROM bb_public.search_index
     WHERE release_id = $1
     ORDER BY id`,
    [releaseId],
  )) as Parameters<typeof mapPostgresSearchIndexRow>[0][];
  const docs: PublicSearchProjectionDoc[] = [];
  for (const row of rows) {
    const parsed = mapPostgresSearchIndexRow(row);
    if (parsed) docs.push(parsed);
  }
  return docs;
}
