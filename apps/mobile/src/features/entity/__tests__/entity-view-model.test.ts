import { deriveHistoricalFraming, historicalFramingLabel } from '../entity-view-model';
import { normalizeEntity } from '../normalize';
import { fullEntityFixture, minimalEntityFixture } from '../testFixtures';

describe('entity-view-model', () => {
  it('frames active non-event records as present-day', () => {
    const entity = normalizeEntity(fullEntityFixture('place'))!;
    expect(deriveHistoricalFraming(entity)).toBe('present_day');
    expect(historicalFramingLabel('present_day')).toBe('Present-day record');
  });

  it('frames events and records without active status as historical', () => {
    const event = normalizeEntity(fullEntityFixture('event'))!;
    expect(deriveHistoricalFraming(event)).toBe('historical');

    const minimal = normalizeEntity(minimalEntityFixture('place'))!;
    expect(deriveHistoricalFraming(minimal)).toBe('historical');
    expect(historicalFramingLabel('historical')).toBe('Historical record');
  });
});
