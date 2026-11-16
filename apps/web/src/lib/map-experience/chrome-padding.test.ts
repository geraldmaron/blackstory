import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXPLORE_COLUMN_WIDTH,
  EXPLORE_FLOAT_GUTTER,
  EXPLORE_HISTOGRAM_HEIGHT,
  EXPLORE_PHONE_MAX_WIDTH,
  chromePadding,
} from './chrome-padding';

const VIEWPORTS = [
  { viewportWidth: 1440, viewportHeight: 900 },
  { viewportWidth: 1024, viewportHeight: 768 },
  { viewportWidth: 768, viewportHeight: 1024 },
  { viewportWidth: 844, viewportHeight: 390 },
  { viewportWidth: 390, viewportHeight: 844 },
  { viewportWidth: 320, viewportHeight: 480 },
] as const;

test('padding always leaves part of both axes free, so MapLibre never throws', () => {
  for (const viewport of VIEWPORTS) {
    for (const sheetHeight of [0, 160, 422, 844, 5000]) {
      const inset = chromePadding({ ...viewport, sheetHeight });
      assert.ok(inset.left + inset.right < viewport.viewportWidth, JSON.stringify(viewport));
      assert.ok(inset.top + inset.bottom < viewport.viewportHeight, JSON.stringify(viewport));
      for (const side of Object.values(inset)) assert.ok(side >= 0);
    }
  }
});

test('a portrait tablet takes the bottom sheet, so an entered place frames on the whole width', () => {
  const inset = chromePadding({ viewportWidth: 768, viewportHeight: 1024, sheetHeight: 180 });
  assert.ok(inset.left < EXPLORE_COLUMN_WIDTH);
  assert.equal(inset.left, inset.right);
});

test('wide layout clears the left column and the histogram on the bottom edge', () => {
  const inset = chromePadding({ viewportWidth: 1440, viewportHeight: 900 });
  assert.ok(inset.left >= EXPLORE_COLUMN_WIDTH);
  assert.ok(inset.bottom >= EXPLORE_HISTOGRAM_HEIGHT);
  // The column is one fixed object: the inspector replacing the list moves nothing.
  assert.deepEqual(
    inset,
    chromePadding({ viewportWidth: 1440, viewportHeight: 900, sheetHeight: 600 }),
  );
});

test('phone padding follows the bottom sheet', () => {
  const peek = chromePadding({ viewportWidth: 390, viewportHeight: 844, sheetHeight: 180 });
  const half = chromePadding({ viewportWidth: 390, viewportHeight: 844, sheetHeight: 422 });
  assert.ok(peek.bottom > 180);
  assert.ok(half.bottom > peek.bottom);
  assert.ok(peek.left < EXPLORE_COLUMN_WIDTH);
  // The lower 48 fill the phone's width: a slim, even gutter on both sides.
  assert.equal(peek.left, peek.right);
  assert.ok(peek.left <= 16);
  assert.equal(EXPLORE_PHONE_MAX_WIDTH, 1023);
});

test('where the column floats, the left inset always clears it plus a gutter on each side', () => {
  for (const viewport of [
    { viewportWidth: 1024, viewportHeight: 768 },
    { viewportWidth: 1280, viewportHeight: 800 },
    { viewportWidth: 1440, viewportHeight: 900 },
  ]) {
    const inset = chromePadding(viewport);
    assert.ok(inset.left >= EXPLORE_FLOAT_GUTTER * 2 + EXPLORE_COLUMN_WIDTH, JSON.stringify(inset));
    assert.ok(inset.left + inset.right < viewport.viewportWidth);
  }
});
