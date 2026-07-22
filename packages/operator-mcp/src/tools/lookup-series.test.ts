/**
 * Unit tests for lookup_series tool handler.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OperatorMcpError } from '../errors.js';
import {
  createMockIndicatorDbReader,
  SAMPLE_SERIES,
} from '../test/mock-reader.js';
import { lookupSeries } from './lookup-series.js';

describe('lookupSeries', () => {
  it('returns Postgres series when present', async () => {
    const reader = createMockIndicatorDbReader({
      series: [SAMPLE_SERIES],
      observations: [],
      bindings: [],
      jurisdictions: [],
    });
    const result = await lookupSeries(reader, { metricId: 'imprisonment-rate-black-state' });
    assert.equal(result.series.length, 1);
    assert.equal(result.series[0]?.metricId, 'imprisonment-rate-black-state');
    assert.equal(result.series[0]?.sourceDataset, 'BJS NPS');
  });

  it('falls back to Phase 1 catalog when DB is empty', async () => {
    const reader = createMockIndicatorDbReader({
      series: [],
      observations: [],
      bindings: [],
      jurisdictions: [],
    });
    const result = await lookupSeries(reader, { theme: 'wealth' });
    assert.ok(result.series.length > 0);
    assert.ok(result.series.every((row) => row.theme === 'wealth'));
  });

  it('throws unknown_metric when metricId is missing everywhere', async () => {
    const reader = createMockIndicatorDbReader({
      series: [],
      observations: [],
      bindings: [],
      jurisdictions: [],
    });
    await assert.rejects(
      () => lookupSeries(reader, { metricId: 'not-a-real-metric-id' }),
      (error: unknown) => {
        assert.ok(error instanceof OperatorMcpError);
        assert.equal(error.code, 'unknown_metric');
        return true;
      },
    );
  });
});
