import {
  deriveHistoricalFraming,
  historicalFramingLabel,
  isQuietRecord,
} from '../entity-view-model';
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

  it('treats a sensitivity flag or a massacre or plantation tone as a quiet record', () => {
    const plain = normalizeEntity(minimalEntityFixture('place'))!;
    expect(isQuietRecord(plain)).toBe(false);
    expect(isQuietRecord(normalizeEntity(fullEntityFixture('place'))!)).toBe(true);
    expect(isQuietRecord({ ...plain, topicTags: ['tulsa-race-massacre'] })).toBe(true);
    expect(isQuietRecord({ ...plain, topicTags: ['plantation'] })).toBe(true);
  });
});
