/**
 * Tests for Layer 5 modern context: hate-crime signal display, general-crime labeled context
 * only, and advisory pointer (advisory-only presentation, never scored).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PlaceAdvisoryRecord } from '../advisory.js';
import { asEntityId } from '../ids.js';
import { COMPOSITE_ELIGIBLE_LAYER_IDS } from './types.js';
import {
  assertGeneralCrimeContextValid,
  assertHateCrimeStatRecordValid,
  buildGeneralCrimeContextView,
  computeModernContextLayerSignal,
  HATE_CRIME_BIAS_CAVEAT,
  HATE_CRIME_SATURATION_INCIDENT_COUNT,
  modernContextAdvisoryPointer,
} from './modern-context.js';
import { GENERAL_CRIME_CONTEXT_BIAS_CAVEAT } from './scoring-guard.js';

const PLACE = 'place_modern_1';
const CITATION = {
  claimId: 'claim_hate_1',
  sourceLabel: 'FBI Hate Crime Statistics',
  retrievedAt: '2026-01-01T00:00:00.000Z',
};

test('modern_context is structurally excluded from COMPOSITE_ELIGIBLE_LAYER_IDS', () => {
  assert.equal(COMPOSITE_ELIGIBLE_LAYER_IDS.includes('modern_context' as never), false);
});

test('computeModernContextLayerSignal returns undefined when no hate-crime records exist', () => {
  assert.equal(
    computeModernContextLayerSignal({
      placeEntityId: PLACE,
      hateCrimeStats: [],
      asOf: '2026-01-01T00:00:00.000Z',
    }),
    undefined,
  );
});

test('computeModernContextLayerSignal carries a mandatory bias caveat and never fabricates zero incidents', () => {
  const signal = computeModernContextLayerSignal({
    placeEntityId: PLACE,
    hateCrimeStats: [
      {
        placeEntityId: PLACE,
        biasMotivatedIncidentCount: 2,
        reportingYear: '2024',
        citation: CITATION,
      },
    ],
    asOf: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(signal?.layerId, 'modern_context');
  assert.equal(signal?.methodologyNote.biasCaveat, HATE_CRIME_BIAS_CAVEAT);
  assert.equal(signal?.value, 2 / HATE_CRIME_SATURATION_INCIDENT_COUNT);
  assertHateCrimeStatRecordValid({
    placeEntityId: PLACE,
    biasMotivatedIncidentCount: 2,
    reportingYear: '2024',
    citation: CITATION,
  });
});

test('buildGeneralCrimeContextView returns a GeneralCrimeContextRecord, not a LayerSignal', () => {
  const view = buildGeneralCrimeContextView({
    placeEntityId: PLACE,
    nibrsOffenseCount: 88,
    reportedCrimeRate: 3.1,
    asOf: '2025-01-01T00:00:00.000Z',
    sourceLabel: 'FBI CDE/NIBRS',
  });
  assert.equal('value' in view, false);
  assert.equal('layerId' in view, false);
  assert.equal(view.policingPatternCaveat, GENERAL_CRIME_CONTEXT_BIAS_CAVEAT);
  assertGeneralCrimeContextValid(view);
});

test('assertGeneralCrimeContextValid rejects a caller-supplied caveat override', () => {
  assert.throws(
    () =>
      assertGeneralCrimeContextValid({
        placeEntityId: PLACE,
        asOf: '2025-01-01T00:00:00.000Z',
        sourceLabel: 'FBI CDE/NIBRS',
        policingPatternCaveat: 'Custom caveat text',
      }),
    /must equal GENERAL_CRIME_CONTEXT_BIAS_CAVEAT/,
  );
});

test('modernContextAdvisoryPointer filters advisories for a place without scoring them', () => {
  const advisories: PlaceAdvisoryRecord[] = [
    {
      id: 'adv_1',
      placeEntityId: asEntityId('ent_seed_place_001'),
      advisoryClass: 'official_travel_advisory',
      sourcedClaimIds: ['claim_adv_1'],
      asOf: '2026-01-01',
      datePrecision: 'day',
      reviewCadence: 'annual',
    },
    {
      id: 'adv_2',
      placeEntityId: asEntityId('ent_seed_place_002'),
      advisoryClass: 'verify_before_travel',
      sourcedClaimIds: ['claim_adv_2'],
      asOf: '2026-01-01',
      datePrecision: 'day',
      reviewCadence: 'annual',
    },
  ];
  const matched = modernContextAdvisoryPointer(asEntityId('ent_seed_place_001'), advisories);
  assert.equal(matched.length, 1);
  assert.equal(matched[0]?.id, 'adv_1');
  assert.equal('value' in matched[0]!, false);
});
