/**
 * Browser-safe fetch wrapper for the `/locate/api` geocode endpoint. Deliberately
 * separate from `./pipeline.ts` and `./safe-http-client.ts` both of those pull in Node's
 * `dns`/`https` modules and must never reach a browser bundle. This module only ever calls
 * `fetch('/locate/api',...)` from a Client Component and re-shapes the JSON response into a
 * small discriminated union the UI can switch on directly, instead of the UI parsing raw HTTP
 * status codes and route-specific error bodies itself.
 *
 * App Check headers are passed in by the caller (`components/location/LocateExperience.tsx`,
 * sourced from `../../app/locate/app-check-client.ts`) rather than fetched by this module
 * keeping this file free of any `app/` import mirrors how `apps/web/src/app/submit/SubmitLeadForm.tsx`
 * calls its own co-located `app-check-client.ts` directly rather than through a shared `lib/`
 * layer, and keeps this module usable from any future caller with a different App Check source.
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
  | { readonly kind: 'app_check_denied' }
  | { readonly kind: 'invalid_query'; readonly reason: string }
  | { readonly kind: 'network_error' };

async function callLocateApi(
  searchParams: URLSearchParams,
  appCheckHeaders: Readonly<Record<string, string>>,
): Promise<LocateClientResult> {
  let response: Response;
  try {
    response = await fetch(`/locate/api?${searchParams.toString()}`, {
      method: 'GET',
      headers: appCheckHeaders,
    });
  } catch {
    return { kind: 'network_error' };
  }

  const body: unknown = await response.json().catch(() => undefined);

  if (response.status === 401) {
    return { kind: 'app_check_denied' };
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
    const success = outcome as { readonly ok: true; readonly resolution: LocateResolution; readonly cacheHit: boolean };
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
  appCheckHeaders: Readonly<Record<string, string>> = {},
  options: FetchLocateByAddressOptions = {},
): Promise<LocateClientResult> {
  const params = new URLSearchParams({ address });
  if (options.forCamera) params.set('camera', '1');
  return callLocateApi(params, appCheckHeaders);
}

/** Reverse geocode: browser-supplied coordinates (only ever called after explicit user consent).  */
export function fetchLocateByCoordinates(
  lat: number,
  lng: number,
  appCheckHeaders: Readonly<Record<string, string>> = {},
): Promise<LocateClientResult> {
  return callLocateApi(new URLSearchParams({ lat: String(lat), lng: String(lng) }), appCheckHeaders);
}
