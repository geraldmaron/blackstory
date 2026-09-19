/**
 * Map handoffs. `/` is the Door journey (canonical map product). Browse is a posture of that
 * same surface (morph in place). `/explore` remains the deep-link / share URL for the armed
 * browse posture (no hard 308 to `/`: Chrome caches RSC 308s on `/explore?_rsc=…`).
 *
 * Prefer `enterMapBrowse()` from `map-browse.ts` for in-journey CTAs; keep this href for
 * shareable links, locate handoffs, and cold loads.
 */
export const ATLAS_INSTRUMENT_HREF = '/explore';

/** Primary nav / journey resting state: the Door. */
export const MAP_JOURNEY_HREF = '/';
