/**
 * `/explore` was the map tab. The Archive tab is the map now, so this route only forwards an old
 * deep link, a saved link or restored navigation state, keeping its filters and its selected
 * record.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

import { filterStateToRouteParams, parseEntityId, parseFilterState } from '@/lib/route-params';
import { ARCHIVE_ROUTE } from '@/shell/mobile-nav';

export default function ExploreRedirectScreen() {
  const params = useLocalSearchParams();
  const selected = parseEntityId(params.selected);
  const filters = Object.fromEntries(
    Object.entries(
      filterStateToRouteParams(parseFilterState(params as Record<string, unknown>)),
    ).filter(([, value]) => value !== ''),
  );

  return (
    <Redirect
      href={{
        pathname: ARCHIVE_ROUTE,
        params: { ...filters, ...(selected ? { selected } : {}) },
      }}
    />
  );
}
