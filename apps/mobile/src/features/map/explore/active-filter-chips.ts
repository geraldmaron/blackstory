/**
 * Builds compact removable chip descriptors for active Explore filters so the
 * instruments panel can show what is on and clear one facet at a time.
 */
import {
  KIND_FAMILIES,
  type FilterState,
  type KindFamily,
  hasActiveFilters,
} from '@/lib/route-params';
import { kindFamilyEncodingFor, isKnownMapKindFamily, kindEncodingFor } from '@/features/map/kind-encoding';
import type { ExploreFacetOptions } from '@/features/explore/explore-filter';
import type { NavIconName } from '@/ui';

export type ActiveFilterChip = {
  readonly key: keyof FilterState;
  readonly label: string;
  readonly iconName?: NavIconName;
};

const KIND_LABELS: Record<KindFamily, string> = {
  people: kindFamilyEncodingFor('people').label,
  places: kindFamilyEncodingFor('places').label,
  organizations: kindFamilyEncodingFor('organizations').label,
  events: kindFamilyEncodingFor('events').label,
  sources: kindFamilyEncodingFor('sources').label,
};

const KIND_ICONS: Record<KindFamily, NavIconName> = {
  people: 'person',
  places: 'place',
  organizations: 'organization',
  events: 'event',
  sources: 'publication',
};

function facetDisplayLabel(
  facetKey: keyof ExploreFacetOptions,
  value: string,
  options: ExploreFacetOptions,
): string {
  const match = options[facetKey].find((option) => option.value === value);
  if (match) return match.label.replace(/\s\(\d+\)$/, '');
  return value;
}

/** Ordered active-filter chips for the instruments summary strip. */
export function activeFilterChips(
  filters: FilterState,
  facetOptions: ExploreFacetOptions,
): readonly ActiveFilterChip[] {
  if (!hasActiveFilters(filters)) return [];

  const chips: ActiveFilterChip[] = [];

  if (filters.kind !== undefined) {
    const kind = filters.kind;
    if (isKnownMapKindFamily(kind) && (KIND_FAMILIES as readonly string[]).includes(kind)) {
      chips.push({
        key: 'kind',
        label: KIND_LABELS[kind],
        iconName: KIND_ICONS[kind],
      });
    } else {
      chips.push({
        key: 'kind',
        label: kindEncodingFor(kind).label,
      });
    }
  }

  if (filters.tone !== undefined) {
    chips.push({
      key: 'tone',
      label: facetDisplayLabel('tone', filters.tone, facetOptions),
    });
  }

  if (filters.era !== undefined) {
    chips.push({
      key: 'era',
      label: filters.era,
      iconName: 'history',
    });
  }

  if (filters.theme !== undefined) {
    chips.push({
      key: 'theme',
      label: facetDisplayLabel('theme', filters.theme, facetOptions),
      iconName: 'themes',
    });
  }

  if (filters.status !== undefined) {
    chips.push({
      key: 'status',
      label: facetDisplayLabel('status', filters.status, facetOptions),
    });
  }

  if (filters.confidence !== undefined) {
    chips.push({
      key: 'confidence',
      label: facetDisplayLabel('confidence', filters.confidence, facetOptions),
      iconName: 'privacy',
    });
  }

  if (filters.state !== undefined) {
    chips.push({
      key: 'state',
      label: facetDisplayLabel('state', filters.state, facetOptions),
      iconName: 'place',
    });
  }

  return chips;
}

/** Drops one facet key from the filter state. */
export function clearFilterKey(filters: FilterState, key: keyof FilterState): FilterState {
  const next = { ...filters };
  delete (next as Record<string, unknown>)[key];
  return next;
}

/** Count of set filter facets (for mast badge / a11y). */
export function activeFilterCount(filters: FilterState): number {
  let count = 0;
  if (filters.kind !== undefined) count += 1;
  if (filters.tone !== undefined) count += 1;
  if (filters.era !== undefined) count += 1;
  if (filters.theme !== undefined) count += 1;
  if (filters.status !== undefined) count += 1;
  if (filters.confidence !== undefined) count += 1;
  if (filters.state !== undefined) count += 1;
  return count;
}
