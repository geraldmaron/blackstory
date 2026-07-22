/**
 * Unit tests for combined CDC EJI + EPA TRI fetch helpers — fixture mode only.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchPhase1EjiCountyObservations } from './fetch-phase1-eji.js';
import { fetchPhase1TriCountyObservations } from '../epa-tri/fetch-phase1-tri.js';

test('fetchPhase1EjiCountyObservations returns Cook county mean from default fixture', async () => {
  const result = await fetchPhase1EjiCountyObservations({
    retrievedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(result.mode, 'fixture');
  assert.equal(result.rejected.length, 0);
  const cook = result.observations.find((obs) => obs.jurisdictionId === 'county:17031');
  assert.ok(cook);
  assert.equal(cook.estimate, 0.74);
});

test('fetchPhase1TriCountyObservations returns Cook 2023 facility count from default fixture', async () => {
  const result = await fetchPhase1TriCountyObservations({
    reportingYears: [2023],
    retrievedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(result.mode, 'fixture');
  assert.equal(result.rejected.length, 0);
  const cook2023 = result.observations.find(
    (obs) => obs.jurisdictionId === 'county:17031' && obs.referencePeriod === '2023',
  );
  assert.ok(cook2023);
  assert.equal(cook2023.estimate, 12);
});
