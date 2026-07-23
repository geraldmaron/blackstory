/**
 * Legacy Search tab route — redirects to History (web `/search` → `/history`). Kept so old
 * deep links and in-app `/search` pushes normalize without orphan UI.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

import { parseFilterState, parseSearchQuery } from '@/lib/route-params';

export default function SearchRedirectScreen() {
  const params = useLocalSearchParams<{ q?: string | string[]; kind?: string | string[] }>();
  const q = parseSearchQuery(params.q);
  const { kind } = parseFilterState(params as Record<string, unknown>);

  return (
    <Redirect
      href={{
        pathname: '/history',
        params: {
          ...(q ? { q } : {}),
          ...(kind ? { kind } : {}),
        },
      }}
    />
  );
}
