import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ThemeImpactObservationView } from '@repo/domain';
import { ThemeImpactMetricChart, niceTicks, seriesLabel } from './ThemeImpactMetricChart';

void React;

test('y ticks are round steps from zero', () => {
  assert.deepEqual(niceTicks(56), [0, 20, 40, 60]);
  assert.deepEqual(niceTicks(7), [0, 5, 10]);
});

test('a row note or year never names the whole series', () => {
  assert.equal(
    seriesLabel(
      [
        { label: 'White-to-Black per-capita wealth ratio (last pre-war benchmark)' },
        { label: 'White-to-Black per-capita wealth ratio, 1870' },
        { label: 'White-to-Black per-capita wealth ratio, 2019' },
      ],
      'fallback',
    ),
    'White-to-Black per-capita wealth ratio',
  );
});

test('every observation gets a dot, the label is direct, and there is no legend', () => {
  const obs = (year: number, estimate: number) =>
    ({
      metricId: 'ratio',
      referencePeriod: String(year),
      estimate,
      unit: 'ratio',
      label: `Wealth ratio, ${year}`,
    }) as unknown as ThemeImpactObservationView;
  const html = renderToStaticMarkup(
    <ThemeImpactMetricChart observations={[obs(1860, 56), obs(1920, 10), obs(2019, 7)]} />,
  );
  assert.equal(html.match(/ds-theme-impact-chart__dot--a/g)?.length, 3);
  assert.match(html, /ds-theme-impact-chart__label[^>]*>Wealth ratio</);
  assert.doesNotMatch(html, /legend/);
  assert.match(html, /From 56 in 1860 to 7 in 2019/);
});
