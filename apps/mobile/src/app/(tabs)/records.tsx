/**
 * `/records` was the list tab. The Archive tab's List view is the list now, so this route only
 * forwards an old deep link, a saved link or restored navigation state, keeping its query, kind
 * and era.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

import { parseFilterState, parseSearchQuery } from '@/lib/route-params';
import { ARCHIVE_LIST_HREF } from '@/shell/mobile-nav';

export default function RecordsRedirectScreen() {
  const params = useLocalSearchParams<{
    q?: string | string[];
    kind?: string | string[];
    era?: string | string[];
  }>();
  const q = parseSearchQuery(params.q);
  const { kind, era } = parseFilterState(params as Record<string, unknown>);

  return (
    <Redirect
      href={{
        pathname: ARCHIVE_LIST_HREF.pathname,
        params: {
          ...ARCHIVE_LIST_HREF.params,
          ...(q ? { q } : {}),
          ...(kind ? { kind } : {}),
          ...(era ? { era } : {}),
        },
      }}
    />
  );
}
