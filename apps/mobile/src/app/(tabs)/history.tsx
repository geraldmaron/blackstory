/**
 * History tab — unified find-in-time surface (v6 mobile shell). Search merged here per
 * web `/history`; implementation reuses `SearchScreen` until the full history edition ships.
 */
import { useLocalSearchParams } from 'expo-router';

import { parseFilterState, parseSearchQuery } from '@/lib/route-params';
import { SearchScreen } from '@/features/search';
import { useExploreMapSource } from '@/features/explore';

export default function HistoryTabScreen() {
  const params = useLocalSearchParams<{ q?: string | string[]; kind?: string | string[] }>();
  const initialQuery = parseSearchQuery(params.q);
  const { kind: initialKind } = parseFilterState(params as Record<string, unknown>);
  const mapSource = useExploreMapSource();
  const pinnedRecordCount =
    mapSource.loadState.kind === 'ready' ? mapSource.source.features.length : undefined;
  const archiveScopeLabel = mapSource.usingDemo ? 'Demo fixtures' : 'Active release';

  return (
    <SearchScreen
      initialQuery={initialQuery || undefined}
      initialKind={initialKind}
      pinnedRecordCount={pinnedRecordCount}
      archiveScopeLabel={archiveScopeLabel}
    />
  );
}
