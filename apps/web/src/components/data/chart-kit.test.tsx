/**
 * The chart kit's arithmetic: round value axes, honest time positions, labeled gaps, and end
 * labels that never print over each other.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EndLabels, Lines, compactNumber, valueScale } from './chart-kit';
import { skippedYears, trendPositions } from './TrendLineChart';

void React;

test('a value axis starts at zero and ends on the tightest round top that holds the max', () => {
  const people = valueScale(41_104_607, compactNumber);
  assert.equal(people.top, 50_000_000);
  assert.deepEqual(
    people.ticks.map((tick) => tick.label),
    ['0', '10M', '20M', '30M', '40M', '50M'],
  );
  assert.equal(valueScale(285_000, compactNumber).top, 300_000);
  assert.equal(valueScale(19.3, String).top, 20);
  assert.equal(valueScale(0, String).top, 1);
});

test('years sit at their true distance in time; other periods are evenly spaced', () => {
  const years = trendPositions(['1860', '1870', '1960']);
  assert.deepEqual(
    years.x.map((x) => Math.round(x)),
    [0, 10, 100],
  );
  assert.deepEqual(years.years, [1860, 1870, 1960]);
  const labels = trendPositions(['1990', '2020-2024 (ACS)']);
  assert.equal(labels.years, null);
  assert.deepEqual(labels.x, [0, 100]);
});

test('a year skipped inside an annual run is a gap; a long gap between benchmarks is not', () => {
  assert.deepEqual(skippedYears([2017, 2018, 2019, 2021, 2022]), [{ after: 2, before: 3 }]);
  assert.deepEqual(skippedYears([1990, 2000, 2005, 2006]), []);
  assert.deepEqual(skippedYears([1971, 1977, 1983]), []);
});

test('a missing point breaks the line instead of bridging it', () => {
  const html = renderToStaticMarkup(
    <Lines
      series={[
        {
          id: 'a',
          tone: 'hi',
          points: [{ x: 0, y: 10 }, { x: 50, y: 20 }, null, { x: 80, y: 30 }, { x: 100, y: 40 }],
        },
      ]}
    />,
  );
  assert.equal((html.match(/<polyline/g) ?? []).length, 2);
});

test('end labels that would touch are pushed apart, never stacked on one line', () => {
  const html = renderToStaticMarkup(
    <EndLabels
      items={[
        { id: 'a', y: 50, name: 'A', tone: 'hi' },
        { id: 'b', y: 48, name: 'B', tone: 'lo' },
      ]}
    />,
  );
  const bottoms = [...html.matchAll(/bottom:([\d.]+)%/g)].map((match) => Number(match[1]));
  assert.equal(bottoms.length, 2);
  assert.ok(Math.abs(bottoms[0]! - bottoms[1]!) >= 14);
});
