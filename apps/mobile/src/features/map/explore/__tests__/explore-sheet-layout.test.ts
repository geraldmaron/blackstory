/**
 * Unit tests for Explore sheet geometry — attribution must clear the lifted peek.
 */
import {
  attributionBottomAbovePeekSheet,
  EXPLORE_SHEET_PEEK_FRACTION,
} from '../explore-sheet-layout';

describe('attributionBottomAbovePeekSheet', () => {
  it('places the pill above peek + tab bar inset (not under the sheet)', () => {
    const mapAreaHeight = 700;
    const tabBarInset = 83;
    const bottom = attributionBottomAbovePeekSheet({ mapAreaHeight, tabBarInset });
    const usable = mapAreaHeight - tabBarInset;
    const sheetTop = tabBarInset + usable * EXPLORE_SHEET_PEEK_FRACTION;
    expect(bottom).toBeGreaterThan(sheetTop);
    expect(bottom).toBe(Math.round(sheetTop + 8));
  });

  it('falls back safely before the first layout pass', () => {
    const bottom = attributionBottomAbovePeekSheet({
      mapAreaHeight: 0,
      tabBarInset: 83,
    });
    expect(bottom).toBeGreaterThan(83);
  });
});
