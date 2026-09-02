/**
 * The public place line for a map feature. Same composer as entity-page Where and Visit:
 * `resolvePublicAddressLine`. Never a coordinate. Withheld labels fall back to the state name,
 * then "Place withheld".
 *
 * Kept off `build-explore-map-source.ts` because that module reaches `node:crypto` through the
 * editorial package; this file is imported by client Atlas chrome.
 */
import { resolvePublicAddressLine } from '../geography/public-address';
import type { ExploreMapFeature } from './build-explore-map-source';

export function placeLabelFor(feature: ExploreMapFeature): string {
  const { properties } = feature;
  const line = resolvePublicAddressLine({
    displayName: properties.displayName,
    locationLabel: properties.locationLabel ?? '',
    locationPrecision: properties.precision,
    kind: properties.kind,
    ...(properties.jurisdictionLabel !== undefined
      ? { jurisdictionLabel: properties.jurisdictionLabel }
      : {}),
  });
  if (line !== 'Place withheld') {
    return line;
  }
  const stateName = properties.stateName?.trim();
  if (stateName) {
    return stateName;
  }
  return 'Place withheld';
}
