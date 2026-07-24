/**
 * Visit hand-off helpers: open the device maps app at public-precision coordinates.
 * Never invents finer coordinates than the caller provides.
 *
 * Order: try `geo:` first (native maps handlers), then Apple Maps / Google Maps HTTPS
 * fallbacks via `Linking.openURL`. Optional `label` enriches the query when present.
 */
import { Linking, Platform } from 'react-native';

export type MapsHandoffResult = 'opened' | 'failed' | 'unavailable';

export type OpenExternalMapsArgs = {
  readonly lat: number;
  readonly lng: number;
  /** Optional place label for Apple/Google query strings (coords still required). */
  readonly label?: string;
};

function isFiniteCoord(value: number): boolean {
  return Number.isFinite(value);
}

function mapsQuery(lat: number, lng: number, label?: string): string {
  const coords = `${lat},${lng}`;
  const trimmed = typeof label === 'string' ? label.trim() : '';
  if (trimmed.length === 0) return coords;
  return `${trimmed} @ ${coords}`;
}

/** Builds the candidate URI list for a public-precision pin — geo first, then web fallbacks. */
export function buildMapsHandoffUris(
  lat: number,
  lng: number,
  label?: string,
): readonly string[] {
  if (!isFiniteCoord(lat) || !isFiniteCoord(lng)) return [];
  const coords = `${lat},${lng}`;
  const query = mapsQuery(lat, lng, label);
  const geoUri =
    typeof label === 'string' && label.trim().length > 0
      ? `geo:${lat},${lng}?q=${encodeURIComponent(query)}`
      : `geo:${lat},${lng}`;
  const googleUri = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const appleUri =
    typeof label === 'string' && label.trim().length > 0
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(label.trim())}`
      : `http://maps.apple.com/?ll=${lat},${lng}`;
  if (Platform.OS === 'ios') {
    return [geoUri, appleUri, googleUri];
  }
  return [geoUri, googleUri, appleUri];
}

/**
 * Opens the preferred maps app at public-precision coordinates.
 * Returns `unavailable` when coords are not finite; `failed` when every candidate rejects.
 */
export async function openExternalMaps(args: OpenExternalMapsArgs): Promise<MapsHandoffResult> {
  const { lat, lng, label } = args;
  const uris = buildMapsHandoffUris(lat, lng, label);
  if (uris.length === 0) return 'unavailable';

  for (const uri of uris) {
    try {
      await Linking.openURL(uri);
      return 'opened';
    } catch {
      // Try the next fallback.
    }
  }
  return 'failed';
}

/**
 * @deprecated Prefer `openExternalMaps({ lat, lng, label? })`. Kept for callers that pass bare coords.
 */
export async function openMapsAtPublicAnchor(lat: number, lng: number): Promise<MapsHandoffResult> {
  return openExternalMaps({ lat, lng });
}
