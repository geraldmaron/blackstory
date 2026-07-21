/**
 * Postgres reads for bb_evidence.source_organizations.
 */
import { queryPostgres } from './postgres-client.js';

export type SourceOrganizationListItem = {
  readonly id: string;
  readonly name: string;
  readonly homepageUrl?: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

type SourceOrgRow = {
  readonly id: string;
  readonly name: string;
  readonly homepage: string | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

export async function listSourceOrganizationsPostgres(
  limit: number,
): Promise<readonly SourceOrganizationListItem[]> {
  const cappedLimit = Math.min(200, Math.max(1, limit));
  const rows = await queryPostgres<SourceOrgRow>(
    `SELECT id, name, homepage, created_at, updated_at
     FROM bb_evidence.source_organizations
     ORDER BY updated_at DESC
     LIMIT $1`,
    [cappedLimit],
  );

  return rows.map((row) => {
    const homepageUrl = readString(row.homepage ?? undefined);
    return {
      id: row.id,
      name: row.name,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      ...(homepageUrl ? { homepageUrl } : {}),
    };
  });
}
