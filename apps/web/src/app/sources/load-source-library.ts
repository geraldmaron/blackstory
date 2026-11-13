/** Server-only: tallies the released catalog's citations for the source library. */
import { cache } from 'react';
import { recordEvidenceInputs, type EvidenceClaimInput } from '@repo/public-contracts/evidence';
import { loadRecordsCatalog } from '../../lib/records/records-catalog';
import { tallySources, type SourceLibrary } from './source-library';

type CatalogRow = {
  readonly evidenceInputs?: { readonly citedLineageKeys: readonly string[] };
  readonly claims?: readonly EvidenceClaimInput[];
};

/** The released catalog's citations, tallied. `undefined` when the catalog could not be read. */
export const loadSourceLibrary = cache(async (): Promise<SourceLibrary | undefined> => {
  try {
    const { data } = await loadRecordsCatalog();
    return tallySources(
      (data as readonly CatalogRow[]).map(
        (row) =>
          row.evidenceInputs?.citedLineageKeys ??
          recordEvidenceInputs(row.claims ?? []).citedLineageKeys,
      ),
    );
  } catch {
    return undefined;
  }
});
