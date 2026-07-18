/**
 * Tests for per-source update cadence metadata compatible with job registry shape.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HISTORIC_SAFETY_SOURCE_CADENCE_IDS,
  HISTORIC_SAFETY_SOURCE_CADENCES,
  isLayerAsOfOverdueForCadence,
} from './update-cadence.js';

test('HISTORIC_SAFETY_SOURCE_CADENCES entries carry -compatible JobCadence fields', () => {
  for (const cadenceId of HISTORIC_SAFETY_SOURCE_CADENCE_IDS) {
    const cadence = HISTORIC_SAFETY_SOURCE_CADENCES[cadenceId];
    assert.ok(cadence.cronExpression.trim().length > 0);
    assert.ok(cadence.nominalIntervalMs > 0);
    assert.ok(cadence.humanReadable.trim().length > 0);
  }
});

test('FBI hate-crime cadence is annual; Tougaloo/Mapping Inequality is quarterly', () => {
  assert.match(HISTORIC_SAFETY_SOURCE_CADENCES['fbi-hate-crime'].humanReadable, /annually/i);
  assert.match(HISTORIC_SAFETY_SOURCE_CADENCES['tougaloo-mapping-inequality'].humanReadable, /quarterly/i);
});

test('isLayerAsOfOverdueForCadence flags stale asOf relative to nominalIntervalMs', () => {
  assert.equal(
    isLayerAsOfOverdueForCadence({
      asOf: '2024-01-01T00:00:00.000Z',
      cadenceId: 'fbi-hate-crime',
      now: '2026-07-17T00:00:00.000Z',
    }),
    true,
  );
  assert.equal(
    isLayerAsOfOverdueForCadence({
      asOf: '2026-06-01T00:00:00.000Z',
      cadenceId: 'tougaloo-mapping-inequality',
      now: '2026-07-17T00:00:00.000Z',
    }),
    false,
  );
});

test('isLayerAsOfOverdueForCadence rejects invalid ISO dates', () => {
  assert.throws(
    () =>
      isLayerAsOfOverdueForCadence({
        asOf: 'not-a-date',
        cadenceId: 'eji-lynching-records',
        now: '2026-07-17T00:00:00.000Z',
      }),
    /valid ISO dates/,
  );
});
