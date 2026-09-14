/**
 * A live read of `prefers-reduced-motion`, for the plate's imperative camera path.
 *
 * Design law: `docs/ui/brand.md` (dignity) and `docs/ui/design-direction-v9-surfaces.md` §3.
 *
 * The plate must CUT rather than fly when a reader has asked for reduced motion, and it must do
 * so from a live media query: a reader who turns the preference on mid-session is asking for it
 * now, not after a reload. The one-shot `prefersReducedMotion()` in `camera-presets.ts` reads the
 * query once at call time, which is right for its five callers and wrong here, because the Framed
 * camera path decides inside a scroll callback that may run for the whole life of the page.
 *
 * WHY A LISTENER AND NOT A HOOK. This module's consumer is imperative code running inside
 * `MapMomentStage`'s requestAnimationFrame callback, not a render. A `useSyncExternalStore` hook
 * in the provider would re-render the entire subtree under the plate on a preference flip that
 * only needs an animation callback to read a different boolean. `lib/motion/use-reduced-motion.ts`
 * is the React-facing API for components and must be a wrapper OVER this listener rather than a
 * second subscription to the same media query: two independent subscriptions to one query is
 * exactly the duplicate-variant pattern the repo rules forbid.
 *
 * `subscribe` (repo-92n2.18) exists for exactly that wrapper: `useSyncExternalStore` needs to be
 * told when the snapshot may have changed, and this listener's own `change` handler is the one
 * place that already knows. Adding a notify-on-change hook here, rather than a second
 * `matchMedia(...).addEventListener('change', ...)` in `use-reduced-motion.ts`, keeps this the
 * single real subscription to the query — every consumer, imperative or React, relays off it.
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export type ReducedMotionListener = {
  /**
   * The current preference. Reads the latched result of the subscription rather than
   * re-running the query, so the hot path costs a property read.
   */
  readonly matches: () => boolean;
  readonly disconnect: () => void;
  /** Notified after `matches()`'s latched value has already been updated. Returns an unsubscribe function. */
  readonly subscribe: (callback: () => void) => () => void;
};

/**
 * Subscribe to the reduced-motion preference.
 *
 * Returns a listener reporting `false` when `matchMedia` is unavailable — server rendering, and
 * the `node:test` harness, which has no DOM. Defaulting to `false` rather than `true` is the
 * correct fallback: the Framed path's other dignity gate (a `plain` moment always cuts, never
 * flies) is independent of this one and still applies, so an environment that cannot answer the
 * question does not accidentally suppress ordinary camera movement everywhere.
 */
export function createReducedMotionListener(): ReducedMotionListener {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { matches: () => false, disconnect: () => {}, subscribe: () => () => {} };
  }

  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  let latched = query.matches;
  const subscribers = new Set<() => void>();
  const onChange = (event: MediaQueryListEvent): void => {
    latched = event.matches;
    for (const callback of subscribers) callback();
  };

  query.addEventListener('change', onChange);

  return {
    matches: () => latched,
    disconnect: () => {
      query.removeEventListener('change', onChange);
      subscribers.clear();
    },
    subscribe: (callback) => {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
  };
}
