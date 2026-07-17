/**
 * Tests for BB-053/055 dispute compatibility: layer records map to underlying claim dispute targets.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  designationDisputeTargets,
  designationRecordFullyDisputed,
  layerSignalDisputeTargets,
  recommendedCorrectionCategoryFor,
} from './dispute.js';
import type { LayerSignal } from './types.js';

const AREA = {
  shape: { type: 'Polygon' as const, coordinates: [[-90, 32], [-90, 33], [-89, 33], [-89, 32], [-90, 32]] },
  documentedPrecisionTier: 'county' as const,
};

test('designationDisputeTargets exposes every basisClaimId as an independently disputable claim', () => {
  const targets = designationDisputeTargets({
    id: 'stown_1',
    placeEntityId: 'place_1',
    designation: 'sundown_town',
    confidence: 'probable',
    validFrom: '1940',
    datePrecision: 'decade',
    basisClaimIds: ['claim_a', 'claim_b'],
    areaGeometry: AREA,
  });
  assert.deepEqual(
    targets.map((t) => t.claimId).sort(),
    ['claim_a', 'claim_b'],
  );
  assert.ok(targets.every((t) => t.recordKind === 'sundown_town'));
});

test('recommendedCorrectionCategoryFor maps sundown/redlining to classification_dispute', () => {
  assert.equal(recommendedCorrectionCategoryFor('sundown_town'), 'classification_dispute');
  assert.equal(recommendedCorrectionCategoryFor('redlining_grade'), 'classification_dispute');
  assert.equal(recommendedCorrectionCategoryFor('restrictive_covenant'), 'location_precision');
});

test('layerSignalDisputeTargets maps citation claimIds for computed layer signals', () => {
  const signal: LayerSignal = {
    layerId: 'documented_events',
    signalVersion: 'v1',
    placeEntityId: 'place_1',
    value: 0.5,
    asOf: '2026-01-01T00:00:00.000Z',
    citations: [
      { claimId: 'claim_evt_1', sourceLabel: 'EJI', retrievedAt: '2026-01-01T00:00:00.000Z' },
    ],
    methodologyNote: { layerId: 'documented_events', methodologyVersion: 'v1', summary: 'test' },
  };
  const targets = layerSignalDisputeTargets(signal);
  assert.deepEqual(targets, [{ claimId: 'claim_evt_1', placeEntityId: 'place_1' }]);
});

test('designationRecordFullyDisputed is true only when every basis claim was disputed', () => {
  const record = { basisClaimIds: ['claim_a', 'claim_b'] };
  assert.equal(designationRecordFullyDisputed(record, new Set(['claim_a'])), false);
  assert.equal(designationRecordFullyDisputed(record, new Set(['claim_a', 'claim_b'])), true);
  assert.equal(designationRecordFullyDisputed({ basisClaimIds: [] }, new Set(['claim_a'])), false);
});
