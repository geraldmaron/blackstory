/**
 * Unit tests for Data formatters and fixture snapshot integrity.
 */
import { formatCount, formatDataValue } from '../format';
import { DATA_INDICATOR_FIXTURE_BUNDLE, getDataPageModel, PHASE1_COVERAGE_SUMMARY } from '../indicator-snapshot';

describe('formatDataValue', () => {
  it('formats USD without cents', () => {
    expect(formatDataValue(44_900, 'usd')).toBe('$44,900');
  });

  it('formats percent with one decimal when needed', () => {
    expect(formatDataValue(37.1, 'percent')).toBe('37.1%');
    expect(formatDataValue(42, 'percent')).toBe('42%');
  });

  it('formats per-100k and months', () => {
    expect(formatDataValue(912, 'per_100k')).toBe('912 per 100k');
    expect(formatDataValue(60, 'months')).toBe('60 mo');
  });
});

describe('formatCount', () => {
  it('localizes integer counts', () => {
    expect(formatCount(32)).toBe('32');
  });
});

describe('getDataPageModel', () => {
  it('serves fixture indicators and marks census timeline unavailable', () => {
    const model = getDataPageModel();
    expect(model.censusTimelineAvailable).toBe(false);
    expect(model.indicators.servedFrom).toBe('fixture');
    expect(model.indicators.wealthComparison.primary.value).toBe(44_900);
    expect(model.indicators.wealthComparison.comparison.value).toBe(285_000);
    expect(model.phase1.metricCount).toBe(PHASE1_COVERAGE_SUMMARY.metricCount);
  });

  it('keeps grouped series periods and dual series ids', () => {
    const home = DATA_INDICATOR_FIXTURE_BUNDLE.cookHomeownership;
    expect(home.points).toHaveLength(3);
    expect(home.series.map((s) => s.id)).toEqual(['black', 'white']);
    expect(home.points[0]?.values.black).toBe(37.1);
  });

  it('lists every Phase 1 theme used on web DataSections Themes strip', () => {
    expect(PHASE1_COVERAGE_SUMMARY.themes).toEqual(
      expect.arrayContaining(['demography', 'wealth', 'housing', 'justice']),
    );
    expect(PHASE1_COVERAGE_SUMMARY.sampleObservationCount).toBe(0);
  });
});
