/**
 * Postgres reads for bb_publication releases and the active release pointer.
 */
import { queryPostgres } from './postgres-client.js';

export type PublicationReleaseListItem = {
  readonly id: string;
  readonly status: string;
  readonly searchIndexVersion: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly activatedAt?: string;
};

export type ActiveReleasePointer = {
  readonly releaseId: string;
  readonly activatedAt: string;
  readonly searchIndexVersion: string;
  readonly manifestHash: string;
};

export type ReleasesListResult = {
  readonly items: readonly PublicationReleaseListItem[];
  readonly activeRelease: ActiveReleasePointer | null;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

type ReleaseRow = {
  readonly id: string;
  readonly status: string;
  readonly search_index_version: string | null;
  readonly created_at: Date | string;
  readonly created_by: string | null;
  readonly activated_at: Date | string | null;
};

type ActiveReleaseRow = {
  readonly release_id: string;
  readonly activated_at: Date | string;
  readonly search_index_version: string | null;
  readonly manifest_hash: string | null;
};

export async function listPublicationReleasesPostgres(limit: number): Promise<ReleasesListResult> {
  const cappedLimit = Math.min(100, Math.max(1, limit));
  const [releaseRows, activeRows] = await Promise.all([
    queryPostgres<ReleaseRow>(
      `SELECT id, status, search_index_version, created_at, created_by, activated_at
       FROM bb_publication.releases
       ORDER BY created_at DESC
       LIMIT $1`,
      [cappedLimit],
    ),
    queryPostgres<ActiveReleaseRow>(
      `SELECT release_id, activated_at, search_index_version, manifest_hash
       FROM bb_public.active_release
       WHERE id = 'active'`,
    ),
  ]);

  const items: PublicationReleaseListItem[] = [];
  for (const row of releaseRows) {
    const searchIndexVersion = readString(row.search_index_version ?? undefined);
    const createdBy = readString(row.created_by ?? undefined);
    if (!searchIndexVersion || !createdBy) continue;
    const activatedAt = row.activated_at ? toIso(row.activated_at) : undefined;
    items.push({
      id: row.id,
      status: row.status,
      searchIndexVersion,
      createdAt: toIso(row.created_at),
      createdBy,
      ...(activatedAt ? { activatedAt } : {}),
    });
  }

  let activeRelease: ActiveReleasePointer | null = null;
  const active = activeRows[0];
  if (active) {
    const searchIndexVersion = readString(active.search_index_version ?? undefined);
    const manifestHash = readString(active.manifest_hash ?? undefined);
    if (searchIndexVersion && manifestHash) {
      activeRelease = {
        releaseId: active.release_id,
        activatedAt: toIso(active.activated_at),
        searchIndexVersion,
        manifestHash,
      };
    }
  }

  return { items, activeRelease };
}
