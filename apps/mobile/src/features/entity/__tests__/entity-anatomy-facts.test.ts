/**
 * Entity anatomy fact builders: era resolution, where fallback, evidence grades, geo place wiring.
 */
import { normalizeEntity } from '../normalize';
import {
  buildEntityAnatomyInputs,
  buildEntityAnatomyPlace,
  entityEraFact,
} from '../entity-anatomy-facts';
import { fullEntityFixture, minimalEntityFixture } from '../testFixtures';

describe('buildEntityAnatomyInputs', () => {
  it('resolves structured era buckets before Undated', () => {
    const entity = normalizeEntity(fullEntityFixture('place'))!;
    const inputs = buildEntityAnatomyInputs(entity);
    expect(inputs.eraLabel).toBe('Reconstruction');
    expect(inputs.evidenceLabel).toMatch(/Grade A · \d+ sources/);
    expect(inputs.whereLabel).toBe('Dunbar County, GA');
  });

  it('shows Undated when era fields are absent', () => {
    const entity = normalizeEntity(minimalEntityFixture('place'))!;
    expect(buildEntityAnatomyInputs(entity).eraLabel).toBe('Undated');
  });

  it('falls back to Place withheld when jurisdiction is unknown', () => {
    const raw = {
      ...fullEntityFixture('place'),
      jurisdictionLabel: 'Unknown',
      locationLabel: 'Historic Dunbar neighborhood',
    };
    const entity = normalizeEntity(raw)!;
    expect(buildEntityAnatomyInputs(entity).whereLabel).toBe('Historic Dunbar neighborhood');
  });

  it('shows Grade only when there are zero claims', () => {
    const raw = { ...fullEntityFixture('place'), claims: [] };
    const entity = normalizeEntity(raw)!;
    expect(buildEntityAnatomyInputs(entity).evidenceLabel).toBe('Unrated');
  });
});

describe('buildEntityAnatomyPlace', () => {
  it('returns undefined without a public geo anchor', () => {
    const entity = normalizeEntity(minimalEntityFixture('place'))!;
    expect(buildEntityAnatomyPlace(entity)).toBeUndefined();
  });

  it('carries coordinates and precision caption when geo exists', () => {
    const entity = normalizeEntity(fullEntityFixture('place'))!;
    const place = buildEntityAnatomyPlace(entity);
    expect(place).toEqual(
      expect.objectContaining({
        lat: 33.749,
        lng: -84.388,
        precision: 'neighborhood',
      }),
    );
    expect(place?.precisionCaption).toMatch(/Location precision: Neighborhood/);
  });
});

describe('entityEraFact', () => {
  it('derives decade buckets from event windows when eraBuckets are absent', () => {
    const raw = {
      ...minimalEntityFixture('event'),
      eraBuckets: undefined,
      eventWindow: { startAt: '1871-01-01', endAt: '1871-06-01', datePrecision: 'month' },
    };
    const entity = normalizeEntity(raw)!;
    expect(entityEraFact(entity).label).toBe('1870s');
  });
});
