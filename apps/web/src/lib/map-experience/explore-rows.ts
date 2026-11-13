/**
 * The Explore list's rows: which records it lists and in what order, and the decade each row
 * shows.
 *
 * Every drawable match is listed. Records whose stored name reads like an internal id are kept and
 * sorted last, exactly as the Records register does (`records-matching.ts`), so the column's count
 * plus the unmapped note always equals the Records total for the same filters.
 */
import {
  decadesWithinPeriod,
  documentedDecades,
  periodIsActive,
  type CollectionPeriod,
} from '../discovery/collection-period';
import { isInternalRecordLabel } from '../place/public-place-path';
import type { ExploreMapFeature } from './build-explore-map-source';
import { sortByDistance } from './nearby';

export type ExploreRowSort =
  'oldest' | 'newest' | 'nearest' | 'discovery' | 'era' | 'name' | 'evidence';

/**
 * The decade a row shows and sorts by: under a brushed range, the first documented decade inside
 * it (the reason the record matched); otherwise the earliest. Undefined for an undated record.
 */
export function rowDecade(
  eraBuckets: readonly string[],
  period: CollectionPeriod | undefined,
): number | undefined {
  const within = period && periodIsActive(period) ? decadesWithinPeriod(eraBuckets, period) : [];
  return within[0] ?? documentedDecades(eraBuckets)[0];
}

export function rowDecadeLabel(
  eraBuckets: readonly string[],
  period: CollectionPeriod | undefined,
): string {
  const decade = rowDecade(eraBuckets, period);
  return decade === undefined ? 'Undated' : `${decade}s`;
}

/** Stable: keeps each group's order, moves id-like names to the end. */
function internalLast(rows: readonly ExploreMapFeature[]): ExploreMapFeature[] {
  const named: ExploreMapFeature[] = [];
  const internal: ExploreMapFeature[] = [];
  for (const row of rows) {
    (isInternalRecordLabel(row.properties.displayName) ? internal : named).push(row);
  }
  return [...named, ...internal];
}

/**
 * Orders the listed rows. Suggested, name and evidence order arrive already sorted from the
 * collection match (`matchExploreCollection`); Earliest and Latest sort by `rowDecade`, with
 * undated records closing the list in either direction.
 */
export function sortExploreRows(
  rows: readonly ExploreMapFeature[],
  sort: ExploreRowSort,
  distances: ReadonlyMap<string, number> | null,
  period: CollectionPeriod | undefined,
): readonly ExploreMapFeature[] {
  if (sort === 'nearest' && distances) return internalLast(sortByDistance(rows, distances));
  if (sort !== 'oldest' && sort !== 'newest') return internalLast(rows);
  const keyed = rows.map((row) => ({ row, decade: rowDecade(row.properties.eraBuckets, period) }));
  keyed.sort((a, b) => {
    if ((a.decade === undefined) !== (b.decade === undefined))
      return a.decade === undefined ? 1 : -1;
    if (a.decade !== undefined && b.decade !== undefined && a.decade !== b.decade) {
      return sort === 'oldest' ? a.decade - b.decade : b.decade - a.decade;
    }
    return a.row.properties.displayName.localeCompare(b.row.properties.displayName);
  });
  return internalLast(keyed.map((entry) => entry.row));
}
