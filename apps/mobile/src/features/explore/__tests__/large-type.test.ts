import { LARGE_TYPE_THRESHOLD, linesForFontScale } from '../large-type';

describe('linesForFontScale', () => {
  it('leaves the one-line rhythm alone across the standard text sizes', () => {
    for (const scale of [0.8, 1, 1.15, 1.3, 1.4, 1.49]) {
      expect(linesForFontScale(1, scale)).toBe(1);
    }
  });

  it('starts growing exactly at the threshold, not before it', () => {
    expect(linesForFontScale(1, LARGE_TYPE_THRESHOLD - 0.01)).toBe(1);
    expect(linesForFontScale(1, LARGE_TYPE_THRESHOLD)).toBe(2);
  });

  it('gives the accessibility sizes the ceiling', () => {
    // ~3.1x is iOS's accessibility-extra-extra-extra-large, where a rail title had room for
    // about four characters.
    expect(linesForFontScale(1, 3.1)).toBe(3);
    expect(linesForFontScale(1, 5)).toBe(3);
  });

  it('never exceeds the ceiling it is given', () => {
    for (let scale = 1; scale <= 6; scale += 0.1) {
      expect(linesForFontScale(1, scale, 2)).toBeLessThanOrEqual(2);
    }
  });

  it('is monotonic — a larger text size never gets fewer lines', () => {
    let previous = 0;
    for (let scale = 0.5; scale <= 6; scale += 0.05) {
      const lines = linesForFontScale(1, scale);
      expect(lines).toBeGreaterThanOrEqual(previous);
      previous = lines;
    }
  });

  it('falls back to the base clamp when the platform reports no usable scale', () => {
    expect(linesForFontScale(1, Number.NaN)).toBe(1);
    expect(linesForFontScale(2, Number.POSITIVE_INFINITY)).toBe(2);
  });
});
