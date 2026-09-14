/**
 * Records tab — the archive as a findable list, and the phone's home for search.
 *
 * This replaced a `History` tab that was the search screen under another name. Chronology is a
 * filter over the archive (era), not a destination of its own, and naming the search surface
 * "History" meant the app had three parallel answers to "where is the archive": History, Search
 * and Records.
 */
import { useLocalSearchParams } from 'expo-router';

import { parseFilterState, parseSearchQuery } from '@/lib/route-params';
import { SearchScreen } from '@/features/search';
import { useExploreMapSource } from '@/features/explore';

export default function RecordsTabScreen() {
  const params = useLocalSearchParams<{
    q?: string | string[];
    kind?: string | string[];
    era?: string | string[];
  }>();
  const initialQuery = parseSearchQuery(params.q);
  const { kind: initialKind, era: initialEra } = parseFilterState(
    params as Record<string, unknown>,
  );
  const mapSource = useExploreMapSource();
  const pinnedRecordCount =
    mapSource.loadState.kind === 'ready' ? mapSource.source.features.length : undefined;
  const archiveScopeLabel = mapSource.usingDemo ? 'Demo fixtures' : 'Active release';

  return (
    <SearchScreen
      initialQuery={initialQuery || undefined}
      initialKind={initialKind}
      initialEra={initialEra}
      pinnedRecordCount={pinnedRecordCount}
      archiveScopeLabel={archiveScopeLabel}
    />
  );
}
