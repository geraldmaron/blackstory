/**
 * Windowing arithmetic for the virtualized DataTable body.
 *
 * The failure this guards is a row that exists in the data, is inside the viewport, and renders
 * as blank because the slice was off by one — which on an operator surface reads as "the record
 * is missing", not "the table has a bug".
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeRowWindow } from './DataTable.js';

const ROW_HEIGHT = 33;

test('the window starts at zero and never runs negative at the top', () => {
  const { first, last } = computeRowWindow({
    rowCount: 4000,
    rowHeight: ROW_HEIGHT,
    scrollTop: 0,
    viewportRows: 40,
  });
  assert.equal(first, 0);
  assert.ok(last >= 40, 'the window must cover at least a viewport');
});

test('a negative scrollTop (rubber-band overscroll) still starts at zero', () => {
  const { first } = computeRowWindow({
    rowCount: 4000,
    rowHeight: ROW_HEIGHT,
    scrollTop: -220,
    viewportRows: 40,
  });
  assert.equal(first, 0);
});

test('the window covers every row visible at the current scroll position, plus overscan', () => {
  const scrollTop = 100 * ROW_HEIGHT;
  const { first, last } = computeRowWindow({
    rowCount: 4000,
    rowHeight: ROW_HEIGHT,
    scrollTop,
    viewportRows: 40,
    overscan: 8,
  });
  // Everything from the first on-screen row to the last must be inside the slice.
  assert.ok(first <= 100, `first ${first} must not skip the top visible row`);
  assert.ok(last >= 140, `last ${last} must not clip the bottom visible row`);
  assert.equal(first, 92);
});

test('the window clamps to the row count at the bottom', () => {
  const { first, last } = computeRowWindow({
    rowCount: 210,
    rowHeight: ROW_HEIGHT,
    scrollTop: 210 * ROW_HEIGHT,
    viewportRows: 40,
  });
  assert.equal(last, 210);
  assert.ok(first < last, 'the window must never invert');
});

test('a table shorter than the viewport renders entirely', () => {
  const { first, last } = computeRowWindow({
    rowCount: 12,
    rowHeight: ROW_HEIGHT,
    scrollTop: 0,
    viewportRows: 40,
  });
  assert.equal(first, 0);
  assert.equal(last, 12);
});

test('every row is reachable by scrolling — no row falls between consecutive windows', () => {
  const rowCount = 4000;
  const viewportRows = 40;
  const seen = new Set<number>();
  for (
    let scrollTop = 0;
    scrollTop <= rowCount * ROW_HEIGHT;
    scrollTop += viewportRows * ROW_HEIGHT
  ) {
    const { first, last } = computeRowWindow({
      rowCount,
      rowHeight: ROW_HEIGHT,
      scrollTop,
      viewportRows,
    });
    for (let index = first; index < last; index += 1) seen.add(index);
  }
  assert.equal(seen.size, rowCount, `${rowCount - seen.size} rows were never rendered`);
});
