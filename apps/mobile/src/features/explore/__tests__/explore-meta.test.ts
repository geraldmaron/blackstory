/**
 * Unit tests for Explore preview meta formatting (kind slug, meta line, at-a-glance).
 */
import { featureAtAGlanceFacts, featureKindSlug, featureMetaLine } from '../explore-meta';

describe('featureMetaLine', () => {
  it('formats kind and place when both are known', () => {
    expect(
      featureMetaLine({
        kind: 'place',
        properties: { stateName: 'Texas' },
      }),
    ).toBe('Place · Texas');
  });

  it('prefers place and year when year is present', () => {
    expect(
      featureMetaLine({
        kind: 'person',
        properties: { stateName: 'New York', year: 1921 },
      }),
    ).toBe('New York · 1921');
  });
});

describe('featureKindSlug', () => {
  it('uppercases the kind for the mono kicker', () => {
    expect(featureKindSlug('place')).toBe('PLACE');
    expect(featureKindSlug('  person ')).toBe('PERSON');
  });

  it('falls back to RECORD when kind is blank', () => {
    expect(featureKindSlug('')).toBe('RECORD');
    expect(featureKindSlug('   ')).toBe('RECORD');
  });
});

describe('featureAtAGlanceFacts', () => {
  it('emits Era, Precision, and Place in that order when all are known', () => {
    expect(
      featureAtAGlanceFacts({
        kind: 'place',
        properties: {
          year: 1921,
          precision: 'city',
          stateName: 'Oklahoma',
        },
      }),
    ).toEqual([
      { label: 'Era', value: '1921' },
      { label: 'Precision', value: 'City' },
      { label: 'Place', value: 'Oklahoma' },
    ]);
  });

  it('formats multi-bucket era spans and omits missing rows', () => {
    expect(
      featureAtAGlanceFacts({
        kind: 'place',
        properties: {
          eraBuckets: ['1860s', '1890s', '1920s'],
          precision: 'neighborhood',
        },
      }),
    ).toEqual([
      { label: 'Era', value: '1860s to 1920s' },
      { label: 'Precision', value: 'Neighborhood' },
    ]);
  });

  it('returns an empty list when no glance facts are available', () => {
    expect(featureAtAGlanceFacts({ kind: 'place', properties: {} })).toEqual([]);
  });
});
