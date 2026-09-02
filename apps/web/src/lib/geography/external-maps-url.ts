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

/**
 * Apple Maps. Two shapes, chosen by what the record can honestly claim:
 * - a prose destination (an address line or a place label) goes in `q`, anchored by `ll` when
 *   coordinates exist so the app lands on the archive's point and not a same-name place elsewhere;
 * - coordinates alone go in `ll`.
 * Apple's URL scheme is documented at developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html.
 */
export function buildAppleMapsSearchUrl(input: ExternalMapsSearchInput): string | undefined {
  const trimmed = input.query?.trim();
  const hasCoords = isFiniteCoord(input.lat) && isFiniteCoord(input.lng);
  if (!trimmed && !hasCoords) {
    return undefined;
  }
  const params = new URLSearchParams();
  if (trimmed) params.set('q', trimmed);
  if (hasCoords) params.set('ll', `${input.lat},${input.lng}`);
  return `https://maps.apple.com/?${params.toString()}`;
}

/** Apple Maps directions from the user's current location (`daddr`). */
export function buildAppleMapsDirectionsUrl(input: ExternalMapsSearchInput): string | undefined {
  const trimmed = input.query?.trim();
  const hasCoords = isFiniteCoord(input.lat) && isFiniteCoord(input.lng);
  if (!trimmed && !hasCoords) {
    return undefined;
  }
  const params = new URLSearchParams();
  // A prose destination routes to the address; coordinates alone route to the point. When both
  // exist the address wins for routing (it is what a driver needs) and `ll` disambiguates.
  params.set('daddr', trimmed && trimmed.length > 0 ? trimmed : `${input.lat},${input.lng}`);
  if (trimmed && hasCoords) params.set('ll', `${input.lat},${input.lng}`);
  params.set('dirflg', 'd');
  return `https://maps.apple.com/?${params.toString()}`;
}

/** Accessible name for a maps deep link opening in a new tab. */
export function externalMapsLinkLabel(placeLabel: string): string {
  return `Open ${placeLabel} in maps`;
}

/** Accessible name for a directions deep link. */
export function externalMapsDirectionsLabel(placeLabel: string): string {
  return `Get directions to ${placeLabel}`;
}
