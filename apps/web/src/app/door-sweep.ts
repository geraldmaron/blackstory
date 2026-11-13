/**
 * The decade range the Door's sweep chapter runs over.
 */
import type { ExploreMapFeatureCollection } from '../lib/map-experience/build-explore-map-source';
import { earliestDecadeFor } from '../lib/map-experience/decade-transition';
import type { DecadeRange } from './door-walk';

/** A decade the sweep may open on: one with at least this many records on the plate. */
const SWEEP_FIRST_DECADE_MIN_RECORDS = 3;

/**
 * The decade range the sweep runs over, taken from the pins actually on the plate rather than
 * from the release's own first and last decade. The chapter's claim is about *this* field
 * filling up, so a decade with nothing on this plate is a frame with nothing to show. It opens on
 * the first decade with a few records rather than on a lone early outlier: the sweep is
 * cumulative, so the outlier still shows on that first frame.
 */
export function sweepRange(pins: ExploreMapFeatureCollection): DecadeRange | null {
  const counts = new Map<number, number>();
  for (const feature of pins.features) {
    const decade = earliestDecadeFor(feature);
    if (decade !== null) counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const decades = [...counts.keys()].sort((a, b) => a - b);
  const from =
    decades.find((decade) => (counts.get(decade) ?? 0) >= SWEEP_FIRST_DECADE_MIN_RECORDS) ??
    decades[0]!;
  return { from, to: decades.at(-1)! };
}
