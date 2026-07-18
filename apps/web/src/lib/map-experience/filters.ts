/**
 * Pure filter application + facet-option building for the map/list shared state. Mirrors
 * search-page facet convention (`apps/web/src/app/search/search-view-model.ts`) but
 * operates over `ExploreMapFeature` so the map canvas and the synchronized list can share one
 * filter/facet computation.
 */
import type { ExploreMapFeature } from './build-explore-map-source';
import { isPermittedTopicTag } from '@blap/domain';

export type ExploreFilterState = {
  readonly era: string;
  readonly kind: string;
  readonly theme: string;
  readonly confidence: string;
};

export const DEFAULT_EXPLORE_FILTERS: ExploreFilterState = {
  era: 'all',
  kind: 'all',
  theme: 'all',
  confidence: 'all',
};

/**
 * Filters never hide an entity's era/status lifecycle by default — every kind/era/theme/
 * confidence value is opt-IN via an explicit non-"all" filter value, so an unfiltered view
 * always shows the full active-release population, historic entities included.
 */
export function applyExploreFilters(
  features: readonly ExploreMapFeature[],
  filters: ExploreFilterState,
  statePostalCode?: string,
): readonly ExploreMapFeature[] {
  const stateFilter = statePostalCode?.trim().toUpperCase();
  return features.filter((feature) => {
    if (filters.kind !== 'all' && feature.properties.kind !== filters.kind) return false;
    if (filters.era !== 'all' && !feature.properties.eraBuckets.includes(filters.era)) return false;
    if (filters.theme !== 'all' && !feature.properties.topicTags.includes(filters.theme)) return false;
    if (filters.confidence !== 'all' && feature.properties.confidenceTier !== filters.confidence) return false;
    if (stateFilter && feature.properties.statePostalCode !== stateFilter) return false;
    return true;
  });
}

export type FacetOption = { readonly value: string; readonly label: string };

function humanize(key: string): string {
  return key
    .split(/[_-]/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function countBy(
  features: readonly ExploreMapFeature[],
  extract: (feature: ExploreMapFeature) => readonly string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const feature of features) {
    for (const value of extract(feature)) {
      counts[value] = (counts[value] ?? 0) + 1;
    }
  }
  return counts;
}

function toOptions(
  counts: Record<string, number>,
  allLabel: string,
  sort: 'alpha' | 'chrono' = 'alpha',
  filterFn?: (value: string) => boolean,
): readonly FacetOption[] {
  const entries = Object.entries(counts).filter(([value]) => !filterFn || filterFn(value));
  entries.sort(([a], [b]) =>
    sort === 'chrono' ? a.localeCompare(b, undefined, { numeric: true }) : a.localeCompare(b),
  );
  return [
    { value: 'all', label: allLabel },
    ...entries.map(([value, count]) => ({ value, label: `${humanize(value)} (${count})` })),
  ];
}

export type ExploreFacetOptions = {
  readonly kind: readonly FacetOption[];
  readonly era: readonly FacetOption[];
  readonly theme: readonly FacetOption[];
  readonly confidence: readonly FacetOption[];
};

/** Facet counts (and thus options) are always derived from the CURRENT filtered set the caller
 * passes in pass the full unfiltered collection to build "browse" options, or the
 * already-filtered collection to reflect what's left after other filters are applied. */
export function buildExploreFacetOptions(features: readonly ExploreMapFeature[]): ExploreFacetOptions {
  return {
    kind: toOptions(countBy(features, (feature) => [feature.properties.kind]), 'All kinds'),
    era: toOptions(countBy(features, (feature) => feature.properties.eraBuckets), 'All eras', 'chrono'),
    theme: toOptions(countBy(features, (feature) => feature.properties.topicTags), 'All themes', 'alpha', isPermittedTopicTag),
    confidence: toOptions(
      countBy(features, (feature) => [feature.properties.confidenceTier]),
      'All confidence tiers',
    ),
  };
}

/** Earliest era-bucket start year for chronological ordering; undated records sort last. */
function earliestEraYear(feature: ExploreMapFeature): number {
  let earliest = Number.POSITIVE_INFINITY;
  for (const bucket of feature.properties.eraBuckets) {
    const year = Number.parseInt(bucket, 10);
    if (Number.isFinite(year) && year < earliest) earliest = year;
  }
  return earliest;
}

/**
 * Deterministic reading order for the synchronized list (cognitive-accessibility law:
 * a list's order must be inferable at a glance, never arbitrary source order):
 * chronological by earliest documented era, undated records last, ties alphabetical.
 */
export function sortFeaturesForList(
  features: readonly ExploreMapFeature[],
): readonly ExploreMapFeature[] {
  return [...features].sort((a, b) => {
    const eraA = earliestEraYear(a);
    const eraB = earliestEraYear(b);
    if (eraA !== eraB) return eraA - eraB;
    return a.properties.displayName.localeCompare(b.properties.displayName);
  });
}
