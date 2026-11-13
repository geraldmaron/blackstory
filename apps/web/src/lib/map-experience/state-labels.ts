/**
 * State abbreviation label points for the explore map.
 *
 * Drawn by the `explore-state-label` symbol layers in `app/map/explore-style.ts`, not as DOM
 * markers: a symbol layer sits in MapLibre's one collision pass, so a label beneath the group
 * circles in the style yields to a group count instead of printing across it, and city labels
 * no longer collide with state labels they could not see. This module is pure data so it stays
 * unit-testable in plain Node.
 */
// Subpath import (not the package barrel): the barrel re-exports ./publication, which pulls in
// `node:crypto` at module scope. This module reaches MapStage.tsx ('use client') through the style, so
// barrel-importing here would drag a Node-only module into the browser bundle.
import { US_STATES, type UsStateInfo } from '@repo/domain/map/geography';
import { MAP_MIN_ZOOM } from './camera-presets';

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
 * zoom <= 6.2, opacity fade starting at 5.6). The symbol layers' `text-opacity` interpolates
 * between these stops. */
export const STATE_LABEL_FADE_START_ZOOM = 5.6;
export const STATE_LABEL_FADE_END_ZOOM = 6.2;

/**
 * The band's lower edge. Below the Instrument's national floor (`MAP_MIN_ZOOM`) the plate is at
 * continental scale — the Door's phone strip fits the whole country into a couple of hundred
 * pixels — and two-letter labels overlap each other across the Northeast. No mature
 * map draws region names at that scale, so the labels fade out under the floor and are gone by
 * `STATE_LABEL_APPEAR_START_ZOOM`.
 */
export const STATE_LABEL_APPEAR_START_ZOOM = 2.4;
export const STATE_LABEL_APPEAR_END_ZOOM = MAP_MIN_ZOOM;
