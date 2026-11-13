import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { decadeDensityBars } from '../../lib/map-experience/decade-density';
import { DecadeBrush, barIndexAt, rangeBetween } from './DecadeBrush';

const BARS = decadeDensityBars([
  { decade: 1860, count: 4 },
  { decade: 1870, count: 0 },
  { decade: 1880, count: 12 },
  { decade: 1890, count: 7 },
]);

test('a pointer position maps to the bar under it, clamped to the track', () => {
  assert.equal(barIndexAt(0, 0, 400, 4), 0);
  assert.equal(barIndexAt(250, 0, 400, 4), 2);
  assert.equal(barIndexAt(999, 0, 400, 4), 3);
  assert.equal(barIndexAt(-50, 0, 400, 4), 0);
});

test('a brushed range is the two decades it spans, in either drag direction', () => {
  assert.deepEqual(rangeBetween(BARS, 3, 1), { start: 1870, end: 1890 });
  assert.deepEqual(rangeBetween(BARS, 2, 2), { start: 1880, end: 1880 });
});

test('at rest the strip says all decades and its handles are keyboard sliders', () => {
  const html = renderToStaticMarkup(
    createElement(DecadeBrush, { bars: BARS, range: null, onChange: () => {} }),
  );
  assert.match(html, /All decades/);
  assert.equal((html.match(/role="slider"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Clear the decade range/);
});

test('a set range shows its decades, inks the bars inside it, and offers a clear', () => {
  const html = renderToStaticMarkup(
    createElement(DecadeBrush, {
      bars: BARS,
      range: { start: 1870, end: 1880 },
      onChange: () => {},
    }),
  );
  assert.match(html, /1870s to 1880s/);
  assert.equal((html.match(/ds-xbrush__bar--in/g) ?? []).length, 2);
  assert.match(html, /aria-label="Clear the decade range"/);
  assert.match(html, /aria-valuetext="1870s"/);
});
