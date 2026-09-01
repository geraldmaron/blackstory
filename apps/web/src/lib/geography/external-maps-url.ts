/**
 * Builds external map-app search and directions URLs (Google Maps universal links). On phones
 * these typically open Google Maps, Apple Maps, or the user's default maps handler. When
 * coordinates and a place string are both available, the query combines them so readers see a
 * name in their maps app, not a bare lat/lng pair.
 */

export type ExternalMapsSearchInput = {
  readonly query?: string;
  readonly lat?: number;
  readonly lng?: number;
};

function isFiniteCoord(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

/** Combined destination string for maps apps: prose when available, anchored by coords. */
export function buildMapsHandoffQuery(input: ExternalMapsSearchInput): string | undefined {
  const trimmed = input.query?.trim();
  if (isFiniteCoord(input.lat) && isFiniteCoord(input.lng)) {
    const coords = `${input.lat},${input.lng}`;
    if (trimmed && trimmed.length > 0) {
      return `${trimmed} @ ${coords}`;
    }
    return coords;
  }
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/** Google Maps search URL; undefined when neither coords nor query are usable. */
export function buildExternalMapsSearchUrl(input: ExternalMapsSearchInput): string | undefined {
  const destination = buildMapsHandoffQuery(input);
  if (!destination) {
    return undefined;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
}

/** Google Maps directions URL from the user's current location. */
export function buildExternalMapsDirectionsUrl(input: ExternalMapsSearchInput): string | undefined {
  const destination = buildMapsHandoffQuery(input);
  if (!destination) {
    return undefined;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Accessible name for a maps deep link opening in a new tab. */
export function externalMapsLinkLabel(placeLabel: string): string {
  return `Open ${placeLabel} in maps`;
}

/** Accessible name for a directions deep link. */
export function externalMapsDirectionsLabel(placeLabel: string): string {
  return `Get directions to ${placeLabel}`;
}
