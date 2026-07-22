/** Tests for theme-impact metric series grouping. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  groupThemeImpactMetricSeries,
  shouldShowThemeImpactStorytelling,
} from './storytelling-series.js';

test('groupThemeImpactMetricSeries marks multi-period metrics as time series', () => {
  const groups = groupThemeImpactMetricSeries([
    {
      id: 'a-2022',
      metricId: 'hmda-denial-rate-black-county',
      label: 'HMDA denial rate (Black)',
      value: '10.9%',
      referencePeriod: '2022',
      provenance: {
        source: 'hmda',
        source_url: 'https://example.com',
        retrieved_at: '2026-07-22',
        content_hash: 'a',
        humanCitation: 'A',
      },
    },
    {
      id: 'a-2023',
      metricId: 'hmda-denial-rate-black-county',
      label: 'HMDA denial rate (Black)',
      value: '11.1%',
      referencePeriod: '2023',
      provenance: {
        source: 'hmda',
        source_url: 'https://example.com',
        retrieved_at: '2026-07-22',
        content_hash: 'b',
        humanCitation: 'B',
      },
    },
    {
      id: 'acs',
      metricId: 'acs-homeownership-rate-black-county',
      label: 'Black homeownership',
      value: '41.5%',
      referencePeriod: '2020-2024',
      provenance: {
        source: 'acs',
        source_url: 'https://example.com',
        retrieved_at: '2026-07-22',
        content_hash: 'c',
        humanCitation: 'C',
      },
    },
  ]);

  assert.equal(groups.length, 2);
  const hmda = groups.find((g) => g.metricId === 'hmda-denial-rate-black-county');
  assert.ok(hmda?.isTimeSeries);
  assert.equal(hmda?.points.length, 2);
  const acs = groups.find((g) => g.metricId === 'acs-homeownership-rate-black-county');
  assert.ok(acs && !acs.isTimeSeries);
});

test('shouldShowThemeImpactStorytelling gates Q3 and Q6', () => {
  assert.equal(shouldShowThemeImpactStorytelling('Q3'), true);
  assert.equal(shouldShowThemeImpactStorytelling('Q6'), true);
  assert.equal(shouldShowThemeImpactStorytelling('Q1'), false);
});
