/**
 * Fail-closed tests for the scoring exclusion guard: general crime stats and advisory
 * data must never enter any composite or scoring input (critical invariant, ).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADVISORY_SCORING_BANNED_KEYS } from '../advisory.js';
import {
  assertGeneralCrimeStatsAbsentFromScoringInput,
  assertNoBannedScoringKeys,
  assertScoringInputFreeOfExcludedData,
  GENERAL_CRIME_CONTEXT_BIAS_CAVEAT,
  GENERAL_CRIME_STATS_SCORING_BANNED_KEYS,
  HISTORIC_SAFETY_SCORING_TYPE_INVARIANTS,
  ScoringExclusionError,
} from './scoring-guard.js';

test('GENERAL_CRIME_STATS_SCORING_BANNED_KEYS is a conservative superset of crime-context field names', () => {
  assert.ok(GENERAL_CRIME_STATS_SCORING_BANNED_KEYS.includes('generalCrimeRate'));
  assert.ok(GENERAL_CRIME_STATS_SCORING_BANNED_KEYS.includes('nibrsOffenseCount'));
  assert.ok(GENERAL_CRIME_STATS_SCORING_BANNED_KEYS.includes('policingPatternCaveat'));
});

test('assertGeneralCrimeStatsAbsentFromScoringInput throws when a banned key appears at any depth', () => {
  assert.doesNotThrow(() =>
    assertGeneralCrimeStatsAbsentFromScoringInput({ layers: { documentedEvents: { value: 0.5 } } }),
  );
  assert.throws(
    () =>
      assertGeneralCrimeStatsAbsentFromScoringInput({
        placeEntityId: 'place_1',
        value: 0.4,
        layerContributions: { documented_events: 0.4 },
        nested: { generalCrimeContext: { nibrsOffenseCount: 42 } },
      }),
    /generalCrimeContext/,
  );
  assert.throws(
    () => assertGeneralCrimeStatsAbsentFromScoringInput({ fbiCdeCrimeIndex: 12 }),
    /fbiCdeCrimeIndex/,
  );
});

test('assertGeneralCrimeStatsAbsentFromScoringInput accepts a clean composite-shaped value', () => {
  assert.doesNotThrow(() =>
    assertGeneralCrimeStatsAbsentFromScoringInput({
      placeEntityId: 'place_1',
      value: 0.42,
      layerContributions: {
        documented_events: 0.8,
        sundown_town: 0.7,
        exclusion_infrastructure: 0.67,
        presence_affirmation: 0.5,
      },
      missingLayers: [],
      calculatedAt: '2026-01-01T00:00:00.000Z',
    }),
  );
});

test('assertScoringInputFreeOfExcludedData also rejects advisory fields ( extension)', () => {
  assert.throws(
    () =>
      assertScoringInputFreeOfExcludedData({
        placeEntityId: 'place_1',
        value: 0.3,
        advisoryClass: 'official_travel_advisory',
      }),
    /advisoryClass|advisory data must never enter/,
  );
  for (const key of ADVISORY_SCORING_BANNED_KEYS) {
    assert.throws(
      () => assertScoringInputFreeOfExcludedData({ [key]: 'leaked' }),
      /advisory|general crime|ScoringExclusionError|AdvisoryValidationError/,
    );
  }
});

test('assertNoBannedScoringKeys scans arrays recursively', () => {
  assert.throws(
    () =>
      assertNoBannedScoringKeys(
        [{ ok: true }, { reportedCrimeRate: 1.2 }],
        GENERAL_CRIME_STATS_SCORING_BANNED_KEYS,
        'test',
      ),
    /reportedCrimeRate/,
  );
});

test('GENERAL_CRIME_CONTEXT_BIAS_CAVEAT states policing-pattern framing, not safety verdict', () => {
  assert.match(GENERAL_CRIME_CONTEXT_BIAS_CAVEAT, /policing patterns/i);
  assert.match(GENERAL_CRIME_CONTEXT_BIAS_CAVEAT, /never scored/i);
});

test('compile-time scoring type invariants are wired (no key overlap with domain scoring surfaces)', () => {
  assert.equal(HISTORIC_SAFETY_SCORING_TYPE_INVARIANTS.noOverlapWithConfidenceComponents, true);
  assert.equal(HISTORIC_SAFETY_SCORING_TYPE_INVARIANTS.noOverlapWithRelevanceFeatureValue, true);
  assert.equal(HISTORIC_SAFETY_SCORING_TYPE_INVARIANTS.noOverlapWithRelevanceAssessment, true);
});
