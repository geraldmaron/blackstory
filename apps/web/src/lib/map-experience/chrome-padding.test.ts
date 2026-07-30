/**
 * Guards the camera padding clamp. The contract these tests defend is narrow but load-bearing:
 * MapLibre throws and kills map init when padding does not fit the canvas, so no combination of
 * viewport and open panels may ever produce an inset that fills an axis.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHROME_NARROW_MAX_WIDTH, chromePadding, type ChromeState } from './chrome-padding';

const VIEWPORTS = [
  { viewportWidth: 320, viewportHeight: 568 },
  { viewportWidth: 375, viewportHeight: 812 },
  { viewportWidth: 768, viewportHeight: 1024 },
  { viewportWidth: 1024, viewportHeight: 768 },
  { viewportWidth: 1440, viewportHeight: 900 },
  { viewportWidth: 1920, viewportHeight: 1080 },
] as const;

const BOOLEANS = [false, true] as const;

function everyPanelCombination(): ReadonlyArray<
  Pick<ChromeState, 'lensOpen' | 'resultsOpen' | 'sheetOpen'>
> {
  const combos: Array<Pick<ChromeState, 'lensOpen' | 'resultsOpen' | 'sheetOpen'>> = [];
  for (const lensOpen of BOOLEANS) {
    for (const resultsOpen of BOOLEANS) {
      for (const sheetOpen of BOOLEANS) {
        combos.push({ lensOpen, resultsOpen, sheetOpen });
      }
    }
  }
  return combos;
}

test('padding always fits the canvas across every viewport and panel combination', () => {
  for (const viewport of VIEWPORTS) {
    for (const panels of everyPanelCombination()) {
      const state: ChromeState = { ...viewport, ...panels };
      const inset = chromePadding(state);
      const label = `${viewport.viewportWidth}x${viewport.viewportHeight} ${JSON.stringify(panels)}`;

      assert.ok(
        inset.left + inset.right < viewport.viewportWidth,
        `horizontal padding must leave canvas at ${label}`,
      );
      assert.ok(
        inset.top + inset.bottom < viewport.viewportHeight,
        `vertical padding must leave canvas at ${label}`,
      );
      for (const [side, value] of Object.entries(inset)) {
        assert.ok(
          Number.isFinite(value) && value >= 0,
          `${side} must be a positive number at ${label}`,
        );
      }
    }
  }
});

test('padding never consumes more than half of either axis', () => {
  for (const viewport of VIEWPORTS) {
    for (const panels of everyPanelCombination()) {
      const inset = chromePadding({ ...viewport, ...panels });
      assert.ok(inset.left + inset.right <= viewport.viewportWidth * 0.5);
      assert.ok(inset.top + inset.bottom <= viewport.viewportHeight * 0.5);
    }
  }
});

test('clamp engages at 1024 with every panel open', () => {
  const unclamped = chromePadding({
    viewportWidth: 1024,
    viewportHeight: 768,
    lensOpen: true,
    resultsOpen: true,
    sheetOpen: true,
  });

  // Lens 330 + sheet 468 = 798, well past the 512 budget at this width.
  assert.ok(unclamped.left < 330, 'left must be scaled down by the clamp');
  assert.ok(unclamped.right < 468, 'right must be scaled down by the clamp');
  assert.ok(unclamped.left + unclamped.right <= 512);

  // Both sides scale by the same factor, so their ratio survives the clamp.
  const ratio = unclamped.left / unclamped.right;
  assert.ok(Math.abs(ratio - 330 / 468) < 0.02, 'clamp must scale both sides proportionally');
});

test('wide layout reserves room for whichever panels are open', () => {
  const base = { viewportWidth: 1920, viewportHeight: 1080 } as const;

  const none = chromePadding({ ...base, lensOpen: false, resultsOpen: false, sheetOpen: false });
  assert.equal(none.left, 40);
  assert.equal(none.right, 40);

  const lens = chromePadding({ ...base, lensOpen: true, resultsOpen: false, sheetOpen: false });
  assert.equal(lens.left, 330);

  const results = chromePadding({ ...base, lensOpen: false, resultsOpen: true, sheetOpen: false });
  assert.equal(results.right, 376);

  // The sheet replaces the results rail rather than stacking with it, so it wins the right edge.
  const sheet = chromePadding({ ...base, lensOpen: false, resultsOpen: true, sheetOpen: true });
  assert.equal(sheet.right, 468);
});

test('narrow layout ignores panel state and uses stacked insets', () => {
  const narrow = { viewportWidth: 375, viewportHeight: 812 } as const;
  const closed = chromePadding({
    ...narrow,
    lensOpen: false,
    resultsOpen: false,
    sheetOpen: false,
  });
  const open = chromePadding({ ...narrow, lensOpen: true, resultsOpen: true, sheetOpen: true });

  assert.deepEqual(closed, open, 'panels overlay the map below the narrow breakpoint');
  assert.equal(closed.left, 16);
  assert.equal(closed.right, 16);
  assert.equal(closed.top, 88);
});

test('narrow breakpoint switches exactly at the documented width', () => {
  const panels = { lensOpen: true, resultsOpen: false, sheetOpen: false } as const;
  const justNarrow = chromePadding({
    viewportWidth: CHROME_NARROW_MAX_WIDTH - 1,
    viewportHeight: 900,
    ...panels,
  });
  const justWide = chromePadding({
    viewportWidth: CHROME_NARROW_MAX_WIDTH,
    viewportHeight: 900,
    ...panels,
  });

  assert.equal(justNarrow.left, 16);
  assert.equal(justWide.left, 330);
});

test('short viewports fall back to symmetric vertical padding', () => {
  // 88 + min(210, 120) = 208, past the 200 budget on a 400px-tall canvas.
  const short = chromePadding({
    viewportWidth: 320,
    viewportHeight: 400,
    lensOpen: false,
    resultsOpen: false,
    sheetOpen: false,
  });
  assert.equal(short.top, 40);
  assert.equal(short.bottom, 40);
  assert.ok(short.top + short.bottom < 400);
});

test('degenerate viewports still produce a fitting inset', () => {
  for (const viewportHeight of [0, 1, 60, 120]) {
    for (const viewportWidth of [0, 1, 200, 900]) {
      const inset = chromePadding({
        viewportWidth,
        viewportHeight,
        lensOpen: true,
        resultsOpen: true,
        sheetOpen: true,
      });
      assert.ok(inset.top + inset.bottom <= viewportHeight * 0.5);
      assert.ok(inset.left + inset.right <= viewportWidth * 0.5);
    }
  }
});
