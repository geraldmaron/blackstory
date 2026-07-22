/**
 * The Explore interaction reducer (MOB-012) — the trickiest requirement in the
 * bead: keep the list and the map synchronized WITHOUT focus theft.
 *
 * ARCHITECTURE (why a reducer, and why a one-way camera command):
 *  - The MAP viewport is the source of truth for WHICH features the list shows.
 *    A map pan emits `viewportChanged`, which updates `viewport` (and therefore
 *    the derived visible set) but emits NO camera command — so panning the map
 *    never fights itself and never scrolls the list to the top.
 *  - The LIST is a passive follower. Scrolling it emits `listScrolled`, a
 *    deliberate NO-OP on camera and viewport. The list scroll position is owned
 *    entirely by the FlatList and is never written back to the camera — so
 *    scrolling the list can never yank the map's camera (no focus theft).
 *  - The camera only ever moves on an EXPLICIT user intent: selecting an entity,
 *    or requesting a named preset. Those emit a `cameraCommand` — a one-shot
 *    imperative the view consumes and then acknowledges (`cameraCommandConsumed`)
 *    so it fires exactly once and is not re-applied on every re-render.
 *
 * This separation is what the reducer tests assert directly: `listScrolled` and
 * `viewportChanged` leave `cameraCommand` undefined; only `entitySelected` /
 * `presetRequested` set it.
 */
import type { FilterState } from '@/app/_lib/route-params';
import {
  cameraForPreset,
  isInBounds,
  type Bbox,
  type CameraPreset,
  type CameraTarget,
  type LngLat,
} from '@/features/map/mapCamera';
import { reconcileSelection } from './selection';
import { applyFilters } from './explore-filter';
import type { ExploreFeature } from './explore-feature';

/** A camera command carries a monotonically increasing token so the view can
 * apply each command exactly once (idempotent consumption). */
export type CameraCommand = CameraTarget & { readonly token: number };

export type ExploreState = {
  readonly filters: FilterState;
  /** Current map viewport bounds; undefined until the map reports its first region. */
  readonly viewport?: Bbox;
  readonly selectedId?: string;
  /** One-shot imperative camera move; undefined when nothing is pending. */
  readonly cameraCommand?: CameraCommand;
  /** Internal monotonic counter for camera command tokens. */
  readonly cameraSeq: number;
};

export function initialExploreState(filters: FilterState = {}): ExploreState {
  return { filters, cameraSeq: 0 };
}

/**
 * The features the synchronized list shows: the deterministic filtered set,
 * intersected with the current map viewport once the map has reported a region.
 * Before the first `viewportChanged` (viewport undefined) the full filtered set
 * shows, so the list is never mysteriously empty on first paint. Pure — same
 * inputs always yield the same ordered output.
 */
export function visibleFeatures(
  all: readonly ExploreFeature[],
  state: ExploreState,
): readonly ExploreFeature[] {
  const filtered = applyFilters(all, state.filters);
  if (!state.viewport) return filtered;
  const viewport = state.viewport;
  return filtered.filter((feature) => isInBounds(feature.coordinates, viewport));
}

export type ExploreAction =
  | { readonly type: 'viewportChanged'; readonly bbox: Bbox }
  | { readonly type: 'filtersChanged'; readonly filters: FilterState }
  | { readonly type: 'entitySelected'; readonly entityId: string; readonly point: LngLat }
  | { readonly type: 'entityDeselected' }
  | { readonly type: 'listScrolled' }
  | {
      readonly type: 'presetRequested';
      readonly preset: CameraPreset;
      readonly point?: LngLat;
      readonly coordinates?: readonly LngLat[];
    }
  | { readonly type: 'cameraCommandConsumed'; readonly token: number }
  | { readonly type: 'availableReconciled'; readonly available: readonly ExploreFeature[] };

function withCamera(state: ExploreState, target: CameraTarget): ExploreState {
  const token = state.cameraSeq + 1;
  return { ...state, cameraSeq: token, cameraCommand: { ...target, token } };
}

/** Shallow equality on the (small, closed) filter shape. */
function sameFilters(a: FilterState, b: FilterState): boolean {
  return a.kind === b.kind && a.era === b.era;
}

/** Shallow equality on a viewport bbox. */
function sameBbox(a: Bbox | undefined, b: Bbox): boolean {
  return (
    a !== undefined &&
    a.west === b.west &&
    a.south === b.south &&
    a.east === b.east &&
    a.north === b.north
  );
}

export function exploreReducer(state: ExploreState, action: ExploreAction): ExploreState {
  switch (action.type) {
    // Map pan -> update what the list shows. NO camera command (never re-drives
    // the camera from its own pan) and NO list reset. Bails out (same reference)
    // when the bbox is unchanged so an idle re-report can't churn React.
    case 'viewportChanged':
      return sameBbox(state.viewport, action.bbox) ? state : { ...state, viewport: action.bbox };

    // Filters are deterministic; changing them re-derives the visible set and its
    // count but does NOT move the camera. Returns the SAME state reference when the
    // filter values are unchanged — this is load-bearing: the route hands a fresh
    // (but equal) filter object on every render, and re-creating state here would
    // loop the effect that syncs it. Reference stability lets React bail out.
    case 'filtersChanged':
      return sameFilters(state.filters, action.filters)
        ? state
        : { ...state, filters: action.filters };

    // Explicit selection: select AND frame the point (user asked to look here).
    case 'entitySelected':
      return withCamera(
        { ...state, selectedId: action.entityId },
        cameraForPreset('point', { point: action.point }),
      );

    case 'entityDeselected':
      return { ...state, selectedId: undefined };

    // The proof of no focus theft: scrolling the list changes nothing about the
    // camera or the viewport. It is a pure no-op at the shared-state level.
    case 'listScrolled':
      return state;

    case 'presetRequested':
      return withCamera(
        state,
        cameraForPreset(action.preset, { point: action.point, coordinates: action.coordinates }),
      );

    case 'cameraCommandConsumed':
      if (state.cameraCommand?.token === action.token) {
        return { ...state, cameraCommand: undefined };
      }
      return state;

    // Active-release swap / withdrawal: drop a selection that no longer exists.
    case 'availableReconciled': {
      const next = reconcileSelection(state.selectedId, action.available);
      return next === state.selectedId ? state : { ...state, selectedId: next };
    }

    default:
      return state;
  }
}
