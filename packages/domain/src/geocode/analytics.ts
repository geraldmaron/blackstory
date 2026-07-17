/**
 * Coarse-only location analytics events (BB-050 deliverable "coarse analytics only; no
 * persistent precise-location history"). `buildCoarseLocationAnalyticsEvent` is the ONLY
 * function in this module and it is the ONLY place a `GeocodeResolution` may be turned into an
 * analytics-shaped record — it accepts a full resolution but its return type
 * (`CoarseLocationAnalyticsEvent`) structurally cannot carry a coordinate, an address string, or
 * a ZIP: there is no field for any of them. A caller wiring real analytics (outside this
 * package) should log/emit ONLY this event shape, never the resolution itself.
 */
import type { CoarseLocationAnalyticsEvent, GeocodeResolution } from './types.js';

export type BuildCoarseLocationAnalyticsEventOptions = {
  readonly now?: () => string;
};

export function buildCoarseLocationAnalyticsEvent(
  kind: CoarseLocationAnalyticsEvent['kind'],
  resolution: GeocodeResolution | undefined,
  options: BuildCoarseLocationAnalyticsEventOptions = {},
): CoarseLocationAnalyticsEvent {
  const occurredAt = (options.now ?? (() => new Date().toISOString()))();
  const jurisdictionId = resolution?.jurisdictionIds.countyId ?? resolution?.jurisdictionIds.stateId;

  return {
    kind,
    occurredAt,
    ...(jurisdictionId ? { jurisdictionId } : {}),
    ...(resolution?.precision.tier ? { geoPrecisionTier: resolution.precision.tier } : {}),
  };
}
