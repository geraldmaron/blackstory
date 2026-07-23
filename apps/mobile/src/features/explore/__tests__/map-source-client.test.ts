/**
 * Unit tests for MapSourceV1 → MapFeatureCollection projection and fetch fallbacks.
 */
import { applyFilters } from '../explore-filter';
import { toExploreFeatures } from '../explore-feature';
import { mapSourceV1ToFeatureCollection, fetchMapSource, type MapSourceDeps } from '../map-source-client';
import type { MapSourceV1 } from '@repo/public-contracts/v1/map';

describe('mapSourceV1ToFeatureCollection', () => {
  it('preserves coordinates and projects public properties', () => {
    const source: MapSourceV1 = {
      releaseId: 'rel_test',
      features: [
        {
          type: 'Feature',
          id: 'ent_a',
          geometry: { type: 'Point', coordinates: [-77.01, 38.91] },
          properties: {
            entityId: 'ent_a',
            href: '/entity/ent_a',
            kind: 'school',
            displayName: 'Dunbar',
            oneLineStory: 'A documented school.',
            precision: 'campus',
            geoPrecisionTier: 'block',
            eraBuckets: ['1870s'],
            notabilityLabels: [],
            evidenceCount: 1,
            confidenceTier: 'high',
            topicTags: ['education'],
            topicIds: ['education'],
            mapTone: 'plantation',
            status: 'historic',
            shade: '#7A8B52',
            glyph: 'square',
            statePostalCode: 'DC',
            stateName: 'District of Columbia',
          },
        },
      ],
    };

    const collection = mapSourceV1ToFeatureCollection(source);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]!.geometry.coordinates).toEqual([-77.01, 38.91]);
    expect(collection.features[0]!.properties.displayName).toBe('Dunbar');
    expect(collection.features[0]!.properties.oneLineStory).toBe('A documented school.');
    expect(collection.features[0]!.properties.eraBuckets).toEqual(['1870s']);
    expect(collection.features[0]!.properties.mapTone).toBe('plantation');
    expect(collection.features[0]!.properties.topicIds).toEqual(['education']);
    expect(collection.features[0]!.properties.confidenceTier).toBe('high');
    expect(collection.features[0]!.properties.statePostalCode).toBe('DC');
    expect(collection.features[0]!.properties.status).toBe('historic');
  });

  it('projects facet fields so explore-filter can narrow live features', () => {
    const source: MapSourceV1 = {
      releaseId: 'rel_facet',
      features: [
        {
          type: 'Feature',
          id: 'ent_active',
          geometry: { type: 'Point', coordinates: [-95.0, 29.7] },
          properties: {
            entityId: 'ent_active',
            href: '/entity/ent_active',
            kind: 'school',
            displayName: 'Active School',
            oneLineStory: 'Still operating.',
            precision: 'city',
            geoPrecisionTier: 'city',
            eraBuckets: ['1960s'],
            status: 'active',
            notabilityLabels: [],
            evidenceCount: 2,
            confidenceTier: 'low',
            topicTags: [],
            shade: '#E09A55',
            glyph: 'square',
            statePostalCode: 'TX',
          },
        },
        {
          type: 'Feature',
          id: 'ent_historic',
          geometry: { type: 'Point', coordinates: [-77.0, 38.9] },
          properties: {
            entityId: 'ent_historic',
            href: '/entity/ent_historic',
            kind: 'place',
            displayName: 'Historic Place',
            oneLineStory: 'Documented site.',
            precision: 'city',
            geoPrecisionTier: 'city',
            eraBuckets: ['1950s'],
            status: 'historic',
            notabilityLabels: [],
            evidenceCount: 1,
            confidenceTier: 'high',
            topicTags: ['education'],
            topicIds: ['education'],
            mapTone: 'plantation',
            shade: '#7A8B52',
            glyph: 'circle',
            statePostalCode: 'DC',
          },
        },
      ],
    };

    const exploreFeatures = toExploreFeatures(mapSourceV1ToFeatureCollection(source));
    expect(applyFilters(exploreFeatures, { status: 'active' }).map((f) => f.id)).toEqual([
      'ent_active',
    ]);
    expect(applyFilters(exploreFeatures, { theme: 'education' }).map((f) => f.id)).toEqual([
      'ent_historic',
    ]);
    expect(applyFilters(exploreFeatures, { tone: 'plantation' }).map((f) => f.id)).toEqual([
      'ent_historic',
    ]);
    expect(applyFilters(exploreFeatures, { confidence: 'high' }).map((f) => f.id)).toEqual([
      'ent_historic',
    ]);
    expect(applyFilters(exploreFeatures, { state: 'TX' }).map((f) => f.id)).toEqual(['ent_active']);
  });
});

describe('fetchMapSource', () => {
  const livePayload: MapSourceV1 = {
    releaseId: 'rel_live',
    features: [
      {
        type: 'Feature',
        id: 'ent_live',
        geometry: { type: 'Point', coordinates: [-77.0, 38.9] },
        properties: {
          entityId: 'ent_live',
          href: '/entity/ent_live',
          kind: 'place',
          displayName: 'Live Place',
          oneLineStory: 'From the API',
          precision: 'city',
          geoPrecisionTier: 'city',
          eraBuckets: [],
          notabilityLabels: [],
          evidenceCount: 0,
          confidenceTier: 'unrated',
          topicTags: [],
          shade: '#E09A55',
          glyph: 'circle',
        },
      },
    ],
  };

  function makeDeps(overrides: Partial<MapSourceDeps> = {}): MapSourceDeps {
    return {
      transport: {
        readJson: (async <T>(_path: string) => ({
          kind: 'ok' as const,
          data: livePayload as T,
        })) as MapSourceDeps['transport']['readJson'],
      },
      releaseCache: {
        getActiveStamp: jest.fn(async () => 'rel_live'),
        applyReleaseStamp: jest.fn(async () => 0),
        write: jest.fn(async () => undefined),
        verifyAndWriteArtifact: jest.fn(async () => undefined),
        read: jest.fn(async () => undefined),
      },
      connectivity: { isOnline: () => true },
      now: () => 1_700_000_000_000,
      ...overrides,
    };
  }

  it('returns a ready FeatureCollection from a live /v1/map payload', async () => {
    const result = await fetchMapSource(makeDeps());
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.releaseId).toBe('rel_live');
    expect(result.fromCache).toBe(false);
    expect(result.source.features[0]!.properties.entityId).toBe('ent_live');
  });

  it('reports offline-no-cache when offline with empty cache', async () => {
    const result = await fetchMapSource(
      makeDeps({
        connectivity: { isOnline: () => false },
      }),
    );
    expect(result.status).toBe('offline-no-cache');
  });

  it('serves cached map when transport returns not-modified', async () => {
    const cachedPayload: MapSourceV1 = {
      releaseId: 'rel_cached',
      features: [
        {
          type: 'Feature',
          id: 'ent_cached',
          geometry: { type: 'Point', coordinates: [-77.1, 38.8] },
          properties: {
            entityId: 'ent_cached',
            href: '/entity/ent_cached',
            kind: 'place',
            displayName: 'Cached Place',
            oneLineStory: 'From cache',
            precision: 'city',
            geoPrecisionTier: 'city',
            eraBuckets: [],
            notabilityLabels: [],
            evidenceCount: 0,
            confidenceTier: 'unrated',
            topicTags: [],
            shade: '#E09A55',
            glyph: 'circle',
          },
        },
      ],
    };

    const result = await fetchMapSource(
      makeDeps({
        transport: {
          readJson: jest.fn(async () => ({ kind: 'not-modified' as const })),
        },
        releaseCache: {
          getActiveStamp: jest.fn(async () => 'rel_cached'),
          applyReleaseStamp: jest.fn(async () => 0),
          write: jest.fn(async () => undefined),
          verifyAndWriteArtifact: jest.fn(async () => undefined),
          read: jest.fn(async () => ({
            value: cachedPayload,
            freshness: {
              source: 'cache' as const,
              fetchedAt: 1,
              releaseStamp: 'rel_cached',
              degraded: false,
            },
          })) as unknown as MapSourceDeps['releaseCache']['read'],
        },
      }),
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.fromCache).toBe(true);
    expect(result.degraded).toBe(false);
    expect(result.source.features[0]!.properties.entityId).toBe('ent_cached');
  });

  it('degrades to cache when live payload fails contract validation', async () => {
    const cachedPayload: MapSourceV1 = {
      releaseId: 'rel_stale',
      features: [],
    };

    const result = await fetchMapSource(
      makeDeps({
        transport: {
          readJson: jest.fn(async () => ({ kind: 'ok' as const, data: { bad: true } })) as MapSourceDeps['transport']['readJson'],
        },
        releaseCache: {
          getActiveStamp: jest.fn(async () => 'rel_stale'),
          applyReleaseStamp: jest.fn(async () => 0),
          write: jest.fn(async () => undefined),
          verifyAndWriteArtifact: jest.fn(async () => undefined),
          read: jest.fn(async () => ({
            value: cachedPayload,
            freshness: {
              source: 'cache' as const,
              fetchedAt: 1,
              releaseStamp: 'rel_stale',
              degraded: true,
            },
          })) as unknown as MapSourceDeps['releaseCache']['read'],
        },
      }),
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.fromCache).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.releaseId).toBe('rel_stale');
  });
});
