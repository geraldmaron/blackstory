import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { decadeDensityBars } from '../../lib/map-experience/decade-density';
import { DecadeBrush, barIndexAt, committedRange, rangeBetween, rangeWithEnd } from './DecadeBrush';

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

test('From and To set the range without a drag, and the whole range is no range', () => {
  // With no range the other end rests on the archive's own end.
  assert.deepEqual(rangeWithEnd(BARS, null, 'start', 1880), { start: 1880, end: 1890 });
  assert.deepEqual(rangeWithEnd(BARS, { start: 1870, end: 1880 }, 'end', 1890), {
    start: 1870,
    end: 1890,
  });
  // A choice past the other end brings that end along; the range never inverts.
  assert.deepEqual(rangeWithEnd(BARS, { start: 1870, end: 1880 }, 'start', 1890), {
    start: 1890,
    end: 1890,
  });
  assert.equal(
    committedRange(BARS, rangeWithEnd(BARS, { start: 1870, end: 1890 }, 'start', 1860)),
    null,
  );
  assert.deepEqual(committedRange(BARS, { start: 1870, end: 1890 }), { start: 1870, end: 1890 });

  const html = renderToStaticMarkup(
    createElement(DecadeBrush, {
      bars: BARS,
      range: { start: 1870, end: 1880 },
      onChange: () => {},
    }),
  );
  assert.equal((html.match(/<select/g) ?? []).length, 2);
  assert.match(html, />From<\/span><select/);
  assert.match(html, /<option value="1870" selected="">1870s<\/option>/);
});
