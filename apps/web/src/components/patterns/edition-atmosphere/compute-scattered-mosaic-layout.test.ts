/**
 * Scattered edition mosaic layout — deterministic gutter placement contracts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeScatteredMosaicLayout } from './compute-scattered-mosaic-layout';

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

  it('places tiles in left or right gutter bands only', () => {
    const layout = computeScatteredMosaicLayout({ seedKey: 'home-edition-v6', count: 16 });
    assert.ok(layout.length >= 6);
    for (const placement of layout) {
      assert.ok(placement.side === 'left' || placement.side === 'right');
      assert.ok(placement.gutterX >= 0 && placement.gutterX <= 1);
      assert.ok(placement.gutterY >= 0 && placement.gutterY <= 1);
      assert.ok(placement.opacity > 0 && placement.opacity < 0.2);
      assert.match(placement.tile.path, /^\/brand\/collage\/tiles\//);
    }
  });
});
