/**
 * Builds external map-app search and directions URLs. Google Maps universal links are the
 * server-rendered default; `MapsExternalLink` swaps in the Apple Maps equivalent on Apple devices
 * after mount, so "Open in maps" opens the reader's own maps app. When
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
  // No travel mode: Google's link sets none, and the reader picks walking, transit or driving in
  // the app. Forcing driving (`dirflg=d`) made the two "Directions" exits disagree.
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

/**
 * The Apple Maps equivalent of a Google Maps search or directions URL built above, so one link
 * can open the reader's own maps app: Apple Maps on iPhone, iPad and Mac, Google Maps elsewhere.
 * Returns undefined for anything that is not one of this module's Google URLs.
 */
export function appleMapsUrlFromGoogle(href: string): string | undefined {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return undefined;
  }
  if (url.hostname !== 'www.google.com' || !url.pathname.startsWith('/maps/')) return undefined;
  const directions = url.pathname.startsWith('/maps/dir');
  const destination = url.searchParams.get(directions ? 'destination' : 'query');
  if (!destination) return undefined;
  const match = /^(?:(.*?) @ )?(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(destination.trim());
  const query = match ? match[1] : destination;
  const lat = match ? Number(match[2]) : undefined;
  const lng = match ? Number(match[3]) : undefined;
  const input = {
    ...(query ? { query } : {}),
    ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
  };
  return directions ? buildAppleMapsDirectionsUrl(input) : buildAppleMapsSearchUrl(input);
}

/** True on platforms whose default maps app is Apple Maps. */
export function prefersAppleMaps(userAgent: string, platform = ''): boolean {
  return (
    /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(userAgent) || /^(?:Mac|iPhone|iPad)/i.test(platform)
  );
}
