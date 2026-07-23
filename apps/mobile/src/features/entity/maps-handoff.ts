/**
 * Visit hand-off helpers for entity detail: open the device maps app at the record's
 * public-precision `geoAnchor` only. Never invents finer coordinates than the anchor provides.
 *
 * Order: try `geo:` first (native maps handlers), then Apple Maps / Google Maps HTTPS fallbacks
 * via `Linking.openURL`. Callers must pass the stored public lat/lng unchanged.
 */
import { Linking, Platform } from 'react-native';

export type MapsHandoffResult = 'opened' | 'failed' | 'unavailable';

function isFiniteCoord(value: number): boolean {
  return Number.isFinite(value);
}

/** Builds the candidate URI list for a public-precision pin — geo first, then web fallbacks. */
export function buildMapsHandoffUris(lat: number, lng: number): readonly string[] {
  if (!isFiniteCoord(lat) || !isFiniteCoord(lng)) return [];
  const coords = `${lat},${lng}`;
  const geoUri = `geo:${lat},${lng}`;
  const googleUri = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`;
  const appleUri = `http://maps.apple.com/?ll=${lat},${lng}`;
  if (Platform.OS === 'ios') {
    return [geoUri, appleUri, googleUri];
  }
  return [geoUri, googleUri, appleUri];
}

/**
 * Opens maps at the given public-precision coordinates. Returns `unavailable` when coords are
 * not finite; `failed` when every candidate URI rejects; never throws.
 */
export async function openMapsAtPublicAnchor(lat: number, lng: number): Promise<MapsHandoffResult> {
  const uris = buildMapsHandoffUris(lat, lng);
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
