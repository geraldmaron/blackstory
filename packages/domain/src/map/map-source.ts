/**
 * Map data-platform source builder.
 *
 * This module builds the public map GeoJSON + state/county presence aggregates
 * from active public projections. It is a pure, dependency-injected module: it
 * has ZERO runtime dependency on `@blap/security` (that package already
 * depends on `@blap/domain`, so the reverse edge would be a circular
 * workspace dependency) and it never reads a raw coordinate for output.
 *
 * The hard invariant: every location
 * that reaches a feature or aggregate MUST come from the return value of the
 * injected `redactLocation` port, never from the raw `location` field on the
 * input. `redactLocation` is structurally typed to match
 * `redactLocationForPublic` from `@blap/security` callers wire the
 * real function in; see `fixtures.ts` and `map-source.redaction.test.ts` for
 * the wiring and the regression test that proves the invariant against the
 * real security package.
 *
 * Not wired live: see docs/adr/ADR-013-map-stack.md ("Release-coupled build") and
 * workers/publication/MAP_SOURCE_INTEGRATION.md. On release activation, the release
 * pipeline should call `buildMapSource` with every active public projection that
 * carries a location, using `redactLocationForPublic` (or `toPublicEntityProjection`'s
 * location step) from `@blap/security` as the `redactLocation` port, then
 * persist the result alongside the release manifest so rollback restores the prior
 * map version the same way it restores the prior search-index version.
 */

import { US_BOUNDS, findUsStateForPoint, isWithinUsBounds } from './us-geography.js';

/** Raw (pre-redaction) location fields a caller may hold internally. */
export type MapSourceRawLocation = {
  readonly precision: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly geohash?: string;
  readonly matchMethod?: string;
  readonly label?: string;
  readonly sensitivityClass?: string;
  readonly occupiedPrivateResidence?: boolean;
  readonly neededForPublic?: boolean;
  /**
   * Optional county hint resolved upstream from the entity's jurisdiction
   * records (see `@blap/domain` geography `Jurisdiction`). This module
   * never derives a county from coordinates real county attribution needs
   * polygon boundary data this repo does not vendor (see ADR-013). Without a
   * hint, the entity's point still contributes to the state aggregate; it is
   * simply absent from the county aggregate.
   */
  readonly county?: { readonly name: string; readonly fipsCode?: string };
};

export type MapSourceEntityInput = {
  readonly entityId: string;
  readonly kind: string;
  readonly displayName: string;
  readonly livingStatus?: string;
  readonly location?: MapSourceRawLocation;
};

/** Structurally matches `PublicLocation` from `@blap/security`. */
export type MapRedactedLocation = {
  readonly precision: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly geohash?: string;
  readonly matchMethod?: string;
  readonly label?: string;
  readonly reductionReason?: string;
};

/** Structurally matches `redactLocationForPublic` from `@blap/security`. */
export type MapRedactLocationFn = (input: {
  readonly precision: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly geohash?: string;
  readonly matchMethod?: string;
  readonly label?: string;
  readonly livingStatus?: string;
  readonly sensitivityClass?: string;
  readonly occupiedPrivateResidence?: boolean;
  readonly neededForPublic?: boolean;
}) => MapRedactedLocation | undefined;

export type MapPointFeatureProperties = {
  readonly entityId: string;
  readonly kind: string;
  readonly displayName: string;
  readonly precision: string;
  readonly matchMethod?: string;
  readonly stateFips?: string;
  readonly statePostalCode?: string;
  readonly stateName?: string;
};

export type MapPointFeature = {
  readonly type: 'Feature';
  readonly id: string;
  readonly geometry: { readonly type: 'Point'; readonly coordinates: readonly [lng: number, lat: number] };
  readonly properties: MapPointFeatureProperties;
};

export type MapFeatureCollection = {
  readonly type: 'FeatureCollection';
  readonly features: readonly MapPointFeature[];
};

export type MapStateAggregate = {
  readonly stateFips: string;
  readonly statePostalCode: string;
  readonly stateName: string;
  readonly count: number;
};

export type MapCountyAggregate = {
  readonly stateFips: string;
  readonly statePostalCode: string;
  readonly countyName: string;
  readonly countyFips?: string;
  readonly count: number;
};

export type MapSourceMeta = {
  readonly totalEntities: number;
  readonly totalWithLocation: number;
  readonly totalFeatures: number;
  readonly skippedNoLocation: number;
  readonly skippedRedactedToNothing: number;
  readonly skippedOutsideUsBounds: number;
};

export type MapSourceBuildResult = {
  readonly schemaVersion: 1;
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly featureCollection: MapFeatureCollection;
  readonly stateAggregates: readonly MapStateAggregate[];
  readonly countyAggregates: readonly MapCountyAggregate[];
  readonly meta: MapSourceMeta;
};

export type BuildMapSourceInput = {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly entities: readonly MapSourceEntityInput[];
  /** Port: wire this to `redactLocationForPublic` from `@blap/security`. */
  readonly redactLocation: MapRedactLocationFn;
};

/**
 * Build the public map GeoJSON FeatureCollection and state/county presence
 * aggregates for every geo-anchored entity ("everything-active" population 
 * ). Every coordinate in the output is the
 * return value of `redactLocation`; raw `location.lat`/`location.lng` values
 * are only ever passed as arguments into that function, never read back out.
 */
export function buildMapSource(input: BuildMapSourceInput): MapSourceBuildResult {
  const features: MapPointFeature[] = [];
  const stateCounts = new Map<string, MapStateAggregate>();
  const countyCounts = new Map<string, MapCountyAggregate>();

  let skippedNoLocation = 0;
  let skippedRedactedToNothing = 0;
  let skippedOutsideUsBounds = 0;

  for (const entity of input.entities) {
    const raw = entity.location;
    if (!raw) {
      skippedNoLocation += 1;
      continue;
    }

    const redacted = input.redactLocation({
      precision: raw.precision,
      ...(raw.lat !== undefined ? { lat: raw.lat } : {}),
      ...(raw.lng !== undefined ? { lng: raw.lng } : {}),
      ...(raw.geohash !== undefined ? { geohash: raw.geohash } : {}),
      ...(raw.matchMethod !== undefined ? { matchMethod: raw.matchMethod } : {}),
      ...(raw.label !== undefined ? { label: raw.label } : {}),
      ...(entity.livingStatus !== undefined ? { livingStatus: entity.livingStatus } : {}),
      ...(raw.sensitivityClass !== undefined ? { sensitivityClass: raw.sensitivityClass } : {}),
      ...(raw.occupiedPrivateResidence !== undefined
        ? { occupiedPrivateResidence: raw.occupiedPrivateResidence }
        : {}),
      ...(raw.neededForPublic !== undefined ? { neededForPublic: raw.neededForPublic } : {}),
    });

    if (!redacted || redacted.lat === undefined || redacted.lng === undefined) {
      skippedRedactedToNothing += 1;
      continue;
    }

    if (!isWithinUsBounds(redacted.lat, redacted.lng)) {
      skippedOutsideUsBounds += 1;
      continue;
    }

    const state = findUsStateForPoint(redacted.lat, redacted.lng);

    const properties: {
      entityId: string;
      kind: string;
      displayName: string;
      precision: string;
      matchMethod?: string;
      stateFips?: string;
      statePostalCode?: string;
      stateName?: string;
    } = {
      entityId: entity.entityId,
      kind: entity.kind,
      displayName: entity.displayName,
      precision: redacted.precision,
    };
    if (redacted.matchMethod) {
      properties.matchMethod = redacted.matchMethod;
    }
    if (state) {
      properties.stateFips = state.fips;
      properties.statePostalCode = state.postalCode;
      properties.stateName = state.name;
    }

    features.push({
      type: 'Feature',
      id: entity.entityId,
      geometry: { type: 'Point', coordinates: [redacted.lng, redacted.lat] },
      properties,
    });

    if (state) {
      const existing = stateCounts.get(state.fips);
      stateCounts.set(state.fips, {
        stateFips: state.fips,
        statePostalCode: state.postalCode,
        stateName: state.name,
        count: (existing?.count ?? 0) + 1,
      });

      if (raw.county?.name) {
        const countyKey = `${state.fips}:${raw.county.name.toLowerCase()}`;
        const existingCounty = countyCounts.get(countyKey);
        countyCounts.set(countyKey, {
          stateFips: state.fips,
          statePostalCode: state.postalCode,
          countyName: raw.county.name,
          ...(raw.county.fipsCode !== undefined ? { countyFips: raw.county.fipsCode } : {}),
          count: (existingCounty?.count ?? 0) + 1,
        });
      }
    }
  }

  const stateAggregates = [...stateCounts.values()].sort(
    (a, b) => b.count - a.count || a.stateName.localeCompare(b.stateName),
  );
  const countyAggregates = [...countyCounts.values()].sort(
    (a, b) => b.count - a.count || a.countyName.localeCompare(b.countyName),
  );

  return {
    schemaVersion: 1,
    releaseId: input.releaseId,
    generatedAt: input.generatedAt,
    featureCollection: { type: 'FeatureCollection', features },
    stateAggregates,
    countyAggregates,
    meta: {
      totalEntities: input.entities.length,
      totalWithLocation: input.entities.length - skippedNoLocation,
      totalFeatures: features.length,
      skippedNoLocation,
      skippedRedactedToNothing,
      skippedOutsideUsBounds,
    },
  };
}

export { US_BOUNDS };
