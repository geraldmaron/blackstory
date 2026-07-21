/** Admin reads for Postgres publication releases and the active release pointer. */
import { listPublicationReleasesPostgres } from '@/lib/postgres-publication';

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

export async function listPublicationReleases(limit = 50): Promise<ReleasesListResult> {
  return listPublicationReleasesPostgres(limit);
}
export async function tryListPublicationReleases(limit?: number): Promise<ReleasesListResult | null> {
  try {
    return await listPublicationReleases(limit);
  } catch (error) {
    console.error('admin publication releases list failed', error);
    return null;
  }
}
