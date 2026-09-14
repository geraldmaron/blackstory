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
    // "Cited in" sits between the record's outward links and its provenance: what this record
    // connects to, then what has been written about it, then how the record itself was made.
    expect(beats.citedIn).toBe('09');
    expect(beats.provenance).toBe('10');
  });

  it('skips reading and timeline indices when absent', () => {
    const entity = normalizeEntity(minimalEntityFixture('place'))!;
    const beats = entityBeatIndices(entity);
    expect(beats.reading).toBeUndefined();
    expect(beats.timeline).toBeUndefined();
    expect(beats.connected).toBe('06');
    expect(beats.provenance).toBe('07');
  });

  it('skips the cited-in beat, and closes the numbering over it, when no story cites the record', () => {
    // Most of the published catalog is in this state. The beat is skipped rather than rendered
    // empty, so the numbering a reader sees never has a hole in it.
    const raw = fullEntityFixture('place');
    delete raw.citingStories;
    const beats = entityBeatIndices(normalizeEntity(raw)!);
    expect(beats.citedIn).toBeUndefined();
    expect(beats.connected).toBe('08');
    expect(beats.provenance).toBe('09');
  });
});
