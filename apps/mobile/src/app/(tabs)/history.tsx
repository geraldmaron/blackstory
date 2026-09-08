/**
 * Legacy `/history` tab route — normalizes to Records.
 *
 * History was find-in-time: a search over the archive with a decade filter, which is what
 * Records is. The `decade` param carries over as `era`, the same value transform the web route
 * performs, so a link shared from either surface lands on the same view.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

import { decadeParamToEra, parseFilterState, parseSearchQuery } from '@/lib/route-params';

export default function HistoryRedirectScreen() {
  const params = useLocalSearchParams<{
    q?: string | string[];
    kind?: string | string[];
    decade?: string | string[];
    era?: string | string[];
  }>();
  const q = parseSearchQuery(params.q);
  const { kind } = parseFilterState(params as Record<string, unknown>);
  const era = decadeParamToEra(params.decade) ?? parseSearchQuery(params.era);

  return (
    <Redirect
      href={{
        pathname: '/records',
        params: {
          ...(q ? { q } : {}),
          ...(kind ? { kind } : {}),
          ...(era ? { era } : {}),
        },
      }}
    />
  );
}
