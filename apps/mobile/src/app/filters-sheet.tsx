/**
 * Filter sheet — a modal route (`presentation: 'modal'`, set in `_layout.tsx`) opened as a
 * deep-link fallback for Explore filters. Demonstrates typed + validated filter-state params
 * and a safe `returnTo` handoff: the optional `returnTo` query param is only ever honored if
 * it passes `isSafeInternalPath`/`parseReturnTo` (the app's open-redirect defense, threat-model
 * T4) — an absolute URL or unenumerated path in `returnTo` is discarded and the sheet falls
 * back to `/explore`, it is never used to navigate anywhere unvalidated.
 *
 * Facet chips apply live to Explore URL params (selected = active). Done only dismisses;
 * Clear resets facets and syncs immediately. Primary Explore UX is the in-map instruments panel.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { type FilterState, filterStateToRouteParams, parseFilterState, parseReturnTo } from '@/lib/route-params';
import { ScreenCanvas } from '@/ui';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';
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

  useEditionStackBack({
    fallbackHref: safeReturnTo,
    accessibilityHint: 'Closes filters when there is no previous screen',
  });

  function syncLive(next: FilterState) {
    const committed = filterStateFromPanel(next);
    setFilters(committed);
    // Live-apply to Explore under the modal (shareable URL). Done only dismisses.
    router.navigate({
      pathname: safeReturnTo,
      params: filterStateToRouteParams(committed),
    } as never);
  }

  function clear() {
    syncLive({});
  }

  function done() {
    // Ensure Explore has the latest selection, then leave the sheet.
    const committed = filterStateFromPanel(filters);
    router.navigate({
      pathname: safeReturnTo,
      params: filterStateToRouteParams(committed),
    } as never);
  }

  return (
    <ScreenCanvas edges={['bottom', 'left', 'right']}>
      <ExploreFiltersPanel
        filters={filters}
        facetOptions={facetOptions}
        onFiltersChange={syncLive}
        onClear={clear}
        onDone={done}
        onOpenPlaceFind={() => router.push('/history')}
        description="Narrow the map and list by kind family and decade. Changes apply right away."
      />
    </ScreenCanvas>
  );
}
