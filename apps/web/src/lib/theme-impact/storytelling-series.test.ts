/** Tests for theme-impact metric series grouping. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  groupThemeImpactMetricSeries,
  pickThemeImpactArcInstruments,
  shouldShowThemeImpactStorytelling,
} from './storytelling-series.js';

const provenance = {
  source: 'test',
  source_url: 'https://example.com',
  retrieved_at: '2026-07-22',
  content_hash: 'a',
  humanCitation: 'A',
} as const;

test('groupThemeImpactMetricSeries marks multi-period metrics as time series', () => {
  const groups = groupThemeImpactMetricSeries([
    {
      id: 'a-2022',
      metricId: 'hmda-denial-rate-black-county',
      label: 'HMDA denial rate (Black)',
      value: '10.9%',
      referencePeriod: '2022',
      provenance,
    },
    {
      id: 'a-2023',
      metricId: 'hmda-denial-rate-black-county',
      label: 'HMDA denial rate (Black)',
      value: '11.1%',
      referencePeriod: '2023',
      provenance: { ...provenance, content_hash: 'b', humanCitation: 'B' },
    },
    {
      id: 'acs',
      metricId: 'acs-homeownership-rate-black-county',
      label: 'Black homeownership',
      value: '41.5%',
      referencePeriod: '2020-2024',
      provenance: { ...provenance, content_hash: 'c', humanCitation: 'C' },
    },
  ]);

  assert.equal(groups.length, 2);
  const hmda = groups.find((g) => g.metricId === 'hmda-denial-rate-black-county');
  assert.ok(hmda?.isTimeSeries);
  assert.equal(hmda?.points.length, 2);
  const acs = groups.find((g) => g.metricId === 'acs-homeownership-rate-black-county');
  assert.ok(acs && !acs.isTimeSeries);
  assert.equal(acs?.points[0]?.referencePeriod, '2020-2024');
});

test('pickThemeImpactArcInstruments keeps multi-year spines and ACS ownership handoffs', () => {
  const instruments = pickThemeImpactArcInstruments([
    {
      id: 'nhgis-1990',
      metricId: 'nhgis-homeownership-rate-black-county',
      label: 'Black homeownership rate, Cook County',
      value: '37.1%',
      referencePeriod: '1990',
      provenance,
    },
    {
      id: 'nhgis-2000',
      metricId: 'nhgis-homeownership-rate-black-county',
      label: 'Black homeownership rate, Cook County',
      value: '42.0%',
      referencePeriod: '2000',
      provenance,
    },
    {
      id: 'acs-own',
      metricId: 'acs-homeownership-rate-black-county',
      label: 'Black homeownership rate, Cook County',
      value: '41.5%',
      referencePeriod: '2020-2024',
      provenance,
    },
    {
      id: 'acs-income',
      metricId: 'acs-median-hh-income-black-county',
      label: 'Median household income, Black householders',
      value: '$51,523',
      referencePeriod: '2020-2024',
      provenance,
    },
    {
      id: 'hmda-2018',
      metricId: 'hmda-denial-rate-gap-black-white-county',
      label: 'Black–White denial-rate gap',
      value: '18.7 pp',
      referencePeriod: '2018',
      provenance,
    },
    {
      id: 'hmda-2023',
      metricId: 'hmda-denial-rate-gap-black-white-county',
      label: 'Black–White denial-rate gap',
      value: '16.9 pp',
      referencePeriod: '2023',
      provenance,
    },
  ]);

  assert.ok(instruments.some((row) => row.key === 'homeownership-black-county'));
  assert.ok(instruments.some((row) => row.key === 'hmda-denial-rate-gap-black-white-county'));
  assert.ok(!instruments.some((row) => row.label.includes('income')));
  const ownership = instruments.find((row) => row.key === 'homeownership-black-county');
  assert.match(ownership?.period ?? '', /1990/);
  assert.match(ownership?.period ?? '', /2020-2024/);
});

test('shouldShowThemeImpactStorytelling gates Q3, Q6, and Q11', () => {
  assert.equal(shouldShowThemeImpactStorytelling('Q3'), true);
  assert.equal(shouldShowThemeImpactStorytelling('Q6'), true);
  assert.equal(shouldShowThemeImpactStorytelling('Q11'), true);
  assert.equal(shouldShowThemeImpactStorytelling('Q1'), false);
});
