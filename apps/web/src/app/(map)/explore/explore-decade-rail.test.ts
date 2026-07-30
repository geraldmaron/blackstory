/**
 * Unit tests for explore decade-rail drag-scroll helpers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyDecadeRailDrag,
  beginDecadeRailDrag,
  buildDecadeRailStops,
  decadeStopToEra,
  DECADE_RAIL_DRAG_THRESHOLD_PX,
} from './explore-decade-rail';

describe('buildDecadeRailStops', () => {
  it('prefixes all-time then catalog decades', () => {
    assert.deepEqual(buildDecadeRailStops([{ decade: '1860s' }, { decade: '1960s' }]), [
      'all',
      '1860s',
      '1960s',
    ]);
  });
});

describe('decadeStopToEra', () => {
  it('maps all to undefined and decades through', () => {
    assert.equal(decadeStopToEra('all'), undefined);
    assert.equal(decadeStopToEra('1860s'), '1860s');
  });
});

describe('decade rail drag-scroll', () => {
  it('scrolls the strip opposite the pointer delta and marks moved past threshold', () => {
    const list = {
      scrollLeft: 100,
      scrollWidth: 500,
      clientWidth: 200,
    } as unknown as HTMLElement;

    const drag = beginDecadeRailDrag(list, 1, 200);
    assert.equal(drag.startScrollLeft, 100);
    assert.equal(drag.moved, false);

    const small = applyDecadeRailDrag(list, drag, 200 - (DECADE_RAIL_DRAG_THRESHOLD_PX - 1));
    assert.equal(small, false);
    assert.equal(list.scrollLeft, 100 + (DECADE_RAIL_DRAG_THRESHOLD_PX - 1));

    const big = applyDecadeRailDrag(list, drag, 200 - 40);
    assert.equal(big, true);
    assert.equal(drag.moved, true);
    assert.equal(list.scrollLeft, 140);
  });

  it('clamps scroll to the strip bounds', () => {
    const list = {
      scrollLeft: 0,
      scrollWidth: 300,
      clientWidth: 200,
    } as unknown as HTMLElement;

    const drag = beginDecadeRailDrag(list, 1, 100);
    applyDecadeRailDrag(list, drag, 180);
    assert.equal(list.scrollLeft, 0);

    applyDecadeRailDrag(list, drag, 0);
    assert.equal(list.scrollLeft, 100);
  });
});
