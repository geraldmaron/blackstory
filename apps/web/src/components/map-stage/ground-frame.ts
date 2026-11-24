/**
 * The camera a record's stored precision allows when the map lands on it (the home film and the
 * Door's tour). Precision governs the camera (P-03): only a site-precision record gets the pitched
 * frame and imagery; anything coarser is framed flat, no closer than its precision allows. A
 * quiet record (violence-adjacent) is flat, on the plain plate (P-04).
 *
 * The record page no longer hands itself to the persistent plate; its map is an exhibit in the
 * page (`RecordMap`). This file goes with its last two callers (DESIGN.md phases 4b and 7).
 */
import { recordMarkFor, zoomForLocationPrecision } from '../../lib/map-experience/geo-precision';

/** Closest frame: near enough to read the block, never an address-level view. */
export const GROUND_MAX_ZOOM = 13;
/**
 * 45, not steeper: a tilted view reaches toward the horizon and fetches imagery for all of it.
 * At 55 a desktop record page pulled about twice the close-up tiles it does at 40
 * (design-direction-v11.md §14.3).
 */
export const GROUND_SITE_PITCH = 45;

/** The camera a record's stored precision allows. Exported for the test. */
export function groundFrameFor(precision: string, quiet: boolean) {
  const site = recordMarkFor(precision) === 'dot' && !quiet;
  return {
    zoom: Math.min(zoomForLocationPrecision(precision), GROUND_MAX_ZOOM),
    pitch: site ? GROUND_SITE_PITCH : 0,
    imagery: site,
  };
}
