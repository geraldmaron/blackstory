/**
 * React hook wiring `fetchEntityDetail` (dataClient.ts) into a screen-consumable state union
 * (MOB-014). Kept separate from `EntityDetailScreen.tsx` so the screen itself stays a pure,
 * state-in/props-out presentational component (same split `features/map/MapScreen.tsx` uses:
 * the screen takes injected state/props, a thin wrapper owns the real fetch) — that split is
 * what makes the adversarial fixture matrix in `__tests__/EntityDetailScreen.test.tsx` possible
 * without mocking SQLite/NetInfo/App Check for every case.
 *
 * DEFENSIVE DEPENDENCY HANDLING: the effect below re-fetches on `entityId` change or on `deps`
 * transitioning from unavailable to available — deliberately NOT on `deps`'s object identity.
 * A caller that (by mistake) passes a freshly-constructed `EntityDataDeps` object on every
 * render (e.g. an un-memoized inline object, as an early draft of this hook's own test suite
 * did) would otherwise retrigger the fetch effect every render — an unbounded
 * fetch/setState/re-render loop that manifests as a real, silent memory blowup, not just a
 * theoretical concern (this was caught by `useEntityDetail.test.ts` OOMing during this bead's
 * own test run). Keying off `Boolean(deps)` instead of `deps` itself makes that class of bug
 * structurally impossible here, independent of how disciplined any given call site is.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEntityDetail, type EntityDataDeps, type EntityFetchResult } from './dataClient';

export type EntityDetailState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly result: Extract<EntityFetchResult, { status: 'ready' }> }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'offline-no-cache' }
  | { readonly kind: 'error'; readonly message: string };

function toState(result: EntityFetchResult): EntityDetailState {
  if (result.status === 'ready') return { kind: 'ready', result };
  if (result.status === 'not-found') return { kind: 'not-found' };
  if (result.status === 'offline-no-cache') return { kind: 'offline-no-cache' };
  return { kind: 'error', message: result.message };
}

export function useEntityDetail(entityId: string | null, deps: EntityDataDeps | undefined) {
  const [state, setState] = useState<EntityDetailState>({ kind: 'loading' });
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  // Always read the LATEST deps at call time, without making the effect below depend on its
  // object identity (see module header). Synced in its OWN effect (never written directly in
  // the render body — React's rules-of-hooks lint correctly flags a same-render ref write as
  // unsafe) that runs on every commit, declared BEFORE the fetch-triggering effect so it
  // always applies first within the same commit.
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });

  const load = useCallback(async () => {
    const currentDeps = depsRef.current;
    if (!entityId || !currentDeps) return;
    setState({ kind: 'loading' });
    try {
      const result = await fetchEntityDetail(entityId, currentDeps);
      if (mounted.current) setState(toState(result));
    } catch {
      // fetchEntityDetail is designed never to throw, but a screen must never crash even if a
      // future change to it regresses that guarantee.
      if (mounted.current) {
        setState({ kind: 'error', message: 'Couldn’t load this record. Check your connection and try again.' });
      }
    }
  }, [entityId]);

  const depsAvailable = deps !== undefined;
  useEffect(() => {
    load();
    // Intentionally keyed on `depsAvailable` (a boolean), not `deps` (an object reference) —
    // see module header. `load` itself only changes when `entityId` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, depsAvailable]);

  return { state, retry: load };
}
