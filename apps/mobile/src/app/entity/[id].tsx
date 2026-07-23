/**
 * Entity detail — canonical mobile counterpart of web's `/entity/[id]` (`apps/web/src/app/entity/[id]`),
 * reachable as a stack push from Explore, Search, Learn, or More. This is also the universal-link
 * target for `https://blackbook.app/entity/{id}` (see app.config.ts's `associatedDomains`/
 * `intentFilters`); an app-not-installed open of that same URL falls through to the web route,
 * which is the correct, inherent Universal Links / App Links behavior (no mobile-side code
 * needed for that fallback — see apps/mobile/public/.well-known/README.md).
 *
 * The `id` path param is validated through the shared parser before anything else happens
 * (MOB-008). An invalid, oversized, or unsafe id (see threat-model T4 and
 * `_lib/route-params.test.ts`'s fuzz corpus) never reaches a fetch/render — the screen redirects
 * to the safe default (Explore) instead of crashing or attempting to interpret the raw string.
 *
 * Real entity data (evidence, timeline, media — MOB-014) is owned by `src/features/entity/**`;
 * this file only wires that feature's hook into the route: resolve+validate the id, fetch
 * through `useEntityDetail`/`createRuntimeEntityDataDeps` (MOB-009's cache/transport), and pass
 * the resulting state into `EntityDetailScreen`. Navigating to a related-entity neighbor pushes
 * a NEW instance of this same route (`router.push`), never an inline expansion — the withdrawn/
 * not-found state is exercised identically whichever way this route is entered.
 */
import { useEffect, useLayoutEffect, useState } from 'react';
import { Redirect, router, useLocalSearchParams, useNavigation } from 'expo-router';

import { parseEntityId } from '@/lib/route-params';
import {
  createRuntimeEntityDataDeps,
  EntityDetailScreen,
  useEntityDetail,
  type EntityDataDeps,
} from '@/features/entity';
import { ScreenCanvas } from '@/ui';

function compactHeaderTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= 36) return trimmed;
  return `${trimmed.slice(0, 33).trimEnd()}…`;
}

export default function EntityDetailRoute() {
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const entityId = parseEntityId(id);

  const [deps, setDeps] = useState<EntityDataDeps | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    createRuntimeEntityDataDeps()
      .then((resolved) => {
        if (!cancelled) setDeps(resolved);
      })
      .catch(() => {
        // Leave `deps` undefined — the screen shows its own loading state indefinitely only if
        // this genuinely never resolves, which would itself indicate a platform-level failure
        // outside this route's scope (e.g. no SQLite at all); MOB-018 observability is the
        // place to eventually surface that, not a client-side crash here.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { state, retry } = useEntityDetail(entityId, deps);
  const headerTitle =
    deps && state.kind === 'ready'
      ? compactHeaderTitle(state.result.entity.displayName)
      : 'Record';

  useLayoutEffect(() => {
    navigation.setOptions({
      title: headerTitle,
      headerTitle,
      headerBackTitle: 'Back',
      headerLargeTitle: false,
      headerBackButtonDisplayMode: 'minimal',
    });
  }, [navigation, headerTitle]);

  if (!entityId) {
    // Unknown/malformed/unsafe id — safe-default fallback, never a raw render of the input.
    return <Redirect href="/explore" />;
  }

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <EntityDetailScreen
        state={deps ? state : { kind: 'loading' }}
        onRetry={retry}
        onBackToExplore={() => router.replace('/explore')}
        onBackToMap={(selectedId) =>
          router.replace({ pathname: '/explore', params: { selected: selectedId } })
        }
        onOpenEntity={(neighborId) => router.push(`/entity/${neighborId}`)}
      />
    </ScreenCanvas>
  );
}
