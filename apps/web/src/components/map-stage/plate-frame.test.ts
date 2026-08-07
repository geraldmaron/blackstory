/**
 * SP-08 (repo-92n2.8): the Framed posture's transition and geometry.
 *
 * The acceptance criterion these cover is "a Framed plate releases on exit and a second Framed
 * request while one is live is refused". The refusal itself lives in `framed-slot-registry`; what
 * is asserted here is that a refused claim leaves the plate in its RESTING posture rather than in
 * some third state, which is the part a registry test cannot see.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { insetIsPaintable, plateInsetForSlot, resolvePlatePosture } from './plate-frame';

const VIEWPORT = { width: 1280, height: 800 };

test('a reading room parks until a moment claims the plate, and parks again when it leaves', () => {
  const resting = { surface: 'reading' as const, hasLiveMoment: false, claimGranted: false };
  assert.equal(resolvePlatePosture(resting), 'parked');
  assert.equal(
    resolvePlatePosture({ surface: 'reading', hasLiveMoment: true, claimGranted: true }),
    'framed',
  );
  // Scrolling past the last moment must return the plate, not strand it framed on an empty slot.
  assert.equal(resolvePlatePosture(resting), 'parked');
});

test('a record page rests Framed, because its place block always has something to frame', () => {
  assert.equal(
    resolvePlatePosture({ surface: 'record', hasLiveMoment: false, claimGranted: false }),
    'framed',
  );
});

test('a refused claim leaves the plate at rest rather than in a half-framed state', () => {
  // Two stages mounted at once: the loser of the claim must not also lose its resting posture.
  assert.equal(
    resolvePlatePosture({ surface: 'reading', hasLiveMoment: true, claimGranted: false }),
    'parked',
  );
});

test('the Atlas refuses a moment claim and keeps steering', () => {
  // A record sheet floating over the live plate mounts a place block. It cannot borrow the plate
  // it is floating over, so the plate stays Live and the block renders its static fallback.
  assert.equal(
    resolvePlatePosture({ surface: 'instrument', hasLiveMoment: true, claimGranted: true }),
    'live',
  );
});

test('a utility surface is never woken by a stray moment', () => {
  assert.equal(
    resolvePlatePosture({ surface: 'utility', hasLiveMoment: true, claimGranted: true }),
    'parked',
  );
  assert.equal(
    resolvePlatePosture({ surface: null, hasLiveMoment: true, claimGranted: true }),
    'parked',
  );
});

test('a fully visible slot maps to its own rect', () => {
  const inset = plateInsetForSlot({ top: 120, left: 200, width: 640, height: 360 }, VIEWPORT);
  assert.deepEqual(inset, { top: 120, left: 200, width: 640, height: 360 });
  assert.ok(insetIsPaintable(inset));
});

test('a slot scrolled half off the top clamps instead of painting above the fold', () => {
  const inset = plateInsetForSlot({ top: -180, left: 200, width: 640, height: 360 }, VIEWPORT);
  assert.equal(inset.top, 0, 'a fixed plate given a negative top paints over the command bar');
  assert.equal(
    inset.height,
    180,
    'the visible remainder, so the map is framed rather than stretched',
  );
  assert.ok(insetIsPaintable(inset));
});

test('a slot below the fold yields a zero-area inset the caller can refuse to paint', () => {
  const inset = plateInsetForSlot({ top: 900, left: 200, width: 640, height: 360 }, VIEWPORT);
  assert.equal(inset.height, 0);
  assert.equal(insetIsPaintable(inset), false);
});

test('a slot wider than the viewport clamps on both axes', () => {
  const inset = plateInsetForSlot({ top: 40, left: -60, width: 1600, height: 300 }, VIEWPORT);
  assert.deepEqual(inset, { top: 40, left: 0, width: 1280, height: 300 });
});
