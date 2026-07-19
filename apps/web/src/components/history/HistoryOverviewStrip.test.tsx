/**
 * Smoke tests for HistoryOverviewStrip accessible markup and overview summaries.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HistoryOverviewStrip } from './HistoryOverviewStrip';

void React;

const sampleOverview = {
  totalRecords: 12,
  totalConnections: 8,
  kindCounts: [
    { kind: 'place', count: 7 },
    { kind: 'school', count: 5 },
  ],
  decadeDensity: [
    { decade: '1860s', count: 2 },
    { decade: '1950s', count: 10 },
  ],
};

test('HistoryOverviewStrip renders stats and kind bars with aria labels', () => {
  const html = renderToStaticMarkup(
    <HistoryOverviewStrip overview={sampleOverview} activeDecade="1950s" />,
  );
  assert.match(html, /Records in view/);
  assert.match(html, />12</);
  assert.match(html, />8</);
  assert.match(html, /Kind composition/);
  assert.match(html, /Place: 7 records/);
  assert.match(html, /ds-legend-glyph--circle/);
  assert.match(html, /Decade density/);
  assert.match(html, /1950s: 10 records/);
  assert.match(html, /ds-history-overview__density-bar--active/);
});

test('HistoryOverviewStrip caps decade density to non-empty decades', () => {
  const denseOverview = {
    ...sampleOverview,
    decadeDensity: Array.from({ length: 60 }, (_, index) => ({
      decade: `${1700 + index * 10}s`,
      count: index % 3 === 0 ? index + 1 : 0,
    })),
  };
  const html = renderToStaticMarkup(<HistoryOverviewStrip overview={denseOverview} />);
  const barMatches = html.match(/ds-history-overview__density-bar(?![-\w])/g) ?? [];
  assert.ok(barMatches.length <= 40, `expected ≤40 density bars, got ${barMatches.length}`);
  assert.doesNotMatch(html, /ds-history-overview__density-bar--empty/);
});
