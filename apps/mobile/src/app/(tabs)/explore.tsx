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
 * Filters stay on the `/filters-sheet` modal (kind + era) so in-map panel embedding
 * is optional; `onFiltersChange` remains on ExploreView for a future in-sheet panel.
 */
import { router, useLocalSearchParams } from 'expo-router';

import { parseFilterState, type FilterState } from '../_lib/route-params';
import { ExploreView, useExploreMapSource } from '@/features/explore';

function filterParamsFromState(filters: FilterState): Record<string, string> {
  return {
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.era ? { era: filters.era } : {}),
  };
}

export default function ExploreScreen() {
  const rawParams = useLocalSearchParams();
  const filters = parseFilterState(rawParams as Record<string, unknown>);
  const mapSource = useExploreMapSource();

  return (
    <ExploreView
      source={mapSource.source}
      loadState={mapSource.loadState}
      onRetryMap={mapSource.retry}
      filters={filters}
      selectedParam={rawParams.selected}
      onOpenFilters={() =>
        router.push({
          pathname: '/filters-sheet',
          params: {
            returnTo: '/explore',
            ...filterParamsFromState(filters),
          },
        })
      }
      onOpenEntity={(id) => router.push({ pathname: '/entity/[id]', params: { id } })}
      onOpenSearch={() => router.push('/search')}
      onSelectionChange={(entityId) => {
        if (entityId) {
          router.setParams({ selected: entityId });
        } else {
          // Empty string clears the shareable selection param (expo-router).
          router.setParams({ selected: '' });
        }
      }}
      onFiltersChange={(next) => {
        router.setParams({
          kind: next.kind ?? '',
          era: next.era ?? '',
        });
      }}
    />
  );
}
