/**
 * Resolves WHERE-field display text and an external maps href for explore cards and lists.
 */
import { findUsStateByPostalCode } from '@repo/domain/map/geography';
import type { ExploreMapFeature } from './build-explore-map-source';
import { buildExternalMapsSearchUrl } from '../geography/external-maps-url';

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

function labelFromFeature(feature: ExploreMapFeature): string | undefined {
  const { properties } = feature;
  const locationLabel = properties.locationLabel?.trim();
  if (locationLabel) {
    return locationLabel;
  }

  const statePostalCode = properties.statePostalCode?.trim().toUpperCase();
  if (statePostalCode) {
    return findUsStateByPostalCode(statePostalCode)?.name ?? statePostalCode;
  }

  return undefined;
}

/** Maps deep link for a public explore feature; undefined when no location signal exists. */
export function exploreWhereMapsLink(feature: ExploreMapFeature): ExploreWhereMapsLink | undefined {
  const coords = coordinatesFromFeature(feature);
  const label = labelFromFeature(feature);
  const statePostalCode = feature.properties.statePostalCode?.trim().toUpperCase();
  const query = label ?? statePostalCode;

  const href = buildExternalMapsSearchUrl({
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    ...(query ? { query } : {}),
  });
  if (!href) {
    return undefined;
  }

  const displayLabel = label ?? statePostalCode ?? 'this location';
  const placeLabel = label ?? displayLabel;

  return {
    label: displayLabel,
    href,
    placeLabel,
  };
}
