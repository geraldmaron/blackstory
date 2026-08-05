/**
 * The surface-to-posture table, and the rule about who may claim the plate.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CLASSIFIED_PATHS,
  surfaceClassFor,
  type SurfaceClass,
} from '../../lib/nav/surface-classes';
import { defaultPostureFor, framedClaimAllowed } from './plate-posture';

const ALL_SURFACES: readonly SurfaceClass[] = ['instrument', 'reading', 'record', 'utility'];

test('every surface class resolves to a posture', () => {
  for (const surface of ALL_SURFACES) {
    const posture = defaultPostureFor(surface);
    assert.ok(
      posture === 'live' || posture === 'framed' || posture === 'parked',
      `${surface} resolved to ${posture}`,
    );
  }
});

test('the Instrument is the only surface that starts Live', () => {
  assert.equal(defaultPostureFor('instrument'), 'live');
  for (const surface of ALL_SURFACES.filter((s) => s !== 'instrument')) {
    assert.notEqual(defaultPostureFor(surface), 'live', `${surface} must not paint a live plate`);
  }
});

test('paper surfaces park until something claims a slot', () => {
  assert.equal(defaultPostureFor('reading'), 'parked');
  assert.equal(defaultPostureFor('utility'), 'parked');
});

test('endpoints park', () => {
  // Redirects, feeds and JSON render no chrome, so there is nothing to paint into.
  assert.equal(defaultPostureFor(null), 'parked');
  assert.equal(framedClaimAllowed(null), false);
});

test('a slot claim is refused on the Instrument', () => {
  // RecordAnatomyPanel is shared between the record page and the Atlas record sheet. A sheet
  // floating over the live plate cannot borrow the plate it floats over, and this refusal is what
  // makes that case degrade to a static block without the caller knowing which surface it is on.
  assert.equal(framedClaimAllowed('instrument'), false);
});

test('a slot claim is refused on Utility, so a stray moment cannot wake a parked plate', () => {
  assert.equal(framedClaimAllowed('utility'), false);
});

test('reading rooms and record pages may claim', () => {
  assert.equal(framedClaimAllowed('reading'), true);
  assert.equal(framedClaimAllowed('record'), true);
});

test('no classified route resolves to a posture the plate cannot hold', () => {
  // Drives the real registry rather than a hand-written route list, so a route added to
  // surface-classes.ts is covered here the day it lands.
  for (const path of CLASSIFIED_PATHS) {
    const posture = defaultPostureFor(surfaceClassFor(path));
    assert.ok(
      posture === 'live' || posture === 'framed' || posture === 'parked',
      `${path} resolved to ${posture}`,
    );
  }
});

test('the plate is never live behind a reading room', () => {
  // The binding rule: the plate is never behind body text outside the Instrument.
  for (const path of CLASSIFIED_PATHS) {
    const surface = surfaceClassFor(path);
    if (surface === 'instrument') continue;
    assert.notEqual(defaultPostureFor(surface), 'live', `${path} would paint a live plate`);
  }
});
