/**
 * Legacy `/search` tab route — normalizes to Records, where search lives.
 *
 * Kept as a route rather than a config rule because `q` and `kind` have to survive the hop; a
 * published deep link that loses the reader's query is worse than a dead one, because it looks
 * like the archive found nothing.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

import { ARCHIVE_LIST_HREF } from '@/shell/mobile-nav';
import { parseFilterState, parseSearchQuery } from '@/lib/route-params';

export default function SearchRedirectScreen() {
  const params = useLocalSearchParams<{ q?: string | string[]; kind?: string | string[] }>();
  const q = parseSearchQuery(params.q);
  const { kind } = parseFilterState(params as Record<string, unknown>);

  return (
    <Redirect
      href={{
        pathname: ARCHIVE_LIST_HREF.pathname,
        params: {
          ...ARCHIVE_LIST_HREF.params,
          ...(q ? { q } : {}),
          ...(kind ? { kind } : {}),
        },
      }}
    />
  );
}
