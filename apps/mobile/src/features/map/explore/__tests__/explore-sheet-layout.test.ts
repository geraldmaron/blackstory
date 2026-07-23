/**
 * Unit tests for Explore sheet geometry — attribution must clear the lifted peek.
 */
import {
  attributionBottomAbovePeekSheet,
  EXPLORE_SHEET_PEEK_FRACTION,
} from '../explore-sheet-layout';

describe('attributionBottomAbovePeekSheet', () => {
  it('places the pill above the peek sheet top gorhom actually resolves', () => {
    const mapAreaHeight = 700;
    const tabBarInset = 83;
    const bottom = attributionBottomAbovePeekSheet({ mapAreaHeight, tabBarInset });
    // gorhom resolves the '16%' peek snap against the FULL container height, so
    // the sheet top is tabBarInset + mapAreaHeight * peekFraction (inset NOT
    // subtracted before the fraction). The pill must clear that top by the gap.
    const sheetTop = tabBarInset + mapAreaHeight * EXPLORE_SHEET_PEEK_FRACTION;
    expect(bottom).toBeGreaterThan(sheetTop);
    expect(bottom).toBe(Math.round(sheetTop + 12));
  });

  it('falls back safely before the first layout pass', () => {
    const bottom = attributionBottomAbovePeekSheet({
      mapAreaHeight: 0,
      tabBarInset: 83,
    });
    expect(bottom).toBeGreaterThan(83);
  });
});
