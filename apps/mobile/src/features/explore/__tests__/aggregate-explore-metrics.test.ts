/**
 * Unit tests for Explore FeatureCollection → metrics aggregations.
 */
import { makeFeature } from '../__fixtures__/features';
import {
  aggregateExploreMetrics,
  metricsAccessibilitySummary,
} from '../metrics/aggregate-explore-metrics';

describe('aggregateExploreMetrics', () => {
  it('counts kinds, places, era buckets, and precision from real properties', () => {
    const features = [
      makeFeature('a', [-77.04, 38.9], {
        kind: 'place',
        properties: {
          entityId: 'a',
          kind: 'place',
          displayName: 'A',
          precision: 'city',
          statePostalCode: 'DC',
          stateName: 'District of Columbia',
          eraBuckets: ['1870s', '1910s'],
        },
      }),
      makeFeature('b', [-95.37, 29.76], {
        kind: 'person',
        properties: {
          entityId: 'b',
          kind: 'person',
          displayName: 'B',
          precision: 'city',
          statePostalCode: 'TX',
          stateName: 'Texas',
        },
      }),
      makeFeature('c', [-73.79, 40.72], {
        kind: 'place',
        properties: {
          entityId: 'c',
          kind: 'place',
          displayName: 'C',
          precision: 'neighborhood',
          statePostalCode: 'NY',
          stateName: 'New York',
          eraBuckets: ['1910s'],
        },
      }),
    ];

    const metrics = aggregateExploreMetrics(features);

    expect(metrics.total).toBe(3);
    expect(metrics.geographyCoverage).toBe(3);
    expect(metrics.withEraLabeled).toBe(2);
    expect(metrics.byKind).toEqual([
      { key: 'place', label: 'Place', count: 2 },
      { key: 'person', label: 'Person', count: 1 },
    ]);
    expect(metrics.byState.map((b) => b.key)).toEqual(['DC', 'NY', 'TX']);
    expect(metrics.byEra).toEqual([
      { key: '1910s', label: '1910s', count: 2 },
      { key: '1870s', label: '1870s', count: 1 },
    ]);
    expect(metrics.byPrecision).toEqual([
      { key: 'city', label: 'City', count: 2 },
      { key: 'neighborhood', label: 'Neighborhood', count: 1 },
    ]);
  });

  it('returns empty buckets for an empty feature set', () => {
    const metrics = aggregateExploreMetrics([]);
    expect(metrics).toEqual({
      total: 0,
      geographyCoverage: 0,
      withEraLabeled: 0,
      byKind: [],
      byState: [],
      byEra: [],
      byPrecision: [],
    });
  });

  it('rolls overflow buckets into Other', () => {
    const features = Array.from({ length: 10 }, (_, i) =>
      makeFeature(`e${i}`, [-77 - i * 0.01, 38.9], {
        kind: `kind_${i}`,
        properties: {
          entityId: `e${i}`,
          kind: `kind_${i}`,
          displayName: `E${i}`,
          precision: 'city',
        },
      }),
    );
    const metrics = aggregateExploreMetrics(features);
    expect(metrics.byKind).toHaveLength(8);
    expect(metrics.byKind[metrics.byKind.length - 1]).toEqual({
      key: '__other__',
      label: 'Other',
      count: 3,
    });
  });
});

describe('metricsAccessibilitySummary', () => {
  it('includes scope and bucket text alternatives', () => {
    const metrics = aggregateExploreMetrics([
      makeFeature('a', [-77.04, 38.9], {
        kind: 'place',
        properties: {
          entityId: 'a',
          kind: 'place',
          displayName: 'A',
          precision: 'city',
          stateName: 'Texas',
          statePostalCode: 'TX',
          eraBuckets: ['1950s'],
        },
      }),
    ]);
    const summary = metricsAccessibilitySummary(metrics, 'In view');
    expect(summary).toContain('In view: 1 record');
    expect(summary).toContain('By kind: 1 Place');
    expect(summary).toContain('Geography: 1 place');
    expect(summary).toContain('By era: 1 1950s');
    expect(summary).toContain('Location precision: 1 City');
  });
});
