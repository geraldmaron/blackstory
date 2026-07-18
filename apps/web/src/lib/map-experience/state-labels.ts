/**
 * State abbreviation label markers for the `/explore` national map ().
 *
 * Rendered as HTML markers, not a MapLibre `symbol` layer: this style has no `glyphs` URL
 * configured (no self-hosted font/sprite server yet see ADR-013 "known gaps", the same reason
 * `explore-style.ts`'s cluster-count label is already a documented no-op) so a `text-field`
 * symbol layer would silently render nothing here. DOM markers sidestep that gap entirely and
 * are design-direction-v3.md's documented default for this label set.
 *
 * This module is pure data + a DOM-element factory; it never touches a live `maplibregl.Map`
 * instance mounting/positioning markers against a real map is the consuming surface's job (see
 * the integration contract in `buildStateLabelMarkers`'s doc comment below). That keeps this
 * module unit-testable in plain Node, the same split `marker-size.ts` and `kind-encoding.ts` use.
 */
// Subpath import (not the package barrel): the barrel re-exports ./publication, which pulls in
// `node:crypto` at module scope. This module is imported by MapStage.tsx ('use client'), so
// barrel-importing here would drag a Node-only module into the browser bundle.
import { US_STATES, type UsStateInfo } from '@repo/domain/map/geography';
import { brandPalette, darkTheme } from '@repo/ui';

export type StateLabelPoint = {
  readonly postalCode: string;
  readonly name: string;
  readonly lng: number;
  readonly lat: number;
};

/**
 * Documented label-point overrides for states whose bbox centroid lands somewhere that reads as
 * "wrong" (open water, the wrong peninsula, a mid-ocean gap between islands) rather than
 * plausibly on the state itself. Every override is a named, reasoned exception; every other
 * state uses its plain bbox centroid (`bboxCentroid` below).
 */
const LABEL_POINT_OVERRIDES: Readonly<Record<string, readonly [lng: number, lat: number]>> = {
  // Alaska's bbox stretches west to the Aleutian tail; the raw bbox centroid still lands inside
  // the state, but well west of where most of its documented history sits. Pin to
  // interior/south-central Alaska (near Denali) instead.
  AK: [-152.0, 64.0],
  // Hawaii's bbox centroid lands in open ocean, in the channel between Maui and Oahu. Pin to
  // Oahu (Honolulu), the state's most legible island.
  HI: [-157.86, 21.31],
  // Florida's bbox centroid (~-83.8, 27.7) lands in the Gulf of Mexico west of Tampa: the
  // panhandle pulls the bbox's western edge far past the peninsula's actual width at that
  // latitude. Pin to the central peninsula instead (near Orlando).
  FL: [-81.5, 28.5],
  // Michigan's two peninsulas straddle Lake Michigan/Huron; the bbox centroid lands in open
  // water between them. Pin to the Lower Peninsula (the state's population center).
  MI: [-84.5, 43.3],
};

function bboxCentroid(bbox: UsStateInfo['bbox']): readonly [lng: number, lat: number] {
  const [west, south, east, north] = bbox;
  return [(west + east) / 2, (south + north) / 2];
}

/** All 51 state/D.C. label points (bbox centroid, or a documented override above). */
export function stateLabelPoints(): readonly StateLabelPoint[] {
  return US_STATES.map((state) => {
    const [lng, lat] = LABEL_POINT_OVERRIDES[state.postalCode] ?? bboxCentroid(state.bbox);
    return { postalCode: state.postalCode, name: state.name, lng, lat };
  });
}

/** Zoom band the labels are visible in (design-direction-v3.md "State labels": visible at
 * zoom <= 6.2, opacity fade starting at 5.6). */
export const STATE_LABEL_FADE_START_ZOOM = 5.6;
export const STATE_LABEL_FADE_END_ZOOM = 6.2;

/** 1 at/below the fade-start zoom, 0 at/above the fade-end zoom, linear in between. Shaped like
 * a MapLibre `interpolate` stop pair so the same curve could drive a `text-opacity` paint
 * property directly if this ever migrates off HTML markers onto a symbol layer. */
export function stateLabelOpacityForZoom(zoom: number): number {
  if (zoom <= STATE_LABEL_FADE_START_ZOOM) return 1;
  if (zoom >= STATE_LABEL_FADE_END_ZOOM) return 0;
  const span = STATE_LABEL_FADE_END_ZOOM - STATE_LABEL_FADE_START_ZOOM;
  return 1 - (zoom - STATE_LABEL_FADE_START_ZOOM) / span;
}

export type StateLabelMarkerDescriptor = {
  readonly postalCode: string;
  readonly name: string;
  readonly lngLat: readonly [lng: number, lat: number];
  readonly text: string;
  readonly selected: boolean;
};

/**
 * Pure descriptor list for all 51 state labels. Selecting a state only changes `selected`
 * (color); position and text never move, so a caller can key markers by `postalCode` and reuse
 * the same 51 `maplibregl.Marker` instances across re-renders instead of tearing them down.
 */
export function buildStateLabelMarkers(selectedPostalCode?: string): readonly StateLabelMarkerDescriptor[] {
  return stateLabelPoints().map((point) => ({
    postalCode: point.postalCode,
    name: point.name,
    lngLat: [point.lng, point.lat] as const,
    text: point.postalCode,
    selected: point.postalCode === selectedPostalCode,
  }));
}

export const STATE_LABEL_CLASS_NAME = 'ds-state-label';
export const STATE_LABEL_SELECTED_CLASS_NAME = 'ds-state-label--selected';

/**
 * Builds a label's DOM element: IBM Plex Mono caps, Stone-on-dark, copper when selected, never
 * interactive. Browser-only (calls `document.createElement`) callers must not invoke this in a
 * non-DOM context (SSR/Node tests); `stateLabelPoints`/`buildStateLabelMarkers` above are this
 * module's SSR/test-safe surface.
 *
 * Collision policy (design-direction-v3.md "never colliding with markers"): these labels get NO
 * automatic collision avoidance MapLibre's built-in symbol-layer collision detection does not
 * apply to `Marker` DOM elements, and true per-frame collision avoidance against the entity
 * layer is out of scope here. Mitigation is structural instead: `pointer-events: none` (a label
 * never blocks a click reaching a marker or cluster beneath it), a modest fixed font size/line
 * box (small footprint), and the fact that these labels are only visible at national/regional
 * zoom (<= 6.2), where entities are still clustered (see `EXPLORE_CLUSTER_CONFIG.clusterMaxZoom`
 * = 9) rather than rendered as dense individual points. The mounting surface should stack these
 * markers' DOM nodes below the entity/cluster marker layer (e.g. a lower z-index or insertion
 * order) as a further belt-and-suspenders measure.
 */
export function buildStateLabelElement(descriptor: StateLabelMarkerDescriptor): HTMLDivElement {
  const el = document.createElement('div');
  el.className = descriptor.selected
    ? `${STATE_LABEL_CLASS_NAME} ${STATE_LABEL_SELECTED_CLASS_NAME}`
    : STATE_LABEL_CLASS_NAME;
  el.textContent = descriptor.text;
  // Decorative echo of the state boundary already selectable via the app's own state-select
  // affordance (SynchronizedResultList / URL state); screen reader users get 51 scattered
  // two-letter text nodes with no additional context, so this is hidden rather than announced.
  el.setAttribute('aria-hidden', 'true');
  el.style.pointerEvents = 'none';
  el.style.userSelect = 'none';
  el.style.whiteSpace = 'nowrap';
  el.style.fontFamily = 'var(--ds-font-mono)';
  el.style.textTransform = 'uppercase';
  el.style.letterSpacing = '0.08em';
  el.style.fontSize = '0.6875rem';
  el.style.fontWeight = '500';
  el.style.color = descriptor.selected ? brandPalette.copperDark : darkTheme.inkMuted;
  return el;
}
