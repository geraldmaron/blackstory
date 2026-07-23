/**
 * Filter sheet — a modal route (`presentation: 'modal'`, set in `_layout.tsx`) opened from the
 * Explore tab's "Filters" button. Demonstrates typed + validated filter-state params and a safe
 * `returnTo` handoff: the optional `returnTo` query param is only ever honored if it passes
 * `isSafeInternalPath`/`parseReturnTo` (the app's open-redirect defense, threat-model T4) — an
 * absolute URL or unenumerated path in `returnTo` is discarded and the sheet falls back to
 * `/explore`, it is never used to navigate anywhere unvalidated.
 *
 * Applies both `kind` and `era` via `parseFilterState`; Clear resets both.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { type EntityKind, parseFilterState, parseReturnTo } from './_lib/route-params';
import {
  ExploreFiltersPanel,
  filterStateFromPanel,
} from '@/features/map/explore/ExploreFiltersPanel';

export default function FiltersSheet() {
  const rawParams = useLocalSearchParams();
  const initialFilters = parseFilterState(rawParams as Record<string, unknown>);
  const [kind, setKind] = useState<EntityKind | undefined>(initialFilters.kind);
  const [era, setEra] = useState<string | undefined>(initialFilters.era);

  // Never trust `returnTo` directly — only a value that survives the safe-route allowlist is
  // used; anything else (an external URL, an unenumerated path) silently falls back to Explore.
  const safeReturnTo = parseReturnTo(rawParams.returnTo) ?? '/explore';

  function apply() {
    const next = filterStateFromPanel(kind, era);
    router.navigate({
      pathname: safeReturnTo,
      params: {
        ...(next.kind ? { kind: next.kind } : {}),
        ...(next.era ? { era: next.era } : {}),
      },
    } as never);
  }

  function clear() {
    setKind(undefined);
    setEra(undefined);
  }

  return (
    <ExploreFiltersPanel
      kind={kind}
      era={era}
      onKindChange={setKind}
      onEraChange={setEra}
      onClear={clear}
      onApply={apply}
    />
  );
}
