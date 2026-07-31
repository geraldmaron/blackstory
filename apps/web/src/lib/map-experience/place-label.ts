/**
 * The public place line for a feature: released prose first, then the state, then an explicit
 * admission that no location is published. Never a coordinate — a record whose location is
 * withheld must read as withheld, not as a blank.
 *
 * Its own module, importing the feature type and nothing else, because four surfaces render it
 * (camera announcements, the record sheet, the results rail, the palette index) and two of them
 * are client components. `build-explore-map-source.ts`, where the type lives, reaches
 * `@repo/domain/editorial` and through it `node:crypto`, so a value import from there drags the
 * confidence engine into the browser bundle and the build fails on an unhandled `node:` scheme.
 */
import type { ExploreMapFeature } from './build-explore-map-source';

export function placeLabelFor(feature: ExploreMapFeature): string {
  return feature.properties.locationLabel ?? feature.properties.stateName ?? 'Place not published';
}
