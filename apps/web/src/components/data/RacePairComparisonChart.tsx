/**
 * Horizontal race-pair juxtaposition for `/data` — wealth, imprisonment, cost burden.
 * Flat matte bars with copper accent on the primary series only; full table alternative.
 */
import Link from 'next/link';
import React from 'react';
import type { DataPageRacePairSeries } from '@repo/domain/statistics/data-page-series';
import { DataChartFrame } from './DataChartFrame';
import { formatDataPageValue } from './chart-utils';

export type RacePairComparisonChartProps = {
  readonly series: DataPageRacePairSeries;
};

const PRIMARY_FILL = 'var(--ds-viz-2)';
const COMPARISON_FILL = 'var(--ds-viz-3)';

function themeHref(themeId: string | undefined): string | undefined {
  if (!themeId) return undefined;
  return `/themes/${themeId}`;
}

export function RacePairComparisonChart({ series }: RacePairComparisonChartProps) {
  const maxValue = Math.max(series.primary.value, series.comparison.value);
  if (maxValue <= 0) {
    return null;
  }

  const primaryWidth = (series.primary.value / maxValue) * 100;
  const comparisonWidth = (series.comparison.value / maxValue) * 100;
  const themeLink = themeHref(series.themeId);

  return (
    <DataChartFrame
      title={series.title}
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
                See this in Themes
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
            />
          </div>
          <span className="ds-data-chart__pair-value">
            {formatDataPageValue(series.comparison.value, series.comparison.unit)}
          </span>
        </div>
      </div>
      {series.ratioLabel && series.ratioValue !== undefined ? (
        <p className="ds-data-chart__ratio">
          {series.ratioLabel}: {series.ratioValue.toLocaleString('en-US')}
        </p>
      ) : null}
    </DataChartFrame>
  );
}
