import type { ExploreViewportFrame } from '../../lib/map-experience/url-state';

export type MapStageEvents = {
  select: [entityId: string];
  /** Clears an open record selection when the reader drills into a cluster aggregate. */
  deselect: [];
  stateSelect: [postalCode: string];
  edgeSelect: [edgeId: string];
  /** Fired on a background click when nothing else (state, edge) was hit — the
   * `activateOnBackgroundClick` behavior `HomeMapHero` used to opt into via a prop. Now every
   * surface gets the event; only the ones that `subscribe('activate', …)` act on it, which is an
   * equivalent opt-in. */
  activate: [viewport: ExploreViewportFrame];
  viewport: [viewport: ExploreViewportFrame];
  /** Camera bearing, in degrees — fired on every native `rotate` frame (drag, twist, or a
   * scripted move), not just on `moveend` like `viewport`. Kept separate from `viewport` so the
   * compass needle can track a live rotate-drag without waking every `viewport` subscriber (URL
   * sync included) on each frame. */
  rotate: [bearing: number];
  /** The plate has painted geography and stamped `data-plate-ready` (MapStage.tsx). Fires once
   * per plate life; `subscribe` replays it to a late subscriber, the way `viewport` replays,
   * because the plate outlives pages and is usually already revealed when a page arrives. */
  ready: [];
  error: [];
  /** An entity marker gained/lost hover intent (after the caller's own delay) or DOM focus.
   * `null` clears it — same "current value, not a delta" convention as the other selection
   * events. Pin-photo cards (`PinPhotoCard`) are the only subscriber today. */
  pinHover: [
    target: { readonly entityId: string; readonly name: string; readonly rect: DOMRect } | null,
  ];
};

export type MapStageEventName = keyof MapStageEvents;
export function makeListenerStore(): {
  [K in MapStageEventName]: Set<(...args: MapStageEvents[K]) => void>;
} {
  return {
    select: new Set(),
    deselect: new Set(),
    stateSelect: new Set(),
    edgeSelect: new Set(),
    activate: new Set(),
    viewport: new Set(),
    rotate: new Set(),
    ready: new Set(),
    error: new Set(),
    pinHover: new Set(),
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
