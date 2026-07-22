/**
 * Deterministic Explore filters + the synchronized-list reading order (MOB-012).
 *
 * The filter model is the mobile subset the route layer already validates
 * (`app/_lib/route-params.ts` `FilterState`: `kind` + `era`), applied purely over
 * `ExploreFeature`s. "Deterministic" is a hard requirement: `applyFilters` is a
 * pure function of (features, filters) with a stable output order, so the same
 * filter state always yields the same result set AND the same list order — which
 * is what makes the result-count reflection and the RNTL count assertions
 * meaningful. Nothing is opt-out: an empty `FilterState` returns the full
 * population (historic records included), matching the web `applyExploreFilters`
 * posture (no default hiding of any era/lifecycle).
 */
import type { FilterState } from '@/app/_lib/route-params';
import type { ExploreFeature } from './explore-feature';

/** True when a feature satisfies every set filter. Absent filters are ignored. */
export function matchesFilters(feature: ExploreFeature, filters: FilterState): boolean {
  if (filters.kind !== undefined && feature.kind !== filters.kind) return false;
  if (filters.era !== undefined) {
    const eras = feature.properties.eraBuckets ?? [];
    if (!eras.includes(filters.era)) return false;
  }
  return true;
}

/**
 * Filters and returns features in a STABLE, deterministic reading order:
 * alphabetical by label, ties broken by entityId. A glanceable, non-arbitrary
 * order is a cognitive-accessibility requirement for the list alternative to the
 * visual map, and a stable order is what lets viewport re-filtering avoid
 * reshuffling rows under the reader.
 */
export function applyFilters(
  features: readonly ExploreFeature[],
  filters: FilterState,
): readonly ExploreFeature[] {
  return features
    .filter((feature) => matchesFilters(feature, filters))
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label) || a.entityId.localeCompare(b.entityId));
}

/** Result count for a filter state — the number surfaced next to the Filters control. */
export function countMatches(features: readonly ExploreFeature[], filters: FilterState): number {
  let count = 0;
  for (const feature of features) if (matchesFilters(feature, filters)) count += 1;
  return count;
}
