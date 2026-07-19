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
 * Selection restoration rides the `selected` query param (shareable + deep-link +
 * cold-start-restorable): `ExploreView` validates it via `parseEntityId` and only
 * restores it if the entity still exists in the active release — a withdrawn or
 * released-out entity falls back to no selection, never a crash (MOB-005/ADR-004).
 */
import { router, useLocalSearchParams } from 'expo-router';

import { parseFilterState } from '../_lib/route-params';
import { ExploreView } from '@/features/explore';

export default function ExploreScreen() {
  const rawParams = useLocalSearchParams();
  const filters = parseFilterState(rawParams as Record<string, unknown>);

  return (
    <ExploreView
      filters={filters}
      selectedParam={rawParams.selected}
      onOpenFilters={() =>
        router.push({ pathname: '/filters-sheet', params: { returnTo: '/explore' } })
      }
      onOpenEntity={(id) => router.push({ pathname: '/entity/[id]', params: { id } })}
    />
  );
}
