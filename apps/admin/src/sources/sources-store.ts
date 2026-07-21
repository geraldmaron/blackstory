/** Admin reads for registered Postgres source organizations. */
import { listSourceOrganizationsPostgres } from '@/lib/postgres-sources';

export type SourceOrganizationListItem = {
  readonly id: string;
  readonly name: string;
  readonly homepageUrl?: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export async function listSourceOrganizations(limit = 100): Promise<readonly SourceOrganizationListItem[]> {
  return listSourceOrganizationsPostgres(limit);
}
export async function tryListSourceOrganizations(limit?: number): Promise<readonly SourceOrganizationListItem[] | null> {
  try {
    return await listSourceOrganizations(limit);
  } catch (error) {
    console.error('admin source organizations list failed', error);
    return null;
  }
}
