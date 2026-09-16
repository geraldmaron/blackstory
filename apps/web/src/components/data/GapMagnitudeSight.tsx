/**
 * Ratio magnitude sight for race-pair indicators: a large multiple with proportional marks so
 * the gap is felt before the bars, without color-only signaling.
 */
import React, { type ReactNode } from 'react';
import type { DataPageRacePairSeries } from '@repo/domain/statistics/data-page-series';
import { DataChartFrame } from './DataChartFrame';
import { formatDataPageValue } from './chart-utils';
import { isRatioLabel } from './RacePairComparisonChart';

void React;

export type GapMagnitudeSightProps = {
  readonly series: DataPageRacePairSeries;
  readonly reading?: ReactNode;
  readonly figureLabel?: string;
  readonly id?: string;
  readonly span?: 'wide' | 'half';
};

export function GapMagnitudeSight({
  series,
  reading,
  figureLabel,
  id,
  span = 'half',
}: GapMagnitudeSightProps) {
  const ratio = series.ratioValue;
  if (ratio === undefined || !isRatioLabel(series.ratioLabel) || ratio <= 0) {
    return null;
  }

  const marks = Math.min(Math.round(ratio), 12);
  const remainder = ratio - marks;

  return (
    <DataChartFrame
      title={series.ratioLabel ?? series.title}
      {...(reading !== undefined ? { reading } : {})}
      {...(figureLabel !== undefined ? { figureLabel } : {})}
      {...(id !== undefined ? { id } : {})}
      span={span}
      caption={
        <>
          {series.caption}{' '}
          <span className="ds-data-chart__meta">
            {series.geographyLabel} · {series.referencePeriod}
          </span>
        </>
      }
      sources={series.sources}
      ariaLabel={`${series.ratioLabel ?? series.title}: ${ratio.toLocaleString('en-US')} to 1`}
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
            <tr>
              <th scope="row">Ratio</th>
              <td>{ratio.toLocaleString('en-US')} to 1</td>
            </tr>
          </tbody>
        </table>
      }
    >
      <div className="ds-gap-sight" role="img" aria-hidden="true">
        <p className="ds-gap-sight__ratio">
          <span className="ds-gap-sight__value">
            {ratio.toLocaleString('en-US', { maximumFractionDigits: 1 })}
          </span>
          <span className="ds-gap-sight__unit">to 1</span>
        </p>
        <div className="ds-gap-sight__marks">
          {Array.from({ length: marks }, (_, index) => (
            <span
              key={index}
              className="ds-gap-sight__mark"
              data-tone={index === 0 ? 'primary' : 'compare'}
            />
          ))}
          {remainder > 0.05 ? (
            <span
              className="ds-gap-sight__mark ds-gap-sight__mark--partial"
              data-tone="compare"
              style={{ flexGrow: remainder, flexBasis: 0 }}
            />
          ) : null}
        </div>
        <p className="ds-gap-sight__pair">
          {series.primary.label}: {formatDataPageValue(series.primary.value, series.primary.unit)}
          {' · '}
          {series.comparison.label}:{' '}
          {formatDataPageValue(series.comparison.value, series.comparison.unit)}
        </p>
      </div>
    </DataChartFrame>
  );
}
