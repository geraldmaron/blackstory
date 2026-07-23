/**
 * Filter sheet — a modal route (`presentation: 'modal'`, set in `_layout.tsx`) opened from the
 * Explore tab's "Filters" button. Demonstrates typed + validated filter-state params and a safe
 * `returnTo` handoff: the optional `returnTo` query param is only ever honored if it passes
 * `isSafeInternalPath`/`parseReturnTo` (the app's open-redirect defense, threat-model T4) — an
 * absolute URL or unenumerated path in `returnTo` is discarded and the sheet falls back to
 * `/explore`, it is never used to navigate anywhere unvalidated.
 *
 * Applies the full Explore filter set via `parseFilterState`; Clear resets all facets.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { type FilterState, filterStateToRouteParams, parseFilterState, parseReturnTo } from '@/lib/route-params';
import { ScreenCanvas } from '@/ui';
import { DEMO_MAP_SOURCE } from '@/features/map/demoMapSource';
import { toExploreFeatures } from '@/features/explore/explore-feature';
import { buildExploreFacetOptions } from '@/features/explore/explore-filter';
import {
  ExploreFiltersPanel,
  filterStateFromPanel,
} from '@/features/map/explore/ExploreFiltersPanel';

export default function FiltersSheet() {
  const rawParams = useLocalSearchParams();
  const initialFilters = parseFilterState(rawParams as Record<string, unknown>);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const facetOptions = useMemo(
    () => buildExploreFacetOptions(toExploreFeatures(DEMO_MAP_SOURCE)),
    [],
  );

  // Never trust `returnTo` directly — only a value that survives the safe-route allowlist is
  // used; anything else (an external URL, an unenumerated path) silently falls back to Explore.
  const safeReturnTo = parseReturnTo(rawParams.returnTo) ?? '/explore';

  function apply() {
    const next = filterStateFromPanel(filters);
    const params = Object.fromEntries(
      Object.entries(filterStateToRouteParams(next)).filter(([, value]) => value !== ''),
    );
    router.navigate({
      pathname: safeReturnTo,
      params,
    } as never);
  }

  function clear() {
    setFilters({});
  }

  return (
    <ScreenCanvas edges={['bottom', 'left', 'right']}>
      <ExploreFiltersPanel
        filters={filters}
        facetOptions={facetOptions}
        onFiltersChange={setFilters}
        onClear={clear}
        onApply={apply}
        onOpenPlaceFind={() => router.push('/history')}
      />
    </ScreenCanvas>
  );
}
