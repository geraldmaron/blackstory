/**
 * Tests for Lives testimony speaker place mismatch against region membership.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIVES_NATIONAL, livesAreaById } from './lives-regions.js';
import { livesSpeakerPlaceMismatch } from './lives-speaker-place.js';

test('speakers outside the selected region are flagged; national never is', () => {
  const northeast = livesAreaById('region:us-northeast')!;
  const deepSouth = livesAreaById('region:us-deep-south')!;
  assert.equal(livesSpeakerPlaceMismatch('Alabama', northeast), true);
  assert.equal(livesSpeakerPlaceMismatch('Alabama', deepSouth), false);
  assert.equal(livesSpeakerPlaceMismatch('New York', northeast), false);
  assert.equal(livesSpeakerPlaceMismatch('Alabama', LIVES_NATIONAL), false);
  assert.equal(livesSpeakerPlaceMismatch('Harlem', northeast), false);
});

test('a speaker naming an in-region and out-of-region state is not a mismatch', () => {
  const midwest = livesAreaById('region:us-midwest')!;
  assert.equal(livesSpeakerPlaceMismatch('Mississippi and Chicago, Illinois', midwest), false);
});
