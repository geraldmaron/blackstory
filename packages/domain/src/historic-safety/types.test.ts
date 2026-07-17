/**
 * Tests for the BB-082 shared layer vocabulary and signal shape.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COMPOSITE_ELIGIBLE_LAYER_IDS,
  HISTORIC_SAFETY_LAYER_IDS,
  assertLayerSignalValid,
  isCompositeEligibleLayerId,
  isHistoricSafetyLayerId,
} from './types.js';

test('HISTORIC_SAFETY_LAYER_IDS carries exactly the five layers in bead order', () => {
  assert.deepEqual(HISTORIC_SAFETY_LAYER_IDS, [
    'documented_events',
    'sundown_town',
    'exclusion_infrastructure',
    'presence_affirmation',
    'modern_context',
  ]);
  assert.equal(isHistoricSafetyLayerId('modern_context'), true);
  assert.equal(isHistoricSafetyLayerId('made_up_layer'), false);
});

test('COMPOSITE_ELIGIBLE_LAYER_IDS excludes modern_context (critical invariant)', () => {
  assert.equal(COMPOSITE_ELIGIBLE_LAYER_IDS.includes('modern_context' as never), false);
  assert.equal(isCompositeEligibleLayerId('modern_context'), false);
  assert.equal(isCompositeEligibleLayerId('documented_events'), true);
  assert.equal(COMPOSITE_ELIGIBLE_LAYER_IDS.length, 4);
});

test('assertLayerSignalValid requires at least one citation', () => {
  assert.throws(
    () =>
      assertLayerSignalValid({
        layerId: 'documented_events',
        signalVersion: 'v1',
        placeEntityId: 'place_1',
        value: 0.5,
        asOf: '2026-01-01T00:00:00.000Z',
        citations: [],
        methodologyNote: { layerId: 'documented_events', methodologyVersion: 'v1', summary: 'x' },
      }),
    /at least one citation/,
  );
});

test('assertLayerSignalValid rejects a value outside [0,1]', () => {
  assert.throws(
    () =>
      assertLayerSignalValid({
        layerId: 'documented_events',
        signalVersion: 'v1',
        placeEntityId: 'place_1',
        value: 1.5,
        asOf: '2026-01-01T00:00:00.000Z',
        citations: [{ claimId: 'claim_1', sourceLabel: 'EJI', retrievedAt: '2026-01-01T00:00:00.000Z' }],
        methodologyNote: { layerId: 'documented_events', methodologyVersion: 'v1', summary: 'x' },
      }),
    RangeError,
  );
});

test('assertLayerSignalValid rejects a mismatched methodologyNote.layerId', () => {
  assert.throws(
    () =>
      assertLayerSignalValid({
        layerId: 'documented_events',
        signalVersion: 'v1',
        placeEntityId: 'place_1',
        value: 0.5,
        asOf: '2026-01-01T00:00:00.000Z',
        citations: [{ claimId: 'claim_1', sourceLabel: 'EJI', retrievedAt: '2026-01-01T00:00:00.000Z' }],
        methodologyNote: { layerId: 'sundown_town', methodologyVersion: 'v1', summary: 'x' },
      }),
    /layerId/,
  );
});

test('assertLayerSignalValid accepts a well-formed signal', () => {
  assert.doesNotThrow(() =>
    assertLayerSignalValid({
      layerId: 'documented_events',
      signalVersion: 'v1',
      placeEntityId: 'place_1',
      value: 0.5,
      asOf: '2026-01-01T00:00:00.000Z',
      citations: [{ claimId: 'claim_1', sourceLabel: 'EJI', retrievedAt: '2026-01-01T00:00:00.000Z' }],
      methodologyNote: { layerId: 'documented_events', methodologyVersion: 'v1', summary: 'x' },
    }),
  );
});
