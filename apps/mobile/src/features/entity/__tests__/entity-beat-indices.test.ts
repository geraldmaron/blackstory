import { entityBeatIndices } from '../entity-beat-indices';
import { normalizeEntity } from '../normalize';
import { fullEntityFixture, minimalEntityFixture } from '../testFixtures';

describe('entityBeatIndices', () => {
  it('assigns sequential indices starting at 02 for content beats', () => {
    const entity = normalizeEntity(fullEntityFixture('place'))!;
    const beats = entityBeatIndices(entity);
    expect(beats.relevance).toBe('02');
    expect(beats.context).toBe('03');
    expect(beats.reading).toBe('04');
    expect(beats.status).toBe('05');
    expect(beats.claims).toBe('06');
    expect(beats.timeline).toBe('07');
    expect(beats.connected).toBe('08');
    expect(beats.provenance).toBe('09');
  });

  it('skips reading and timeline indices when absent', () => {
    const entity = normalizeEntity(minimalEntityFixture('place'))!;
    const beats = entityBeatIndices(entity);
    expect(beats.reading).toBeUndefined();
    expect(beats.timeline).toBeUndefined();
    expect(beats.connected).toBe('06');
    expect(beats.provenance).toBe('07');
  });
});
