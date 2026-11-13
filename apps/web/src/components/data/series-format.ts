/**
 * Shared choices for the indicator series charts: which series is highlighted and how an axis tick
 * reads in the series' unit.
 */
import type {
  DataPageGroupedBarSeries,
  DataPageValueUnit,
} from '@repo/domain/statistics/data-page-series';
import { compactNumber, type Tone } from './chart-kit';

/**
 * The Black series is the highlighted one (copper); every other series is the ink comparison. A
 * series set with no Black series (a single ratio line) highlights its only series.
 */
export function seriesTone(series: DataPageGroupedBarSeries, id: string): Tone {
  const hasBlack = series.series.some((def) => /black/i.test(def.label));
  if (!hasBlack) return 'hi';
  const def = series.series.find((entry) => entry.id === id);
  return def && /black/i.test(def.label) ? 'hi' : 'lo';
}

/** The plotted line under a finding: the series title, plus its place when the title lacks it. */
export function seriesSubtitle(series: DataPageGroupedBarSeries): string {
  const place = series.geographyLabel.split(',')[0]!.trim();
  return series.title.includes(place) ? series.title : `${series.title} · ${series.geographyLabel}`;
}

/** An axis tick in the series' unit, compact: "$150K", "40%", "60×". */
export function axisValue(value: number, unit: DataPageValueUnit): string {
  switch (unit) {
    case 'usd':
      return `$${compactNumber(value)}`;
    case 'percent':
      return `${compactNumber(value)}%`;
    case 'ratio':
      return `${compactNumber(value)}×`;
    default:
      return compactNumber(value);
  }
}
