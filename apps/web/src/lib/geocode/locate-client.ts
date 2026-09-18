/**
 * Browser-safe wrapper for /locate/api. Keep Node DNS/HTTPS acquisition code out of client
 * bundles. Callers supply request-integrity headers; this module converts HTTP responses into a
 * small result union for the UI.
 */

export type LocateJurisdictionIds = {
  readonly countryId: string;
  readonly stateId?: string;
  readonly countyId?: string;
  readonly placeId?: string;
};

export type LocateMatchSummary = {
  readonly matchedAddress?: string;
  readonly stateName?: string;
  readonly countyName?: string;
  readonly placeName?: string;
};

export type LocatePrecision = {
  readonly tier: string;
  readonly exactCoordinatesRetained: boolean;
  readonly lat?: number;
  readonly lng?: number;
};

export type LocateResolution = {
  readonly match: LocateMatchSummary;
  readonly jurisdictionIds: LocateJurisdictionIds;
  readonly precision: LocatePrecision;
};

export type LocateFallback = {
  readonly available: true;
  readonly reason: string;
  readonly message: string;
  readonly searchHref: string;
};

export type LocateClientResult =
  | { readonly kind: 'resolved'; readonly resolution: LocateResolution; readonly cacheHit: boolean }
  | { readonly kind: 'fallback'; readonly fallback: LocateFallback }
  | { readonly kind: 'rate_limited'; readonly retryAfterSec?: number }
  | { readonly kind: 'request_integrity_denied' }
  | { readonly kind: 'invalid_query'; readonly reason: string }
  | { readonly kind: 'network_error' };

async function callLocateApi(
  searchParams: URLSearchParams,
  integrityHeaders: Readonly<Record<string, string>>,
): Promise<LocateClientResult> {
  let response: Response;
  try {
    response = await fetch(`/locate/api?${searchParams.toString()}`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: integrityHeaders,
    });
  } catch {
    return { kind: 'network_error' };
  }

  const body: unknown = await response.json().catch(() => undefined);

  if (response.status === 401 || response.status === 403) {
    return { kind: 'request_integrity_denied' };
  }
  if (response.status === 429) {
    const retryAfterSec =
      body && typeof body === 'object' && 'retryAfterSec' in body
        ? Number((body as { retryAfterSec: unknown }).retryAfterSec)
        : undefined;
    return { kind: 'rate_limited', ...(retryAfterSec !== undefined ? { retryAfterSec } : {}) };
  }
  if (response.status === 400) {
    const reason =
      body && typeof body === 'object' && 'reason' in body
        ? String((body as { reason: unknown }).reason)
        : 'invalid_request';
    return { kind: 'invalid_query', reason };
  }
  if (response.status !== 200 || !body || typeof body !== 'object') {
    return { kind: 'network_error' };
  }

  const outcome = body as { readonly ok: boolean };
  if (outcome.ok) {
    const success = outcome as {
      readonly ok: true;
      readonly resolution: LocateResolution;
      readonly cacheHit: boolean;
    };
    return { kind: 'resolved', resolution: success.resolution, cacheHit: success.cacheHit };
  }
  const failure = outcome as { readonly ok: false; readonly fallback: LocateFallback };
  return { kind: 'fallback', fallback: failure.fallback };
}

export type FetchLocateByAddressOptions = {
  /**
   * When true, asks `/locate/api` for lat/lng suitable for an explore camera fly-to
   * (`camera=1`). Ordinary jurisdiction lookup leaves this unset.
   */
  readonly forCamera?: boolean;
};

/** Forward geocode: free-text address, city/state, or ZIP.  */
export function fetchLocateByAddress(
  address: string,
  integrityHeaders: Readonly<Record<string, string>> = {},
  options: FetchLocateByAddressOptions = {},
): Promise<LocateClientResult> {
  const params = new URLSearchParams({ address });
  if (options.forCamera) params.set('camera', '1');
  return callLocateApi(params, integrityHeaders);
}

export type FetchLocateByCoordinatesOptions = {
  /**
   * When true, asks `/locate/api` for lat/lng suitable for an explore camera fly-to
   * (`camera=1`). Ordinary jurisdiction lookup leaves this unset.
   */
  readonly forCamera?: boolean;
};

/** Reverse geocode: browser-supplied coordinates (only ever called after explicit user consent).  */
export function fetchLocateByCoordinates(
  lat: number,
  lng: number,
  integrityHeaders: Readonly<Record<string, string>> = {},
  options: FetchLocateByCoordinatesOptions = {},
): Promise<LocateClientResult> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (options.forCamera) params.set('camera', '1');
  return callLocateApi(params, integrityHeaders);
}
