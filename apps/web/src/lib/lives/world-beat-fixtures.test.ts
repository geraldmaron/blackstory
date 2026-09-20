/**
 * The build-time caller for validateLivesWorldBeats. The published methodology tells readers that
 * Lives narrative is validated; until this test existed the validator had no caller outside its
 * own unit test, so nothing enforced that claim. An invalid beat now fails CI.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateLivesWorldBeats } from '@repo/domain/statistics/lives';
import { LIVES_WORLD_BEAT_FIXTURES } from './world-beat-fixtures';

test('every authored world beat passes the domain validator', () => {
  const { records, errors } = validateLivesWorldBeats(LIVES_WORLD_BEAT_FIXTURES);
  assert.deepEqual(errors, []);
  assert.equal(records.length, LIVES_WORLD_BEAT_FIXTURES.length);
});

test('every speaker says how their words reached the page', () => {
  const speakers = LIVES_WORLD_BEAT_FIXTURES.flatMap((beat) =>
    beat.speaker ? [{ id: beat.id, speaker: beat.speaker }] : [],
  );
  assert.ok(speakers.length > 0);
  for (const { id, speaker } of speakers) {
    assert.ok(speaker.mediation, `${id}: speaker has no mediation label`);
    if (speaker.mediation === 'as-told-to' || speaker.mediation === 'recorded-interview') {
      assert.ok(speaker.mediatedBy, `${id}: ${speaker.mediation} must name who took it down`);
    }
  }
});
