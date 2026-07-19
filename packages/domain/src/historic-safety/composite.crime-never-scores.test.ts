/**
 * Critical invariant tests: general crime statistics and advisory data must NEVER enter the
 * composite exercises all four independent defense lines documented in ./composite.ts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PlaceAdvisoryRecord } from '../advisory.js';
import { asEntityId } from '../ids.js';
import {
  assertNoExcludedLayerInComposite,
  computeComposite,
  HISTORIC_SAFETY_COMPOSITE_TYPE_INVARIANTS,
  type CompositeLayerInputs,
} from './composite.js';
import { buildGeneralCrimeContextView } from './modern-context.js';
import {
  assertGeneralCrimeStatsAbsentFromScoringInput,
  assertScoringInputFreeOfExcludedData,
  GENERAL_CRIME_STATS_SCORING_BANNED_KEYS,
  ScoringExclusionError,
} from './scoring-guard.js';
import type { LayerSignal } from './types.js';

const PLACE = 'place_crime_guard_1';
const CITATION = {
  claimId: 'claim_1',
  sourceLabel: 'EJI',
  retrievedAt: '2026-01-01T00:00:00.000Z',
};

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

test('defense 1: CompositeLayerInputs has no slot for modern_context or crime-context records', () => {
  const slots: CompositeLayerInputs = {
    documentedEvents: undefined,
    sundownTown: undefined,
    exclusionInfrastructure: undefined,
    presenceAffirmation: undefined,
  };
  assert.deepEqual(Object.keys(slots).sort(), [
    'documentedEvents',
    'exclusionInfrastructure',
    'presenceAffirmation',
    'sundownTown',
  ]);
  assert.equal('modernContext' in slots, false);
  assert.equal('generalCrimeContext' in slots, false);
});

test('defense 2: assertNoExcludedLayerInComposite rejects a modern_context signal in every slot', () => {
  const modernSignal = layerSignal('modern_context', 0.9);
  for (const slot of [
    'documentedEvents',
    'sundownTown',
    'exclusionInfrastructure',
    'presenceAffirmation',
  ] as const) {
    assert.throws(
      () => assertNoExcludedLayerInComposite({ [slot]: modernSignal }),
      /modern_context|never enter the composite/,
    );
  }
});

test('defense 3: computeComposite output passes assertScoringInputFreeOfExcludedData', () => {
  const result = computeComposite({
    placeEntityId: PLACE,
    layers: { documentedEvents: layerSignal('documented_events', 0.5) },
  });
  assert.doesNotThrow(() => assertScoringInputFreeOfExcludedData(result));
});

test('defense 3: assertScoringInputFreeOfExcludedData rejects every general-crime banned key at any depth', () => {
  for (const key of GENERAL_CRIME_STATS_SCORING_BANNED_KEYS) {
    assert.throws(
      () =>
        assertGeneralCrimeStatsAbsentFromScoringInput({
          placeEntityId: PLACE,
          value: 0.5,
          [key]: 42,
        }),
      ScoringExclusionError,
    );
  }
});

test('defense 3: a GeneralCrimeContextRecord is labeled context only and never feeds computeComposite', () => {
  const crimeContext = buildGeneralCrimeContextView({
    placeEntityId: PLACE,
    nibrsOffenseCount: 120,
    reportedCrimeRate: 4.2,
    asOf: '2025-01-01T00:00:00.000Z',
    sourceLabel: 'FBI CDE/NIBRS',
  });
  assert.throws(
    () =>
      assertGeneralCrimeStatsAbsentFromScoringInput({ layers: { documentedEvents: crimeContext } }),
    /nibrsOffenseCount|generalCrimeContext/,
  );
  assert.throws(
    () =>
      computeComposite({
        placeEntityId: PLACE,
        layers: { documentedEvents: crimeContext as never },
      }),
    /expects a "documented_events"|LayerSignal/,
  );
});

test('defense 3: advisory fields in a composite-shaped object are rejected ( extension)', () => {
  const advisory: PlaceAdvisoryRecord = {
    id: 'adv_1',
    placeEntityId: asEntityId('ent_seed_place_001'),
    advisoryClass: 'official_travel_advisory',
    sourcedClaimIds: ['claim_adv_1'],
    asOf: '2026-01-01',
    datePrecision: 'day',
    reviewCadence: 'annual',
  };
  assert.throws(
    () =>
      assertScoringInputFreeOfExcludedData({
        placeEntityId: PLACE,
        value: 0.4,
        layerContributions: {
          documented_events: 0.4,
          sundown_town: 0,
          exclusion_infrastructure: 0,
          presence_affirmation: 0,
        },
        advisoryRecord: advisory,
      }),
    /advisoryRecord|advisory data must never enter/,
  );
});

test('defense 4: compile-time composite type invariants exclude crime and advisory field surfaces', () => {
  assert.equal(HISTORIC_SAFETY_COMPOSITE_TYPE_INVARIANTS.noOverlapWithGeneralCrimeFields, true);
  assert.equal(HISTORIC_SAFETY_COMPOSITE_TYPE_INVARIANTS.noOverlapWithAdvisoryFields, true);
  assert.equal(HISTORIC_SAFETY_COMPOSITE_TYPE_INVARIANTS.noOverlapWithConfidenceComponents, true);
});
