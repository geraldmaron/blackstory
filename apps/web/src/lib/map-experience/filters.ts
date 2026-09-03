/**
 * Pure filter application + facet-option building for the map/list shared state. Operates
 * over `ExploreMapFeature` so the map canvas and the synchronized list can share one
 * filter/facet computation.
 *
 * Record filters (hide pins): kind → tone → era → theme → status → confidence, plus optional
 * state postal code (Where). Layer models / grouping / relationship lines are map chrome, not
 * pin filters.
 */
import { findUsStateByPostalCode } from '@repo/domain/map/geography';
import { getTopicLabel, isValidTopicId } from '@repo/domain/taxonomy/topics';
import type { ExploreMapFeature } from './build-explore-map-source';
import {
  isKnownMapKind,
  isKnownMapKindFamily,
  kindEncodingFor,
  kindFamilyEncodingFor,
  kindFamilyFor,
  MAP_SEMANTIC_TONE_ENCODING,
  type MapSemanticTone,
} from './kind-encoding';
import type { ExploreMapBounds } from './url-state';

/**
 * Resolves the effective controlled-taxonomy topic ids for a feature (the related workstream): prefers
 * the new `topicIds` field, falling back to the legacy `topicTags` field for features built
 * before the split. Either way every value is validated against `TOPIC_REGISTRY` — the theme
 * facet is NEVER built from raw, uncontrolled tag counting.
 */
export function effectiveTopicIds(feature: ExploreMapFeature): readonly string[] {
  const source = feature.properties.topicIds ?? feature.properties.topicTags;
  return source.filter(isValidTopicId);
}

export type ExploreFilterState = {
  readonly era: string;
  readonly kind: string;
  readonly tone: string;
  readonly theme: string;
  readonly status: string;
  readonly confidence: string;
};

export const DEFAULT_EXPLORE_FILTERS: ExploreFilterState = {
  era: 'all',
  kind: 'all',
  tone: 'all',
  theme: 'all',
  status: 'all',
  confidence: 'all',
};

/**
 * Single kind-filter matcher shared by Explore and `/records`.
 * Accepts only the five map kind families (`people`) and micro-kinds (`school`).
 * Legacy `/history` category ids (`law`, `works`) are remapped at the redirect boundary only.
 */
export function kindMatchesPublicFilter(featureKind: string, filterKind: string): boolean {
  const needle = filterKind.trim();
  if (!needle || needle === 'all') return true;
  if (isKnownMapKindFamily(needle)) {
    return kindFamilyFor(featureKind) === needle;
  }
  if (isKnownMapKind(needle)) {
    return featureKind === needle;
  }
  return false;
}

/** Human label for an active kind constraint chip across Explore and Records. */
export function kindFilterLabel(filterKind: string): string {
  const value = filterKind.trim();
  if (isKnownMapKindFamily(value)) return kindFamilyEncodingFor(value).label;
  if (isKnownMapKind(value)) return kindEncodingFor(value).label;
  return value
    .split(/[_-]/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Filters never hide an entity's era/status lifecycle by default — every kind/tone/era/theme/
 * status/confidence value is opt-IN via an explicit non-"all" filter value, so an unfiltered view
 * always shows the full active-release population, historic entities included.
 */
export function applyExploreFilters(
  features: readonly ExploreMapFeature[],
  filters: ExploreFilterState,
  statePostalCode?: string,
): readonly ExploreMapFeature[] {
  const stateFilter = statePostalCode?.trim().toUpperCase();
  return features.filter((feature) => {
    if (!kindMatchesPublicFilter(feature.properties.kind, filters.kind)) return false;
    if (filters.tone !== 'all' && feature.properties.mapTone !== filters.tone) return false;
    if (filters.era !== 'all' && !feature.properties.eraBuckets.includes(filters.era)) return false;
    // Theme facet options come from effectiveTopicIds (topicIds preferred); filter the same set.
    if (filters.theme !== 'all' && !effectiveTopicIds(feature).includes(filters.theme))
      return false;
    if (filters.status !== 'all' && feature.properties.status !== filters.status) return false;
    if (filters.confidence !== 'all' && feature.properties.confidenceTier !== filters.confidence)
      return false;
    if (stateFilter && feature.properties.statePostalCode !== stateFilter) return false;
    return true;
  });
}

/**
 * Keeps point features whose coordinates fall inside the live map camera bounds.
 * Used so the synchronized records list matches what is geographically on screen —
 * filters still apply first; this only scopes the list to the current view.
 * Antimeridian-safe when west > east (rare for CONUS browsing).
 */
export function filterFeaturesInBounds(
  features: readonly ExploreMapFeature[],
  bounds: ExploreMapBounds,
): readonly ExploreMapFeature[] {
  return features.filter((feature) => {
    if (feature.geometry.type !== 'Point') return false;
    const [lng, lat] = feature.geometry.coordinates;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
    if (lat < bounds.south || lat > bounds.north) return false;
    if (bounds.west <= bounds.east) {
      return lng >= bounds.west && lng <= bounds.east;
    }
    // Crosses antimeridian: in-bounds if east of west OR west of east.
    return lng >= bounds.west || lng <= bounds.east;
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

const CONFIDENCE_LABELS: Readonly<Record<string, string>> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  unrated: 'Unrated',
};

function facetValueLabel(field: keyof ExploreFacetOptions, value: string): string {
  switch (field) {
    case 'kind':
      if (isKnownMapKindFamily(value)) return kindFamilyEncodingFor(value).label;
      return kindEncodingFor(value).label;
    case 'tone': {
      const tone = value as MapSemanticTone;
      return MAP_SEMANTIC_TONE_ENCODING[tone]?.label ?? humanize(value);
    }
    case 'theme':
      return getTopicLabel(value) ?? humanize(value);
    case 'status':
      return humanize(value);
    case 'confidence':
      return CONFIDENCE_LABELS[value] ?? humanize(value);
    case 'era':
      return value;
    case 'state': {
      const match = findUsStateByPostalCode(value);
      return match?.name ?? value;
    }
    default:
      return humanize(value);
  }
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
  field: keyof ExploreFacetOptions,
  counts: Record<string, number>,
  allLabel: string,
  sort: 'alpha' | 'chrono' = 'alpha',
): readonly FacetOption[] {
  const entries = Object.entries(counts);
  entries.sort(([a], [b]) =>
    sort === 'chrono' ? a.localeCompare(b, undefined, { numeric: true }) : a.localeCompare(b),
  );
  return [
    { value: 'all', label: allLabel },
    ...entries.map(([value, count]) => ({
      value,
      label: `${facetValueLabel(field, value)} (${count})`,
    })),
  ];
}

export type ExploreFacetOptions = {
  readonly kind: readonly FacetOption[];
  readonly tone: readonly FacetOption[];
  readonly era: readonly FacetOption[];
  readonly theme: readonly FacetOption[];
  readonly status: readonly FacetOption[];
  readonly confidence: readonly FacetOption[];
  /** USPS codes present on features — drives Where / `?state=` (not part of ExploreFilterState). */
  readonly state: readonly FacetOption[];
};

/** Facet counts (and thus options) are always derived from the CURRENT filtered set the caller
 * passes in pass the full unfiltered collection to build "browse" options, or the
 * already-filtered collection to reflect what's left after other filters are applied. */
export function buildExploreFacetOptions(
  features: readonly ExploreMapFeature[],
): ExploreFacetOptions {
  return {
    kind: toOptions(
      'kind',
      countBy(features, (feature) => [kindFamilyFor(feature.properties.kind)]),
      'All kinds',
    ),
    tone: toOptions(
      'tone',
      countBy(features, (feature) =>
        feature.properties.mapTone ? [feature.properties.mapTone] : [],
      ),
      'All tones',
    ),
    era: toOptions(
      'era',
      countBy(features, (feature) => feature.properties.eraBuckets),
      'All eras',
      'chrono',
    ),
    theme: toOptions('theme', countBy(features, effectiveTopicIds), 'All themes'),
    status: toOptions(
      'status',
      countBy(features, (feature) =>
        feature.properties.status ? [feature.properties.status] : [],
      ),
      'All statuses',
    ),
    confidence: toOptions(
      'confidence',
      countBy(features, (feature) => [feature.properties.confidenceTier]),
      'All confidence tiers',
    ),
    state: toOptions(
      'state',
      countBy(features, (feature) =>
        feature.properties.statePostalCode ? [feature.properties.statePostalCode] : [],
      ),
      'All states',
    ),
  };
}

export type TopicCount = { readonly id: string; readonly label: string; readonly count: number };

/**
 * Live topic counts over the given features, for the Lens's Topic group (directly under Kind,
 * same chip contract as Kind: glyph-free chip, label, live count). Capped so the group behaves
 * like Kind's five chips rather than rendering the full ~200-entry controlled taxonomy —
 * `TOPIC_CHIP_LIMIT` is the cap, ranked by how many records in view carry the topic so the chips
 * shown are always the ones worth pressing.
 */
export const TOPIC_CHIP_LIMIT = 12;

export function buildTopicCounts(
  features: readonly ExploreMapFeature[],
  limit = TOPIC_CHIP_LIMIT,
): readonly TopicCount[] {
  const counts = countBy(features, effectiveTopicIds);
  return Object.entries(counts)
    .map(([id, count]) => ({ id, label: getTopicLabel(id) ?? humanize(id), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export type EntityDecadeCount = { readonly decade: string; readonly count: number };

/**
 * Chronological decade buckets with record counts across the given features — drives the
 * always-visible explore decade rail. Era derivation already falls back from explicit
 * `eraBuckets` to event/status spans (see `build-explore-map-source.ts`), so coverage spans
 * nearly the whole catalog, not just records with hand-authored era buckets.
 */
export function buildEntityDecadeCounts(
  features: readonly ExploreMapFeature[],
): readonly EntityDecadeCount[] {
  const counts = countBy(features, (feature) => feature.properties.eraBuckets);
  return Object.entries(counts)
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => a.decade.localeCompare(b.decade, undefined, { numeric: true }));
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
