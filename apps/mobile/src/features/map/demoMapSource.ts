/**
 * Demo map source for the native spike (MOB-011).
 *
 * PROVENANCE — this is not invented test geography. It is the already-redacted
 * OUTPUT shape of `buildMapSource(redactLocationForPublic)` in
 * `packages/domain/src/map/` run over that package's committed fixtures
 * (`fixtures.ts`), which is exactly what a release build persists and what
 * `apps/api-public` serves to the client. apps/mobile has no pnpm-workspace
 * symlink to `packages/*` (it manages its own npm lockfile — see
 * src/lib/route-params.ts), so the redacted values are transcribed here
 * rather than imported, with the raw pre-redaction coordinates recorded only as
 * NEGATIVE CONTROLS below so the redaction regression test can prove they never
 * reach the rendered layer.
 *
 * The authoritative raw -> redacted guarantee is enforced upstream by
 * `packages/domain/src/map/map-source.redaction.test.ts` (wired to the REAL
 * `@repo/security` redactor) and is not weakened or bypassed here.
 */

export type MapPointFeatureProperties = {
  readonly entityId: string;
  readonly kind: string;
  readonly displayName: string;
  readonly precision: string;
  readonly stateFips?: string;
  readonly statePostalCode?: string;
  readonly stateName?: string;
  /** Present on live MapSourceV1 features; optional on demo fixtures. */
  readonly eraBuckets?: readonly string[];
  /** Present on live MapSourceV1 features; optional on demo fixtures. */
  readonly oneLineStory?: string;
  /** v6 map encoding — denormalized on live MapSourceV1; enriched for demo fixtures. */
  readonly shade?: string;
  readonly glyph?: string;
  readonly kindFamily?: string;
  readonly mapTone?: string;
  readonly evidenceCount?: number;
  readonly confidenceTier?: string;
  readonly topicTags?: readonly string[];
  readonly topicIds?: readonly string[];
  /** Derived lifecycle status on live MapSourceV1 features. */
  readonly status?: string;
};

export type MapPointFeature = {
  readonly type: 'Feature';
  readonly id: string;
  readonly geometry: { readonly type: 'Point'; readonly coordinates: readonly [number, number] };
  readonly properties: MapPointFeatureProperties;
};

export type MapFeatureCollection = {
  readonly type: 'FeatureCollection';
  readonly features: readonly MapPointFeature[];
};

/**
 * NEGATIVE CONTROLS: the raw pre-redaction values of the critical living-person
 * fixture (`LIVING_PERSON_RESIDENCE_FIXTURE`) from packages/domain. None of these
 * may ever appear in the rendered map source — the redaction regression test
 * asserts their absence.
 */
export const RAW_LIVING_PERSON = {
  lat: 29.760427,
  lng: -95.369803,
  streetLabelFragment: 'Bayou Street',
} as const;

/**
 * The redacted FeatureCollection a client renders. The living-person entity is
 * present, but ONLY at the constitution's living-residence ceiling: city
 * precision, coarsened to 2 decimals (29.76 / -95.37), street label stripped —
 * exactly the values map-source.redaction.test.ts asserts upstream.
 */
export const DEMO_MAP_SOURCE: MapFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'ent_fixture_place_dc',
      geometry: { type: 'Point', coordinates: [-77.0369, 38.9072] },
      properties: {
        entityId: 'ent_fixture_place_dc',
        kind: 'place',
        displayName: 'Seed Historical Place (D.C.)',
        precision: 'city',
        stateFips: '11',
        statePostalCode: 'DC',
        stateName: 'District of Columbia',
      },
    },
    {
      type: 'Feature',
      id: 'ent_fixture_place_harlem_ny',
      geometry: { type: 'Point', coordinates: [-73.7949, 40.7282] },
      properties: {
        entityId: 'ent_fixture_place_harlem_ny',
        kind: 'place',
        displayName: 'Seed Cultural Institution (Queens, NY)',
        precision: 'neighborhood',
        stateFips: '36',
        statePostalCode: 'NY',
        stateName: 'New York',
      },
    },
    {
      // The critical fixture, already coarsened to city precision by redaction.
      type: 'Feature',
      id: 'ent_fixture_person_living_houston_tx',
      geometry: { type: 'Point', coordinates: [-95.37, 29.76] },
      properties: {
        entityId: 'ent_fixture_person_living_houston_tx',
        kind: 'person',
        displayName: 'Seed Living Person (Houston, TX)',
        precision: 'city',
        stateFips: '48',
        statePostalCode: 'TX',
        stateName: 'Texas',
      },
    },
  ],
};
