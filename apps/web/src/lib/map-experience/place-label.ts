/**
 * The public place line for a map feature. Same composer as entity-page Where and Visit:
 * `resolvePublicAddressLine`. Never a coordinate. Withheld labels fall back to the state name,
 * then "Place withheld".
 *
 * Kept off `build-explore-map-source.ts` because that module reaches `node:crypto` through the
 * editorial package; this file is imported by client Explore chrome.
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

/**
 * The place line as it reads *next to the record's own name*.
 *
 * `placeLabelFor` composes a full public address, which for a place record is usually the record's
 * own name plus its city and state: "100 Block North Greenwood Avenue, Tulsa, Oklahoma". Printed
 * directly under a heading that already says "100 Block North Greenwood Avenue", the first half is
 * noise the reader has to read past twice. This drops the duplicated head and returns what the
 * address actually adds — "Tulsa, Oklahoma".
 *
 * Only an exact, comma-terminated head is dropped, and only when something is left over. A place
 * whose entire address is its name keeps the full line rather than rendering blank.
 */
export function placeDetail(name: string, place: string): string {
  const head = name.trim();
  const line = place.trim();
  if (head.length === 0 || !line.toLowerCase().startsWith(`${head.toLowerCase()},`)) {
    return line;
  }
  const rest = line.slice(head.length + 1).trim();
  return rest.length > 0 ? rest : line;
}
