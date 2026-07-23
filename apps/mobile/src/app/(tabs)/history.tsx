/**
 * History tab — unified find-in-time surface (v6 mobile shell). Search merged here per
 * web `/history`; implementation reuses `SearchScreen` until the full history edition ships.
 */
import { useLocalSearchParams } from 'expo-router';

import { parseFilterState, parseSearchQuery } from '@/lib/route-params';
import { SearchScreen } from '@/features/search';

export default function HistoryTabScreen() {
  const params = useLocalSearchParams<{ q?: string | string[]; kind?: string | string[] }>();
  const initialQuery = parseSearchQuery(params.q);
  const { kind: initialKind } = parseFilterState(params as Record<string, unknown>);

  return <SearchScreen initialQuery={initialQuery || undefined} initialKind={initialKind} />;
}
