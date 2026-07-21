/**
 * Fail-closed guard for operator-cli writes and Postgres-backed editorial paths.
 * Firestore editorial/catalog surfaces are retired; explicit OPS_DATA_SOURCE=postgres is required.
 */
import { resolveOpsDataSource } from '@repo/data-access';

export const POSTGRES_OPS_DATA_SOURCE_MESSAGE =
  'OPS_DATA_SOURCE=postgres is required; Firestore editorial and commit paths are retired';

export function assertPostgresOpsDataSource(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void {
  resolveOpsDataSource(environment);
  const explicit = (
    environment.OPS_DATA_SOURCE?.trim() || environment.ADMIN_DATA_SOURCE?.trim() || ''
  ).toLowerCase();
  if (explicit !== 'postgres') {
    throw new Error(POSTGRES_OPS_DATA_SOURCE_MESSAGE);
  }
}

export function editorialCatalogFromError(catalogFrom: string): Error {
  if (catalogFrom === 'firestore') {
    return new Error(
      `${POSTGRES_OPS_DATA_SOURCE_MESSAGE}. Use --catalog-from=postgres for embedding-backed catalog reads.`,
    );
  }
  return new Error('--catalog-from must be "postgres" when set');
}
