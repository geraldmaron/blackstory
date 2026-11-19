/**
 * The ratio, made countable: "6.3 to 1" as two rows of equal units, the smaller group one unit and
 * the larger six and a fraction. It is the number half of a pair; the race-pair bars beside it show
 * the same two values in their own unit.
 */
import React, { type CSSProperties, type ReactNode } from 'react';
import type { DataPageRacePairSeries } from '@repo/domain/statistics/data-page-series';
import { DataChartFrame } from './DataChartFrame';
import { chapterHrefForTheme, formatDataPageValue } from './chart-utils';
import { isRatioLabel } from './RacePairComparisonChart';

void React;

export type GapMagnitudeSightProps = {
  readonly series: DataPageRacePairSeries;
  readonly reading?: ReactNode;
  readonly id?: string;
  readonly span?: 'wide' | 'half';
};

export function GapMagnitudeSight({ series, reading, id, span = 'half' }: GapMagnitudeSightProps) {
  const ratio = series.ratioValue;
  if (ratio === undefined || !isRatioLabel(series.ratioLabel) || ratio <= 0) {
    return null;
  }

  // The smaller group is one unit; the larger is `ratio` units of the same size, so the two rows
  // compare by length on one scale. Capped so a very large ratio stays legible.
  const unitCount = Math.min(Math.ceil(ratio), 24);
  const primaryIsLarger = series.primary.value >= series.comparison.value;
  const groups = [
    { point: series.primary, units: primaryIsLarger ? ratio : 1, tone: 'hi' as const },
    { point: series.comparison, units: primaryIsLarger ? 1 : ratio, tone: 'lo' as const },
  ];
  const chapterHref = chapterHrefForTheme(series.themeId);
  const ratioText = ratio.toLocaleString('en-US', { maximumFractionDigits: 1 });

  return (
    <DataChartFrame
      title={`${series.ratioLabel ?? series.title} · ${series.geographyLabel}, ${series.referencePeriod}`}
      {...(reading !== undefined ? { reading } : {})}
      {...(id !== undefined ? { id } : {})}
      {...(chapterHref ? { chapterHref } : {})}
      span={span}
      caption={series.caption}
      sources={series.sources}
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
      <div
        className="ds-ratio"
        role="img"
        aria-label={`${series.comparison.label} to ${series.primary.label}: ${ratioText} to 1`}
      >
        <p className="ds-ratio__number" aria-hidden="true">
          <span className="ds-ratio__value">{ratioText}</span>
          <span className="ds-ratio__unit">to 1</span>
        </p>
        <ul className="ds-ratio__rows" aria-hidden="true">
          {groups.map((group) => {
            const whole = Math.min(Math.floor(group.units), unitCount);
            const part = group.units - Math.floor(group.units);
            return (
              <li key={group.point.label} className="ds-ratio__row">
                <span className="ds-ratio__name">
                  {group.point.label}{' '}
                  <strong>{formatDataPageValue(group.point.value, group.point.unit)}</strong>
                </span>
                <span className="ds-ratio__units" style={{ '--units': unitCount } as CSSProperties}>
                  {Array.from({ length: whole }, (_, index) => (
                    <span key={index} className="ds-ratio__unit-mark" data-tone={group.tone} />
                  ))}
                  {part > 0.05 && whole < unitCount ? (
                    <span
                      className="ds-ratio__unit-mark"
                      data-tone={group.tone}
                      style={{ '--part': part } as CSSProperties}
                    />
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </DataChartFrame>
  );
}
