/**
 * Client-side coarse-only location analytics ("coarse analytics only; no persistent
 * precise-location history"). Structurally mirrors `packages/domain/src/geocode/analytics.ts`'s
 * `buildCoarseLocationAnalyticsEvent` event shape (no lat/lng/address/ZIP fields).
 *
 * `recordCoarseLocationAnalyticsEvent` is the ONLY sink this wires: it logs the event shape
 * (never a resolution, coordinate, address, or ZIP the `CoarseLocationAnalyticsEvent` type has
 * no field for any of them) to the console, the same "real sink is a future integration, this is
 * the structurally-safe interim" posture `../../app/submit/app-check-guard.ts`'s
 * `consoleTelemetry` already uses for App Check events. Wiring a real analytics backend (e.g.
 * BigQuery export, a metrics service) is out of this module's scope.
 */

export type CoarseLocationAnalyticsEventKind =
  | 'geocode_resolved'
  | 'geocode_failed'
  | 'browser_location_used'
  | 'manual_fallback_used';

/**
 * Deliberately excludes `lat`/`lng`/address/ZIP fields the type itself is the enforcement that
 * no precise location can be threaded into an analytics event, not just a convention.
 */
export type CoarseLocationAnalyticsEvent = {
  readonly kind: CoarseLocationAnalyticsEventKind;
  readonly jurisdictionId?: string;
  readonly geoPrecisionTier?: string;
  readonly occurredAt: string;
};

export type CoarseAnalyticsResolutionLike = {
  readonly jurisdictionIds: { readonly stateId?: string; readonly countyId?: string };
  readonly precision: { readonly tier: string };
};

export function buildCoarseLocationAnalyticsEvent(
  kind: CoarseLocationAnalyticsEventKind,
  resolution: CoarseAnalyticsResolutionLike | undefined,
  now: () => string = () => new Date().toISOString(),
): CoarseLocationAnalyticsEvent {
  const jurisdictionId = resolution?.jurisdictionIds.countyId ?? resolution?.jurisdictionIds.stateId;
  return {
    kind,
    occurredAt: now(),
    ...(jurisdictionId ? { jurisdictionId } : {}),
    ...(resolution?.precision.tier ? { geoPrecisionTier: resolution.precision.tier } : {}),
  };
}

export function recordCoarseLocationAnalyticsEvent(event: CoarseLocationAnalyticsEvent): void {
  console.info(JSON.stringify(event));
}
