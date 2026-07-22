/**
 * Unit tests for get_observations tool handler.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OBSERVATIONS_DISCLAIMER } from '../constants.js';
import { OperatorMcpError } from '../errors.js';
import {
  createMockIndicatorDbReader,
  SAMPLE_OBSERVATION,
  SAMPLE_SERIES,
} from '../test/mock-reader.js';
import { getObservations } from './get-observations.js';

describe('getObservations', () => {
  it('returns observations with provenance and disclaimer', async () => {
    const reader = createMockIndicatorDbReader({
      series: [SAMPLE_SERIES],
      observations: [SAMPLE_OBSERVATION],
      bindings: [],
      jurisdictions: ['state:24'],
    });
    const result = await getObservations(reader, {
      metricId: 'imprisonment-rate-black-state',
      jurisdictionId: 'state:24',
      referencePeriod: '2022',
    });
    assert.equal(result.disclaimer, OBSERVATIONS_DISCLAIMER);
    assert.equal(result.observations.length, 1);
    assert.equal(result.observations[0]?.provenance.source, 'bjs-national-prisoner-statistics');
    assert.equal(result.observations[0]?.estimate, 912);
  });

  it('requires metricId', async () => {
    const reader = createMockIndicatorDbReader({
      series: [],
      observations: [],
      bindings: [],
      jurisdictions: [],
    });
    await assert.rejects(
      () => getObservations(reader, { metricId: '   ' }),
      (error: unknown) => {
        assert.ok(error instanceof OperatorMcpError);
        assert.equal(error.code, 'invalid_input');
        return true;
      },
    );
  });

  it('rejects unknown jurisdiction', async () => {
    const reader = createMockIndicatorDbReader({
      series: [SAMPLE_SERIES],
      observations: [],
      bindings: [],
      jurisdictions: [],
    });
    await assert.rejects(
      () =>
        getObservations(reader, {
          metricId: 'imprisonment-rate-black-state',
          jurisdictionId: 'state:99',
        }),
      (error: unknown) => {
        assert.ok(error instanceof OperatorMcpError);
        assert.equal(error.code, 'unknown_jurisdiction');
        return true;
      },
    );
  });

  it('caps limit at 500', async () => {
    const observations = Array.from({ length: 600 }, (_, index) => ({
      ...SAMPLE_OBSERVATION,
      id: `obs:${index}`,
      reference_period: `${2000 + (index % 20)}`,
    }));
    const reader = createMockIndicatorDbReader({
      series: [SAMPLE_SERIES],
      observations,
      bindings: [],
      jurisdictions: ['state:24'],
    });
    const result = await getObservations(reader, {
      metricId: 'imprisonment-rate-black-state',
      limit: 900,
    });
    assert.equal(result.observations.length, 500);
  });

  it('rejects forbidden causal requests', async () => {
    const reader = createMockIndicatorDbReader({
      series: [SAMPLE_SERIES],
      observations: [],
      bindings: [],
      jurisdictions: [],
    });
    await assert.rejects(
      () =>
        getObservations(reader, {
          metricId: 'imprisonment-rate-black-state',
          impactOf: 'war-on-drugs',
        } as never),
      (error: unknown) => {
        assert.ok(error instanceof OperatorMcpError);
        assert.equal(error.code, 'forbidden_causal');
        return true;
      },
    );
  });
});
