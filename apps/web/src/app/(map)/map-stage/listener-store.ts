import type { ExploreViewportFrame } from '../../../lib/map-experience/url-state';

export type MapStageEvents = {
  select: [entityId: string];
  stateSelect: [postalCode: string];
  edgeSelect: [edgeId: string];
  /** Fired on a background click when nothing else (state, edge) was hit — the
   * `activateOnBackgroundClick` behavior `HomeMapHero` used to opt into via a prop. Now every
   * surface gets the event; only the ones that `subscribe('activate', …)` act on it, which is an
   * equivalent opt-in. */
  activate: [viewport: ExploreViewportFrame];
  viewport: [viewport: ExploreViewportFrame];
  error: [];
};

export type MapStageEventName = keyof MapStageEvents;
export function makeListenerStore(): {
  [K in MapStageEventName]: Set<(...args: MapStageEvents[K]) => void>;
} {
  return {
    select: new Set(),
    stateSelect: new Set(),
    edgeSelect: new Set(),
    activate: new Set(),
    viewport: new Set(),
    error: new Set(),
  };
}

export function notify<E extends MapStageEventName>(
  listeners: ReturnType<typeof makeListenerStore>,
  event: E,
  ...args: MapStageEvents[E]
): void {
  for (const handler of listeners[event]) {
    handler(...args);
  }
}
