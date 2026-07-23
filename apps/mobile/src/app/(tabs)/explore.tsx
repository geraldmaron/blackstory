/**
 * Explore tab — the native map-led experience (MOB-012), the mobile counterpart of
 * web's `/explore`.
 *
 * This route file owns only the ROUTER surface (MOB-008 contract): it reads and
 * VALIDATES the query params (`kind`/`era` filters and a `selected` entity id)
 * through the shared parser, and it supplies the navigation callbacks. The whole
 * map/list/filter/preview experience is `ExploreView` (feature-owned, router-free,
 * unit-testable), which never touches raw params or the router directly.
 *
 * Live map pins come from `GET /v1/map` via `useExploreMapSource` (ADR-025). Bundled
 * `DEMO_MAP_SOURCE` is only a `__DEV__` fallback when the API is unreachable.
 *
 * Selection restoration rides the `selected` query param (shareable + deep-link +
 * cold-start-restorable): `ExploreView` validates it via `parseEntityId` and only
 * restores it if the entity still exists in the active release — a withdrawn or
 * released-out entity falls back to no selection, never a crash (MOB-005/ADR-004).
 *
 * Filters apply in-map via the instruments panel (auto-sync URL params through
 * `onFiltersChange`). Modal routes `/filters-sheet` and `/color-key-sheet` remain
 * as deep-link fallbacks.
 */
import { router, useLocalSearchParams } from 'expo-router';

import { parseFilterState, filterStateToRouteParams } from '@/lib/route-params';
import { ExploreView, useExploreMapSource } from '@/features/explore';

export default function ExploreScreen() {
  const rawParams = useLocalSearchParams();
  const filters = parseFilterState(rawParams as Record<string, unknown>);
  const mapSource = useExploreMapSource();

  return (
    <ExploreView
      source={mapSource.source}
      loadState={mapSource.loadState}
      usingDemo={mapSource.usingDemo}
      onRetryMap={mapSource.retry}
      filters={filters}
      selectedParam={rawParams.selected}
      onOpenEntity={(id) => router.push({ pathname: '/entity/[id]', params: { id } })}
      onOpenSearch={() => router.push('/history')}
      onSelectionChange={(entityId) => {
        if (entityId) {
          router.setParams({ selected: entityId });
        } else {
          router.setParams({ selected: '' });
        }
      }}
      onFiltersChange={(next) => {
        router.setParams(filterStateToRouteParams(next));
      }}
    />
  );
}
