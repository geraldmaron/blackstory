/**
 * Map data-platform module: U.S. geography reference data and the
 * pure, redaction-injected map-source builder. See map-source.ts for the
 * hard invariant this module enforces and the release-pipeline integration
 * point that is not yet wired live.
 */
export {
  US_STATES,
  US_BOUNDS,
  US_CONUS_BOUNDS,
  isWithinUsBounds,
  findUsStateForPoint,
  findUsStateByPostalCode,
} from './us-geography.js';
export type { UsStateInfo } from './us-geography.js';

export { buildMapSource } from './map-source.js';
export type {
  MapSourceRawLocation,
  MapSourceEntityInput,
  MapRedactedLocation,
  MapRedactLocationFn,
  MapPointFeatureProperties,
  MapPointFeature,
  MapFeatureCollection,
  MapStateAggregate,
  MapCountyAggregate,
  MapSourceMeta,
  MapSourceBuildResult,
  BuildMapSourceInput,
} from './map-source.js';

export { aggregateDecadePresence } from './decade-presence.js';
export type {
  StatePresenceEntityInput,
  StateAggregateCount,
  DecadeStateAggregates,
} from './decade-presence.js';

export { buildDecadePresenceAggregates } from './decade-presence-from-spans.js';
export type { DecadePresenceEntityInput } from './decade-presence-from-spans.js';

export {
  MAP_SOURCE_DEMO_FIXTURES,
  PLACE_DC_FIXTURE,
  SCHOOL_DC_FIXTURE,
  PLACE_HARLEM_NY_FIXTURE,
  INSTITUTION_NYC_NY_FIXTURE,
  INSTITUTION_ATLANTA_GA_SENSITIVE_FIXTURE,
  PLACE_CALIFORNIA_STATE_FIXTURE,
  EVENT_NO_LOCATION_FIXTURE,
  LIVING_PERSON_RESIDENCE_FIXTURE,
  UNKNOWN_LIVING_STATUS_EXACT_COORDINATES_FIXTURE,
  DECEASED_RESIDENCE_FIXTURE,
} from './fixtures.js';
