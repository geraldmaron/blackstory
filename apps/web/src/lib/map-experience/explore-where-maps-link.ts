/**
 * Resolves WHERE-field display text and an external maps href for explore cards and lists.
 * Label and maps query are the same public address line Visit uses (`placeLabelFor`).
 */
import type { ExploreMapFeature } from './build-explore-map-source';
import { buildExternalMapsSearchUrl } from '../geography/external-maps-url';
import { placeLabelFor } from './place-label';

export type ExploreWhereMapsLink = {
  readonly label: string;
  readonly href: string;
  readonly placeLabel: string;
};

function coordinatesFromFeature(
  feature: ExploreMapFeature,
): { readonly lat: number; readonly lng: number } | undefined {
  const [lng, lat] = feature.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined;
  }
  return { lat, lng };
}

/** Maps deep link for a public explore feature; undefined when the pin has no coordinates. */
export function exploreWhereMapsLink(feature: ExploreMapFeature): ExploreWhereMapsLink | undefined {
  const coords = coordinatesFromFeature(feature);
  if (!coords) {
    return undefined;
  }
  const label = placeLabelFor(feature);
  const query = label === 'Place withheld' ? undefined : label;

  const href = buildExternalMapsSearchUrl({
    lat: coords.lat,
    lng: coords.lng,
    ...(query ? { query } : {}),
  });
  if (!href) {
    return undefined;
  }

  return {
    label,
    href,
    placeLabel: label,
  };
}
