/** Admin reads for registered Postgres source organizations and the source library. */
import {
  getSourceLibraryEntryPostgres,
  getSourceLibraryTotalsPostgres,
  listSourceEntitiesPostgres,
  listSourceLibraryFitnessPostgres,
  listSourceLibraryPostgres,
  listSourceOrganizationsPostgres,
  listUnmappedHostsPostgres,
  type SourceEntityPage,
  type SourceLibraryEntry,
  type SourceLibraryFitnessRow,
  type SourceLibraryListItem,
  type SourceLibrarySort,
  type SourceLibraryTotals,
  type UnmappedHostItem,
} from '@/admin/lib/postgres-sources';

export type SourceOrganizationListItem = {
  readonly id: string;
  readonly name: string;
  readonly homepageUrl?: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export async function listSourceOrganizations(
  limit = 100,
): Promise<readonly SourceOrganizationListItem[]> {
  return listSourceOrganizationsPostgres(limit);
}
export async function tryListSourceOrganizations(
  limit?: number,
): Promise<readonly SourceOrganizationListItem[] | null> {
  try {
    return await listSourceOrganizations(limit);
  } catch (error) {
    console.error('admin source organizations list failed', error);
    return null;
  }
}

export type {
  SourceEntityListItem,
  SourceEntityPage,
  SourceLibraryEntry,
  SourceLibraryFitnessRow,
  SourceLibraryListItem,
  SourceLibrarySort,
  SourceLibraryTotals,
  UnmappedHostItem,
} from '@/admin/lib/postgres-sources';

export async function listSourceLibrary(
  options: {
    readonly sort?: SourceLibrarySort;
    readonly q?: string;
    readonly limit?: number;
  } = {},
): Promise<readonly SourceLibraryListItem[]> {
  return listSourceLibraryPostgres(options);
}

export async function getSourceLibraryTotals(): Promise<SourceLibraryTotals> {
  return getSourceLibraryTotalsPostgres();
}

export type SourceLibraryDetail = {
  readonly entry: SourceLibraryEntry;
  readonly fitness: readonly SourceLibraryFitnessRow[];
};

/** The row and its fitness policies together, since the detail page always needs both. */
export async function getSourceLibraryEntry(
  organizationId: string,
): Promise<SourceLibraryDetail | null> {
  const entry = await getSourceLibraryEntryPostgres(organizationId);
  if (!entry) return null;
  const fitness = await listSourceLibraryFitnessPostgres(organizationId);
  return { entry, fitness };
}

export async function listSourceEntities(
  organizationId: string,
  options: { readonly limit?: number; readonly offset?: number } = {},
): Promise<SourceEntityPage> {
  return listSourceEntitiesPostgres(organizationId, options);
}

export async function listUnmappedHosts(limit = 50): Promise<readonly UnmappedHostItem[]> {
  return listUnmappedHostsPostgres(limit);
}
