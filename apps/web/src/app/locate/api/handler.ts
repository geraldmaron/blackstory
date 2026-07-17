/**
 * Testable core of the public `/locate` geocode endpoint (BB-050), kept OUT of `route.ts` on
 * purpose — same reason as `apps/web/src/app/search/api/handler.ts`: Next.js's route-file type
 * validator rejects any export from a `route.ts` other than HTTP method handlers and route
 * config, so the dependency-injectable handler lives here where `route.test.ts` can import it.
 * `route.ts` is a thin Next entry that wires production singletons and delegates to
 * `handleLocateRequest` below.
 *
 * One query parameter selects the lookup mode — `address` (free text or ZIP), or `lat`+`lng`
 * (browser geolocation reverse lookup). Exactly one mode must be present; a request with none or
 * more than one is a 400. Every success/failure path returns HTTP 200 (`{ ok: true, ... }` or
 * `{ ok: false, fallback }`) rather than a 4xx/5xx for "no match" or "geocoder unavailable" —
 * those are expected, handleable outcomes for this endpoint's caller (BB-050 acceptance criterion
 * 4, "geocoder failure provides manual place search"), not request errors.
 */
import { NextResponse } from 'next/server';
import {
  geocodeAddress,
  reverseGeocodeCoordinates,
  translateZipToPlace,
  type LocateCache,
} from '../../../lib/geocode/pipeline';
import type { fetchCensusAddressGeocode, fetchCensusCoordinatesGeocode } from '@black-book/domain';
import type { LocateAppCheckGuard } from './app-check-guard';
import type { createLocateRateLimitGuard } from './rate-limit-guard';

export type LocateRouteDependencies = {
  readonly appCheckGuard: LocateAppCheckGuard;
  readonly rateLimitGuard: ReturnType<typeof createLocateRateLimitGuard>;
  readonly cache: LocateCache;
  /** Test-only injection seams — production wiring (`./route.ts`) never overrides these; the
   * pipeline's real defaults (backed by `../../../lib/geocode/safe-http-client.ts`) apply. */
  readonly fetchAddressGeocode?: typeof fetchCensusAddressGeocode;
  readonly fetchCoordinatesGeocode?: typeof fetchCensusCoordinatesGeocode;
};

function jsonError(status: number, error: string, extra?: Record<string, unknown>): Response {
  return NextResponse.json({ error, ...extra }, { status });
}

function clientIpFrom(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || undefined;
}

const ZIP_ONLY_PATTERN = /^\d{5}(-\d{4})?$/;

/**
 * Shared handler used by both the exported Next.js `GET` (production defaults) and `route.test.ts`
 * (injected fake App Check verifier, deterministic rate-limit clock, injected fetch fakes so no
 * real Census network call ever happens in tests). Ordering mirrors BB-049's search route: App
 * Check guard -> rate-limit guard -> input parsing -> geocode pipeline, with a `finally` that
 * always releases the concurrency slot.
 */
export async function handleLocateRequest(
  request: Request,
  deps: LocateRouteDependencies,
): Promise<Response> {
  const clientIp = clientIpFrom(request);

  const appCheckDecision = await deps.appCheckGuard({ headers: request.headers });
  if (!appCheckDecision.allowed) {
    return jsonError(appCheckDecision.status, 'app_check_required', {
      reason: appCheckDecision.reason,
    });
  }

  const rateDecision = deps.rateLimitGuard.evaluate({
    subject: 'anonymous',
    ...(clientIp ? { clientIp } : {}),
    appCheckVerified: appCheckDecision.verified,
  });
  if (!rateDecision.allowed) {
    const response = deps.rateLimitGuard.formatDeniedResponse(rateDecision);
    return NextResponse.json(response.body, {
      status: response.status,
      headers: response.headers,
    });
  }

  try {
    const url = new URL(request.url);
    const addressParam = url.searchParams.get('address');
    const latParam = url.searchParams.get('lat');
    const lngParam = url.searchParams.get('lng');

    const modesProvided = [addressParam !== null, latParam !== null || lngParam !== null].filter(
      Boolean,
    ).length;
    if (modesProvided !== 1) {
      return jsonError(400, 'invalid_locate_query', {
        reason: 'exactly_one_of_address_or_coordinates_required',
      });
    }

    if (addressParam !== null) {
      if (!addressParam.trim()) {
        return jsonError(400, 'invalid_locate_query', { reason: 'empty_address' });
      }
      const outcome = ZIP_ONLY_PATTERN.test(addressParam.trim())
        ? await translateZipToPlace(addressParam, deps.cache, undefined, deps.fetchAddressGeocode)
        : await geocodeAddress({
            address: addressParam,
            cache: deps.cache,
            ...(deps.fetchAddressGeocode ? { fetchAddressGeocode: deps.fetchAddressGeocode } : {}),
          });
      return NextResponse.json(outcome, { status: 200 });
    }

    if (latParam === null || lngParam === null) {
      return jsonError(400, 'invalid_locate_query', { reason: 'lat_and_lng_both_required' });
    }
    const lat = Number.parseFloat(latParam);
    const lng = Number.parseFloat(lngParam);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return jsonError(400, 'invalid_locate_query', { reason: 'coordinates_out_of_range' });
    }

    const outcome = await reverseGeocodeCoordinates({
      lat,
      lng,
      cache: deps.cache,
      ...(deps.fetchCoordinatesGeocode ? { fetchCoordinatesGeocode: deps.fetchCoordinatesGeocode } : {}),
    });
    return NextResponse.json(outcome, { status: 200 });
  } finally {
    deps.rateLimitGuard.release(rateDecision.key);
  }
}
