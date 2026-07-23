/**
 * Unit tests for Explore preview meta formatting.
 */
import { featureMetaLine } from '../explore-meta';

describe('featureMetaLine', () => {
  it('formats kind and place when both are known', () => {
    expect(
      featureMetaLine({
        kind: 'place',
        properties: { stateName: 'Texas' },
      }),
    ).toBe('Place · Texas');
  });

  it('prefers place and year when year is present', () => {
    expect(
      featureMetaLine({
        kind: 'person',
        properties: { stateName: 'New York', year: 1921 },
      }),
    ).toBe('New York · 1921');
  });
});
