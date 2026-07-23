/**
 * Deterministic Explore filters + facet options (MOB-012 / Explore v7 Phase C).
 *
 * Filter application mirrors web `applyExploreFilters` order and semantics:
 * kind → tone → era → theme → status → confidence, plus optional state postal code
 * (Where). Facet options follow web `buildExploreFacetOptions` so the instruments
 * panel can render the same narrowing dimensions as `/explore`.
 */
import type { FilterState, KindFilterValue } from '@/lib/route-params';
import { hasActiveFilters, isValidThemeId } from '@/lib/route-params';
import {
  isKnownMapKind,
  isKnownMapKindFamily,
  kindEncodingFor,
  kindFamilyEncodingFor,
  kindFamilyFor,
  MAP_SEMANTIC_TONE_ENCODING,
  type MapSemanticTone,
} from '@/features/map/kind-encoding';
import type { ExploreFeature } from './explore-feature';

export { hasActiveFilters };

function kindMatchesFilter(featureKind: string, filterKind: KindFilterValue): boolean {
  if (isKnownMapKindFamily(filterKind)) {
    return kindFamilyFor(featureKind) === filterKind;
  }
  if (isKnownMapKind(filterKind)) {
    return featureKind === filterKind;
  }
  return featureKind === filterKind;
}

function effectiveTopicIds(feature: ExploreFeature): readonly string[] {
  const source = feature.properties.topicIds ?? feature.properties.topicTags;
  if (!source) return [];
  return source.filter(isValidThemeId);
}

function featureStatus(feature: ExploreFeature): string | undefined {
  const status = feature.properties.status?.trim();
  return status ? status : undefined;
}

/** True when a feature satisfies every set filter. Absent filters are ignored. */
export function matchesFilters(feature: ExploreFeature, filters: FilterState): boolean {
  if (filters.kind !== undefined && !kindMatchesFilter(feature.kind, filters.kind)) return false;
  if (filters.tone !== undefined && feature.properties.mapTone !== filters.tone) return false;
  if (filters.era !== undefined) {
    const eras = feature.properties.eraBuckets ?? [];
    if (!eras.includes(filters.era)) return false;
  }
  if (filters.theme !== undefined && !effectiveTopicIds(feature).includes(filters.theme)) {
    return false;
  }
  if (filters.status !== undefined && featureStatus(feature) !== filters.status) return false;
  if (
    filters.confidence !== undefined &&
    (feature.properties.confidenceTier ?? 'unrated') !== filters.confidence
  ) {
    return false;
  }
  if (
    filters.state !== undefined &&
    feature.properties.statePostalCode?.trim().toUpperCase() !== filters.state
  ) {
    return false;
  }
  return true;
}

/**
 * Filters and returns features in a STABLE, deterministic reading order:
 * alphabetical by label, ties broken by entityId.
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

const US_STATE_NAMES: Readonly<Record<string, string>> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DC: 'District of Columbia',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  IA: 'Iowa',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  MA: 'Massachusetts',
  MD: 'Maryland',
  ME: 'Maine',
  MI: 'Michigan',
  MN: 'Minnesota',
  MO: 'Missouri',
  MS: 'Mississippi',
  MT: 'Montana',
  NC: 'North Carolina',
  ND: 'North Dakota',
  NE: 'Nebraska',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NV: 'Nevada',
  NY: 'New York',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VA: 'Virginia',
  VT: 'Vermont',
  WA: 'Washington',
  WI: 'Wisconsin',
  WV: 'West Virginia',
  WY: 'Wyoming',
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
      return humanize(value);
    case 'status':
      return humanize(value);
    case 'confidence':
      return CONFIDENCE_LABELS[value] ?? humanize(value);
    case 'era':
      return value;
    case 'state':
      return US_STATE_NAMES[value] ?? value;
    default:
      return humanize(value);
  }
}

function countBy(
  features: readonly ExploreFeature[],
  extract: (feature: ExploreFeature) => readonly string[],
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
  readonly state: readonly FacetOption[];
};

/** Facet render order matches web Explore: kind → tone → era → theme → status → confidence → where. */
export const EXPLORE_FACET_ROWS = [
  { key: 'kind', label: 'Kind', field: 'kind' },
  { key: 'tone', label: 'Tone', field: 'tone' },
  { key: 'era', label: 'Era', field: 'era' },
  { key: 'theme', label: 'Theme', field: 'theme' },
  { key: 'status', label: 'Status', field: 'status' },
  { key: 'confidence', label: 'Confidence', field: 'confidence' },
  { key: 'state', label: 'Where', field: 'state' },
] as const satisfies ReadonlyArray<{
  readonly key: keyof ExploreFacetOptions;
  readonly label: string;
  readonly field: keyof ExploreFacetOptions;
}>;

export function buildExploreFacetOptions(
  features: readonly ExploreFeature[],
): ExploreFacetOptions {
  return {
    kind: toOptions(
      'kind',
      countBy(features, (feature) => [kindFamilyFor(feature.kind)]),
      'All kinds',
    ),
    tone: toOptions(
      'tone',
      countBy(features, (feature) => (feature.properties.mapTone ? [feature.properties.mapTone] : [])),
      'All tones',
    ),
    era: toOptions(
      'era',
      countBy(features, (feature) => feature.properties.eraBuckets ?? []),
      'All eras',
      'chrono',
    ),
    theme: toOptions('theme', countBy(features, effectiveTopicIds), 'All themes'),
    status: toOptions(
      'status',
      countBy(features, (feature) => {
        const status = featureStatus(feature);
        return status ? [status] : [];
      }),
      'All statuses',
    ),
    confidence: toOptions(
      'confidence',
      countBy(features, (feature) => [feature.properties.confidenceTier ?? 'unrated']),
      'All confidence tiers',
    ),
    state: toOptions(
      'state',
      countBy(features, (feature) =>
        feature.properties.statePostalCode ? [feature.properties.statePostalCode.trim().toUpperCase()] : [],
      ),
      'All states',
    ),
  };
}

/** Shallow equality on the closed mobile filter shape (used by explore-controller). */
export function sameFilterState(a: FilterState, b: FilterState): boolean {
  return (
    a.kind === b.kind &&
    a.era === b.era &&
    a.tone === b.tone &&
    a.theme === b.theme &&
    a.status === b.status &&
    a.confidence === b.confidence &&
    a.state === b.state
  );
}
