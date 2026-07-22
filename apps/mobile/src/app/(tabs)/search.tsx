/**
 * Search tab — canonical mobile counterpart of web's `/search`. Bounded mobile search itself is
 * MOB-013 scope (`src/features/search/**`); this route stays a thin wrapper — the `q`/`kind`
 * params are always read through the shared, validated parsers (`parseSearchQuery`/
 * `parseFilterState`), never used raw, satisfying threat-model T4 for this route ("Strict
 * ID-format validation before use" generalizes here to "strict query sanitization before use" —
 * an overlong, control-character-laden, or open-redirect-shaped `q` is discarded to the
 * empty-query default, never forwarded to a request or rendered raw). All actual search behavior
 * (normalization, debounce, cancellation, cursor pagination, offline/cache handling, recent
 * searches) lives in `SearchScreen`, which also owns its own `SafeAreaView` — this file owns only
 * route-param plumbing, mirroring how `src/features/map/MapScreen.tsx` is wired into Explore
 * without a route-tree edit.
 */
import { useLocalSearchParams } from 'expo-router';

import { parseFilterState, parseSearchQuery } from '../_lib/route-params';
import { SearchScreen } from '@/features/search';

export default function SearchTabScreen() {
  const params = useLocalSearchParams<{ q?: string | string[]; kind?: string | string[] }>();
  const initialQuery = parseSearchQuery(params.q);
  const { kind: initialKind } = parseFilterState(params as Record<string, unknown>);

  return <SearchScreen initialQuery={initialQuery || undefined} initialKind={initialKind} />;
}
