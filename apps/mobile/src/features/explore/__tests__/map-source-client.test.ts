/**
 * Unit tests for MapSourceV1 → MapFeatureCollection projection and fetch fallbacks.
 */
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
});
