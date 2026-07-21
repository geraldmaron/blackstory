/**
 * Server-side Postgres readers for active-release public projections in `bb_public.*`.
 * Maps `projection` jsonb and denormalized search columns into storage-neutral public contracts.
 */
import type {
  PublicActiveReleaseDoc,
  PublicEntityProjectionDoc,
  PublicSearchProjectionDoc,
  PublicStoryListItemDoc,
  PublicStoryProjectionDoc,
} from '@repo/schemas';
import { mapPostgresSearchIndexRow } from './map-postgres-search-index';
import {
  parseActiveRelease,
  parseEntityProjection,
  parseStoryListItem,
  parseStoryProjection,
  toStoryListItem,
} from './projection-contracts';
import { queryPostgres } from './postgres-client';

/** Batch size for `entity_id = ANY($n::text[])` point reads. */
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

type MaterializedSnapshotRow = {
  readonly payload: unknown;
};

function toIsoTimestamp(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

export async function fetchActiveRelease(): Promise<PublicActiveReleaseDoc | undefined> {
  const rows = await queryPostgres<ActiveReleaseRow>(
    `SELECT release_id, activated_at, search_index_version, manifest_hash
     FROM bb_public.active_release
     WHERE id = 'active'
     LIMIT 1`,
  );
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
): Promise<PublicEntityProjectionDoc | undefined> {
  const rows = await queryPostgres<ProjectionRow>(
    `SELECT projection
     FROM bb_public.release_entities
     WHERE release_id = $1 AND entity_id = $2
     LIMIT 1`,
    [releaseId, entityId],
  );
  const projection = rows[0]?.projection;
  return projection !== undefined ? parseEntityProjection(projection) : undefined;
}

export async function listPublicEntityProjections(
  releaseId: string,
): Promise<readonly PublicEntityProjectionDoc[]> {
  const rows = await queryPostgres<ProjectionRow>(
    `SELECT projection
     FROM bb_public.release_entities
     WHERE release_id = $1
     ORDER BY entity_id`,
    [releaseId],
  );
  const entities: PublicEntityProjectionDoc[] = [];
  for (const row of rows) {
    const parsed = parseEntityProjection(row.projection);
    if (parsed) entities.push(parsed);
  }
  return entities;
}

export async function fetchPublicEntityProjectionsByIds(
  releaseId: string,
  entityIds: readonly string[],
): Promise<readonly PublicEntityProjectionDoc[]> {
  const unique = [...new Set(entityIds.map((id) => id.trim()).filter((id) => id.length > 0))];
  if (unique.length === 0) return [];

  const entities: PublicEntityProjectionDoc[] = [];
  for (let offset = 0; offset < unique.length; offset += POSTGRES_ENTITY_BATCH_SIZE) {
    const chunk = unique.slice(offset, offset + POSTGRES_ENTITY_BATCH_SIZE);
    const rows = await queryPostgres<ProjectionRow>(
      `SELECT projection
       FROM bb_public.release_entities
       WHERE release_id = $1 AND entity_id = ANY($2::text[])`,
      [releaseId, chunk],
    );
    for (const row of rows) {
      const parsed = parseEntityProjection(row.projection);
      if (parsed) entities.push(parsed);
    }
  }
  return entities;
}

export async function listPublicSearchIndexDocs(
  releaseId: string,
): Promise<readonly PublicSearchProjectionDoc[]> {
  const rows = await queryPostgres<Parameters<typeof mapPostgresSearchIndexRow>[0]>(
    `SELECT id, release_id, entity_id, name, name_lower, aliases, topics, kind, status,
            geohash, related_count, claim_count, facets
     FROM bb_public.search_index
     WHERE release_id = $1
     ORDER BY id`,
    [releaseId],
  );
  const docs: PublicSearchProjectionDoc[] = [];
  for (const row of rows) {
    const parsed = mapPostgresSearchIndexRow(row);
    if (parsed) docs.push(parsed);
  }
  return docs;
}

export async function fetchPublicStoryProjection(
  releaseId: string,
  slug: string,
): Promise<PublicStoryProjectionDoc | undefined> {
  const rows = await queryPostgres<ProjectionRow>(
    `SELECT projection
     FROM bb_public.release_stories
     WHERE release_id = $1 AND slug = $2
     LIMIT 1`,
    [releaseId, slug],
  );
  const projection = rows[0]?.projection;
  return projection !== undefined ? parseStoryProjection(projection) : undefined;
}

export async function listPublicStoryProjections(
  releaseId: string,
): Promise<readonly PublicStoryProjectionDoc[]> {
  const rows = await queryPostgres<ProjectionRow>(
    `SELECT projection
     FROM bb_public.release_stories
     WHERE release_id = $1
     ORDER BY slug`,
    [releaseId],
  );
  const stories: PublicStoryProjectionDoc[] = [];
  for (const row of rows) {
    const parsed = parseStoryProjection(row.projection);
    if (parsed) stories.push(parsed);
  }
  return stories;
}

export async function listPublicStorySummaries(
  releaseId: string,
): Promise<readonly PublicStoryListItemDoc[]> {
  const stories = await listPublicStoryProjections(releaseId);
  const summaries: PublicStoryListItemDoc[] = [];
  for (const story of stories) {
    const parsed = parseStoryListItem(story);
    summaries.push(parsed ?? toStoryListItem(story));
  }
  return summaries;
}

/** Reads one materialized `publicMeta` snapshot migrated into `bb_public.materialized_snapshots`. */
export async function fetchMaterializedSnapshot(name: string): Promise<unknown | undefined> {
  const rows = await queryPostgres<MaterializedSnapshotRow>(
    `SELECT payload
     FROM bb_public.materialized_snapshots
     WHERE name = $1
     LIMIT 1`,
    [name],
  );
  return rows[0]?.payload;
}
