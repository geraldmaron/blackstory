/**
 * Scattered edition mosaic layout — deterministic gutter polaroid placement contracts.
 * Frames are collision-packed so polaroids never overlap within a gutter.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EDITION_MOSAIC_COUNT_BROWSE,
  EDITION_MOSAIC_COUNT_DETAIL,
} from './edition-atmosphere-config';
import {
  computeScatteredMosaicLayout,
  scatteredMosaicPlacementsOverlap,
} from './compute-scattered-mosaic-layout';

describe('computeScatteredMosaicLayout', () => {
  it('is stable for the same seed key', () => {
    const a = computeScatteredMosaicLayout({ seedKey: 'home-edition-v6', count: 12 });
    const b = computeScatteredMosaicLayout({ seedKey: 'home-edition-v6', count: 12 });
    assert.deepEqual(
      a.map((entry) => entry.tile.path),
      b.map((entry) => entry.tile.path),
    );
    assert.equal(a[0]?.side, b[0]?.side);
    assert.equal(a[0]?.gutterX, b[0]?.gutterX);
  });

  it('rotates tile order for different seed keys', () => {
    const home = computeScatteredMosaicLayout({ seedKey: 'home-edition-v6', count: 8 });
    const alt = computeScatteredMosaicLayout({ seedKey: 'home-alt', count: 8 });
    assert.notDeepEqual(
      home.map((entry) => entry.tile.path),
      alt.map((entry) => entry.tile.path),
    );
  });

  it('places polaroid frames in left or right gutter bands only', () => {
    const layout = computeScatteredMosaicLayout({
      seedKey: 'home-edition-v6',
      count: EDITION_MOSAIC_COUNT_BROWSE,
    });
    assert.ok(layout.length >= 8);
    assert.ok(layout.length <= EDITION_MOSAIC_COUNT_BROWSE);
    for (const placement of layout) {
      assert.ok(placement.side === 'left' || placement.side === 'right');
      assert.ok(placement.gutterX >= 0 && placement.gutterX <= 1);
      assert.ok(placement.gutterY >= 0 && placement.gutterY <= 1);
      assert.ok(placement.opacity >= 0.16 && placement.opacity <= 0.31);
      assert.ok(placement.widthRem >= 2.3 && placement.widthRem <= 4.0);
      assert.ok(placement.heightRem > placement.widthRem);
      assert.match(placement.objectPosition, /^\d+\.\d% \d+\.\d%$/);
      assert.match(placement.tile.path, /^\/brand\/collage\/tiles\//);
    }
  });

  it('never overlaps polaroids within the same gutter', () => {
    for (const seedKey of ['home-edition-v6', 'about-edition-v6', 'stories-edition-v6']) {
      const layout = computeScatteredMosaicLayout({
        seedKey,
        count: EDITION_MOSAIC_COUNT_BROWSE,
      });
      for (let i = 0; i < layout.length; i += 1) {
        for (let j = i + 1; j < layout.length; j += 1) {
          assert.equal(
            scatteredMosaicPlacementsOverlap(layout[i]!, layout[j]!),
            false,
            `${seedKey}: placement ${i} overlaps ${j}`,
          );
        }
      }
    }
  });

  it('reuses tiles from the pool for dense scatter counts', () => {
    const layout = computeScatteredMosaicLayout({
      seedKey: 'home-edition-v6',
      count: EDITION_MOSAIC_COUNT_BROWSE,
    });
    const uniquePaths = new Set(layout.map((entry) => entry.tile.path));
    assert.ok(uniquePaths.size < layout.length);
  });

  it('respects browse and detail density targets when packing fits', () => {
    assert.equal(
      computeScatteredMosaicLayout({ seedKey: 'about-edition-v6', count: EDITION_MOSAIC_COUNT_BROWSE })
        .length,
      EDITION_MOSAIC_COUNT_BROWSE,
    );
    assert.equal(
      computeScatteredMosaicLayout({ seedKey: 'entity-edition-v6:x', count: EDITION_MOSAIC_COUNT_DETAIL })
        .length,
      EDITION_MOSAIC_COUNT_DETAIL,
    );
  });
});
