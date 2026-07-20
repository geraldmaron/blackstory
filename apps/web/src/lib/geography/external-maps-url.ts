/**
 * Builds external map-app search URLs (Google Maps universal link). On phones this typically
 * opens Google Maps, Apple Maps, or the user’s default maps handler; desktop opens Maps in
 * the browser. Coordinates win over prose labels so coarsened pins open at the stored public
 * point, not a street guess.
 */

export type ExternalMapsSearchInput = {
  readonly query?: string;
  readonly lat?: number;
  readonly lng?: number;
};

function isFiniteCoord(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

/** Google Maps search URL; undefined when neither coords nor query are usable. */
export function buildExternalMapsSearchUrl(input: ExternalMapsSearchInput): string | undefined {
  const { query, lat, lng } = input;
  if (isFiniteCoord(lat) && isFiniteCoord(lng)) {
    const coords = `${lat},${lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`;
  }

  const trimmed = query?.trim();
  if (!trimmed) {
    return undefined;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

/** Accessible name for a maps deep link opening in a new tab. */
export function externalMapsLinkLabel(placeLabel: string): string {
  return `Open ${placeLabel} in maps`;
}
