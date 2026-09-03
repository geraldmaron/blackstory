/**
 * Horizontal race-pair juxtaposition for `/data` — wealth, imprisonment, cost burden.
 * Flat matte bars with copper accent on the primary series only; full table alternative.
 */
import Link from 'next/link';
import React, { type ReactNode } from 'react';
import type { DataPageRacePairSeries } from '@repo/domain/statistics/data-page-series';
import { DataChartFrame } from './DataChartFrame';
import { chapterHrefForTheme, formatDataPageValue } from './chart-utils';

export type RacePairComparisonChartProps = {
  readonly series: DataPageRacePairSeries;
  readonly reading?: ReactNode;
  readonly figureLabel?: string;
  readonly span?: 'wide' | 'half';
  readonly id?: string;
};

/* Colour follows the entity across the page: the Black series is ink (viz-1) and the White
   series copper (viz-2) here, exactly as the grouped-bar fixtures assign them. */
/**
 * A series' `ratioLabel` is either a true ratio ("White-to-Black wealth ratio") or a difference in
 * percentage points ("Black minus White burden gap"). Only the first is a multiple.
 */
export function isRatioLabel(label: string | undefined): boolean {
  return /ratio/i.test(label ?? '');
}

const PRIMARY_FILL = 'var(--ds-viz-1)';
const COMPARISON_FILL = 'var(--ds-viz-2)';

export function RacePairComparisonChart({
  series,
  reading,
  figureLabel,
  span,
  id,
}: RacePairComparisonChartProps) {
  const maxValue = Math.max(series.primary.value, series.comparison.value);
  if (maxValue <= 0) {
    return null;
  }

  const primaryWidth = (series.primary.value / maxValue) * 100;
  const comparisonWidth = (series.comparison.value / maxValue) * 100;
  const themeLink = chapterHrefForTheme(series.themeId);

  return (
    <DataChartFrame
      title={series.title}
      {...(reading !== undefined ? { reading } : {})}
      {...(figureLabel !== undefined ? { figureLabel } : {})}
      {...(span !== undefined ? { span } : {})}
      {...(id !== undefined ? { id } : {})}
      caption={
        <>
          {series.caption}{' '}
          <span className="ds-data-chart__meta">
            {series.geographyLabel} · {series.referencePeriod}
          </span>
          {themeLink ? (
            <>
              {' '}
              <Link className="ds-data-page__theme-link" href={themeLink}>
                Read the chapter
              </Link>
            </>
          ) : null}
        </>
      }
      sources={series.sources}
      ariaLabel={`${series.title} for ${series.geographyLabel}`}
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>{series.title}</caption>
          <thead>
            <tr>
              <th scope="col">Group</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{series.primary.label}</th>
              <td>{formatDataPageValue(series.primary.value, series.primary.unit)}</td>
            </tr>
            <tr>
              <th scope="row">{series.comparison.label}</th>
              <td>{formatDataPageValue(series.comparison.value, series.comparison.unit)}</td>
            </tr>
            {series.ratioLabel && series.ratioValue !== undefined ? (
              <tr>
                <th scope="row">{series.ratioLabel}</th>
                <td>{series.ratioValue.toLocaleString('en-US')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      }
    >
      <div className="ds-data-chart__pair-bars" role="img" aria-hidden="true">
        <div className="ds-data-chart__pair-row">
          <span className="ds-data-chart__pair-label">{series.primary.label}</span>
          <div className="ds-data-chart__pair-track">
            <span
              className="ds-data-chart__pair-bar"
              style={{ width: `${primaryWidth}%`, background: PRIMARY_FILL }}
              title={`${series.primary.label}: ${formatDataPageValue(series.primary.value, series.primary.unit)}`}
            />
          </div>
          <span className="ds-data-chart__pair-value">
            {formatDataPageValue(series.primary.value, series.primary.unit)}
          </span>
        </div>
        <div className="ds-data-chart__pair-row">
          <span className="ds-data-chart__pair-label">{series.comparison.label}</span>
          <div className="ds-data-chart__pair-track">
            <span
              className="ds-data-chart__pair-bar"
              style={{ width: `${comparisonWidth}%`, background: COMPARISON_FILL }}
              title={`${series.comparison.label}: ${formatDataPageValue(series.comparison.value, series.comparison.unit)}`}
            />
          </div>
          <span className="ds-data-chart__pair-value">
            {formatDataPageValue(series.comparison.value, series.comparison.unit)}
          </span>
        </div>
      </div>
      {series.ratioLabel && series.ratioValue !== undefined ? (
        <p className="ds-data-chart__ratio">
          <span className="ds-data-chart__ratio-value">
            {series.ratioValue.toLocaleString('en-US')}
            {isRatioLabel(series.ratioLabel) ? '×' : ' pts'}
          </span>
          <span>{series.ratioLabel}</span>
        </p>
      ) : null}
    </DataChartFrame>
  );
}
