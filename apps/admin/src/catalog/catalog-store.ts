/** Read-only Postgres canonical entity catalog access for the management portal. */
import { getCanonicalEntityDetailPostgres, listCanonicalEntitiesPostgres } from '@/lib/postgres-catalog';

export type CatalogEntityListItem = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: string;
  readonly updatedAt: string;
  readonly livingStatus?: 'living' | 'deceased' | 'unknown';
  readonly sensitivity?: readonly string[];
};
export type CatalogEntityLocation = {
  readonly id: string;
  readonly label?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly precision?: string;
};
export type CatalogEntityDetail = CatalogEntityListItem & {
  readonly aliases: readonly { readonly value: string; readonly kind?: string }[];
  readonly identifiers: readonly { readonly system: string; readonly value: string; readonly note?: string }[];
  readonly locations: readonly CatalogEntityLocation[];
  readonly claimCount?: number;
};

export async function listCanonicalEntities(limit = 100, search?: string): Promise<readonly CatalogEntityListItem[]> {
  return listCanonicalEntitiesPostgres(limit, search);
}
export async function getCanonicalEntityDetail(id: string): Promise<CatalogEntityDetail | null> {
  return getCanonicalEntityDetailPostgres(id);
}
export async function tryListCanonicalEntities(limit?: number, search?: string): Promise<readonly CatalogEntityListItem[] | null> {
  try {
    return await listCanonicalEntities(limit, search);
  } catch (error) {
    console.error('admin canonical entities list failed', error);
    return null;
  }
}
export async function tryGetCanonicalEntityDetail(id: string): Promise<CatalogEntityDetail | null> {
  try {
    return await getCanonicalEntityDetail(id);
  } catch (error) {
    console.error('admin canonical entity detail failed', id, error);
    return null;
  }
}
