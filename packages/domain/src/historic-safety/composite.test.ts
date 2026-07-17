/**
 * Tests for the composite: layers 1-4 only, published weights, audit trail, and
 * fail-closed exclusion of layer 5 crime stats advisories (critical invariant).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COMPOSITE_AUDIT_VERSION,
  COMPOSITE_ENGINE_VERSION,
  COMPOSITE_LAYER_WEIGHTS,
  COMPOSITE_METHODOLOGY_VERSION,
  COUNTERWEIGHT_MAX_REDUCTION,
  assertNoExcludedLayerInComposite,
  computeComposite,
  compositeInputFingerprints,
  HISTORIC_SAFETY_COMPOSITE_TYPE_INVARIANTS,
  recalculateComposite,
  type CompositeLayerInputs,
} from './composite.js';
import type { LayerSignal } from './types.js';

const PLACE = 'place_composite_1';
const CITATION = { claimId: 'claim_1', sourceLabel: 'EJI', retrievedAt: '2026-01-01T00:00:00.000Z' };

function layerSignal(
  layerId: LayerSignal['layerId'],
  value: number,
  overrides: Partial<LayerSignal> = {},
): LayerSignal {
  return {
    layerId,
    signalVersion: `${layerId}.v1`,
    placeEntityId: PLACE,
    value,
    asOf: '2026-01-01T00:00:00.000Z',
    citations: [CITATION],
    methodologyNote: { layerId, methodologyVersion: 'v1', summary: `${layerId} test methodology` },
    ...overrides,
  };
}

test('COMPOSITE_LAYER_WEIGHTS for harm layers sum to 1.0 with presence as a bounded counterweight', () => {
  const harmSum =
    COMPOSITE_LAYER_WEIGHTS.documented_events +
    COMPOSITE_LAYER_WEIGHTS.sundown_town +
    COMPOSITE_LAYER_WEIGHTS.exclusion_infrastructure;
  assert.equal(harmSum, 1);
  assert.equal(COUNTERWEIGHT_MAX_REDUCTION, 0.3);
});

test('computeComposite derives value ONLY from layers 1-4 with published weights', () => {
  const layers: CompositeLayerInputs = {
    documentedEvents: layerSignal('documented_events', 1),
    sundownTown: layerSignal('sundown_town', 1),
    exclusionInfrastructure: layerSignal('exclusion_infrastructure', 1),
    presenceAffirmation: layerSignal('presence_affirmation', 0),
  };
  const result = computeComposite({ placeEntityId: PLACE, layers, calculatedAt: '2026-07-17T00:00:00.000Z' });
  assert.equal(result.value, 1);
  assert.deepEqual(result.layerContributions, {
    documented_events: 1,
    sundown_town: 1,
    exclusion_infrastructure: 1,
    presence_affirmation: 0,
  });
  assert.equal(result.missingLayers.length, 0);
});

test('presence_affirmation reduces the harm composite by at most COUNTERWEIGHT_MAX_REDUCTION', () => {
  const noCounter = computeComposite({
    placeEntityId: PLACE,
    layers: {
      documentedEvents: layerSignal('documented_events', 1),
      presenceAffirmation: layerSignal('presence_affirmation', 0),
    },
  });
  const fullCounter = computeComposite({
    placeEntityId: PLACE,
    layers: {
      documentedEvents: layerSignal('documented_events', 1),
      presenceAffirmation: layerSignal('presence_affirmation', 1),
    },
  });
  assert.equal(noCounter.value, 0.4);
  assert.equal(fullCounter.value, 0.28);
});

test('assertNoExcludedLayerInComposite rejects modern_context in any composite slot', () => {
  const modernSignal = layerSignal('modern_context', 0.9);
  assert.throws(
    () => assertNoExcludedLayerInComposite({ documentedEvents: modernSignal }),
    /modern_context/,
  );
  assert.throws(
    () => assertNoExcludedLayerInComposite({ sundownTown: modernSignal }),
    /modern_context/,
  );
  assert.throws(
    () => assertNoExcludedLayerInComposite({ exclusionInfrastructure: modernSignal }),
    /modern_context/,
  );
  assert.throws(
    () => assertNoExcludedLayerInComposite({ presenceAffirmation: modernSignal }),
    /modern_context/,
  );
});

test('computeComposite never accepts a layer signal whose layerId mismatches its slot', () => {
  assert.throws(
    () =>
      computeComposite({
        placeEntityId: PLACE,
        layers: { documentedEvents: layerSignal('sundown_town', 0.5) },
      }),
    /expects a "documented_events"/,
  );
});

test('recalculateComposite stamps BB-043 audit metadata with fingerprints and recalculation reasons', () => {
  const layers: CompositeLayerInputs = {
    documentedEvents: layerSignal('documented_events', 0.8),
  };
  const first = recalculateComposite({ placeEntityId: PLACE, layers, calculatedAt: '2026-07-17T00:00:00.000Z' });
  assert.equal(first.audit.auditVersion, COMPOSITE_AUDIT_VERSION);
  assert.equal(first.audit.engineVersion, COMPOSITE_ENGINE_VERSION);
  assert.equal(first.audit.methodologyVersion, COMPOSITE_METHODOLOGY_VERSION);
  assert.deepEqual(first.audit.weights, COMPOSITE_LAYER_WEIGHTS);
  assert.equal(first.audit.counterweightMaxReduction, COUNTERWEIGHT_MAX_REDUCTION);
  assert.ok(first.audit.inputFingerprints.documented_events.startsWith('sha256:'));
  assert.ok(first.audit.inputFingerprints.weights.startsWith('sha256:'));
  assert.deepEqual(first.audit.recalculationReasons, [
    'documented_events',
    'sundown_town',
    'exclusion_infrastructure',
    'presence_affirmation',
    'weights',
  ]);

  const second = recalculateComposite({
    placeEntityId: PLACE,
    layers: { ...layers, sundownTown: layerSignal('sundown_town', 0.7) },
    previous: first,
  });
  assert.deepEqual(second.audit.recalculationReasons, ['sundown_town']);
});

test('compositeInputFingerprints changes when any layer signal changes', () => {
  const base: CompositeLayerInputs = { documentedEvents: layerSignal('documented_events', 0.5) };
  const changed: CompositeLayerInputs = { documentedEvents: layerSignal('documented_events', 0.6) };
  const fp1 = compositeInputFingerprints(base);
  const fp2 = compositeInputFingerprints(changed);
  assert.notEqual(fp1.documented_events, fp2.documented_events);
  assert.equal(fp1.weights, fp2.weights);
});

test('computeComposite output always carries layerContributions — never one opaque score alone', () => {
  const result = computeComposite({ placeEntityId: PLACE, layers: {} });
  assert.ok('layerContributions' in result);
  assert.ok(Object.keys(result.layerContributions).length === 4);
  assert.deepEqual(result.missingLayers.sort(), [
    'documented_events',
    'exclusion_infrastructure',
    'presence_affirmation',
    'sundown_town',
  ]);
});

test('compile-time composite type invariants exclude banned crime and advisory fields', () => {
  assert.equal(HISTORIC_SAFETY_COMPOSITE_TYPE_INVARIANTS.noOverlapWithGeneralCrimeFields, true);
  assert.equal(HISTORIC_SAFETY_COMPOSITE_TYPE_INVARIANTS.noOverlapWithAdvisoryFields, true);
  assert.equal(HISTORIC_SAFETY_COMPOSITE_TYPE_INVARIANTS.noOverlapWithConfidenceComponents, true);
});

test('computeComposite result is scanned for excluded crime/advisory field names (defense in depth)', () => {
  const result = computeComposite({
    placeEntityId: PLACE,
    layers: { documentedEvents: layerSignal('documented_events', 0.5) },
  });
  assert.equal('advisoryClass' in result, false);
  assert.equal('nibrsOffenseCount' in result, false);
  assert.equal('policingPatternCaveat' in result, false);
});
