/**
 * Honest map/list continuity copy. Nearby is not related; unmapped is not deleted.
 * Kept in a leaf module so Records can call it without importing DiscoveryState adapters
 * (those adapters import Records href helpers, which would cycle).
 */

export function mapListContinuityLabel(matched: number, mappable: number): string {
  if (matched <= 0) return 'No records match the current narrowing.';
  if (mappable >= matched) {
    return `${matched.toLocaleString('en-US')} records match the current narrowing.`;
  }
  return `${matched.toLocaleString('en-US')} records match. ${mappable.toLocaleString('en-US')} appear on the map.`;
}
