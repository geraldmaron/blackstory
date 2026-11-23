/**
 * Two groups, one measure, one place and period: two horizontal bars on a shared scale with their
 * values printed at the end. The Black series is the highlighted one (ink); the comparison is the
 * lighter neutral. The full table sits behind Numbers.
 */
import React from 'react';
import type { DataPageRacePairSeries } from '@repo/domain/statistics/data-page-series';
import { ChartMarks } from './ChartMarks';
import { formatDataPageValue } from './chart-utils';

void React;

export type RacePairComparisonChartProps = {
  readonly series: DataPageRacePairSeries;
  /** False when a ratio figure beside this one already states the gap, so it is said once. */
  readonly showGap?: boolean;
};

/**
 * A series' `ratioLabel` is either a true ratio ("White-to-Black wealth ratio") or a difference in
 * percentage points ("Black minus White burden gap"). Only the first is a multiple.
 */
export function isRatioLabel(label: string | undefined): boolean {
  return /ratio/i.test(label ?? '');
}

export function RacePairComparisonChart({ series, showGap = true }: RacePairComparisonChartProps) {
  const maxValue = Math.max(series.primary.value, series.comparison.value);
  const rows = [
    { point: series.primary, tone: 'hi' as const },
    { point: series.comparison, tone: 'lo' as const },
  ];

  return (
    <>
      <ChartMarks label={series.title}>
        <ul className="ds-hbars">
          {rows.map(({ point, tone }, index) => {
            const value = formatDataPageValue(point.value, point.unit);
            return (
              <li
                key={point.label}
                className="ds-hbar"
                data-mark=""
                tabIndex={index === 0 ? 0 : -1}
                aria-label={`${point.label}: ${value}`}
              >
                <span className="ds-hbar__label" aria-hidden="true">
                  {point.label}
                </span>
                <span className="ds-hbar__track" aria-hidden="true">
                  <span
                    className="ds-hbar__fill"
                    data-tone={tone}
                    style={{ width: `${(point.value / maxValue) * 100}%` }}
                  />
                </span>
                <span className="ds-hbar__value" aria-hidden="true">
                  {value}
                </span>
              </li>
            );
          })}
        </ul>
      </ChartMarks>
      {showGap && series.ratioLabel && series.ratioValue !== undefined ? (
        <p className="ds-pair-gap">
          <strong>
            {series.ratioValue.toLocaleString('en-US')}
            {isRatioLabel(series.ratioLabel) ? ' to 1' : ' points'}
          </strong>{' '}
          {series.ratioLabel}
        </p>
      ) : null}
    </>
  );
}
