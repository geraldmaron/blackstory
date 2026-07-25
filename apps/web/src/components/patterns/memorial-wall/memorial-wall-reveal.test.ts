/**
 * Tests for the "Held in the Wall" reveal state machine: blank beat, sparse
 * to full density build-up, and permanent-hold message line reveal.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeMemorialRevealState,
  MEMORIAL_MESSAGE_LINE_TIMES_MS,
  MEMORIAL_REVEAL_BEAT_MS,
  MEMORIAL_REVEAL_BUILD_MS,
  memorialNameRevealThreshold,
} from './memorial-wall-reveal';

test('canvas is blank (zero density, no lines) during the initial beat', () => {
  const state = computeMemorialRevealState(0);
  assert.equal(state.namesDensity, 0);
  assert.ok(state.messageLinesShown.every((shown) => shown === false));

  const midBeat = computeMemorialRevealState(MEMORIAL_REVEAL_BEAT_MS - 1);
  assert.equal(midBeat.namesDensity, 0);
});

test('names density ramps from 0 to 1 after the beat and then holds at 1', () => {
  const justAfterBeat = computeMemorialRevealState(MEMORIAL_REVEAL_BEAT_MS + 1);
  assert.ok(justAfterBeat.namesDensity > 0 && justAfterBeat.namesDensity < 0.01);

  const halfway = computeMemorialRevealState(
    MEMORIAL_REVEAL_BEAT_MS + MEMORIAL_REVEAL_BUILD_MS / 2,
  );
  assert.ok(Math.abs(halfway.namesDensity - 0.5) < 1e-9);

  const full = computeMemorialRevealState(MEMORIAL_REVEAL_BEAT_MS + MEMORIAL_REVEAL_BUILD_MS);
  assert.equal(full.namesDensity, 1);

  const wellPast = computeMemorialRevealState(
    MEMORIAL_REVEAL_BEAT_MS + MEMORIAL_REVEAL_BUILD_MS + 100_000,
  );
  assert.equal(wellPast.namesDensity, 1);
});

test('message lines appear in order at their scheduled times and hold permanently', () => {
  for (let i = 0; i < MEMORIAL_MESSAGE_LINE_TIMES_MS.length; i += 1) {
    const time = MEMORIAL_MESSAGE_LINE_TIMES_MS[i]!;
    const atTime = computeMemorialRevealState(time);
    assert.equal(atTime.messageLinesShown[i], true, `line ${i} should be shown at ${time}ms`);

    const justBefore = computeMemorialRevealState(time - 1);
    assert.equal(justBefore.messageLinesShown[i], false, `line ${i} should not show before ${time}ms`);
  }

  // Once shown, a line must never revert as elapsed time only moves forward.
  const timestamps = [0, 1000, 5000, 7000, 11000, 15000, 19000, 60000];
  let previous = computeMemorialRevealState(timestamps[0]!).messageLinesShown;
  for (const t of timestamps.slice(1)) {
    const current = computeMemorialRevealState(t).messageLinesShown;
    for (let i = 0; i < current.length; i += 1) {
      if (previous[i]) {
        assert.equal(current[i], true, `line ${i} reverted to hidden at t=${t}`);
      }
    }
    previous = current;
  }
});

test('all four lines are shown well within a realistic session length', () => {
  const state = computeMemorialRevealState(30_000);
  assert.deepEqual(state.messageLinesShown, [true, true, true, true]);
});

test('reduced motion resolves everything immediately: full density, all lines held', () => {
  const state = computeMemorialRevealState(0, { reducedMotion: true });
  assert.equal(state.namesDensity, 1);
  assert.deepEqual(state.messageLinesShown, [true, true, true, true]);
});

test('memorialNameRevealThreshold spreads indices across [0, 1) and is stable', () => {
  const total = 100;
  const thresholds = Array.from({ length: total }, (_, i) => memorialNameRevealThreshold(i, total));
  assert.equal(thresholds[0], 0);
  for (let i = 1; i < thresholds.length; i += 1) {
    assert.ok(thresholds[i]! > thresholds[i - 1]!);
    assert.ok(thresholds[i]! < 1);
  }
});
