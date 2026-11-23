/**
 * The ratio, made countable: "6.3 to 1" as two rows of equal units, the smaller group one unit and
 * the larger six and a fraction. It is the number half of a pair; the race-pair bars beside it show
 * the same two values in their own unit.
 */
import React, { type CSSProperties } from 'react';
import type { DataPageRacePairSeries } from '@repo/domain/statistics/data-page-series';
import { formatDataPageValue } from './chart-utils';
import { isRatioLabel } from './RacePairComparisonChart';

void React;

/** True when the series states a multiple that can be drawn as units. */
export function hasRatio(series: DataPageRacePairSeries): boolean {
  return (
    series.ratioValue !== undefined && series.ratioValue > 0 && isRatioLabel(series.ratioLabel)
  );
}

export function GapMagnitudeSight({ series }: { readonly series: DataPageRacePairSeries }) {
  const ratio = series.ratioValue;
  if (ratio === undefined || !hasRatio(series)) return null;

  // The smaller group is one unit; the larger is `ratio` units of the same size, so the two rows
  // compare by length on one scale. Capped so a very large ratio stays legible.
  const unitCount = Math.min(Math.ceil(ratio), 24);
  const primaryIsLarger = series.primary.value >= series.comparison.value;
  const groups = [
    { point: series.primary, units: primaryIsLarger ? ratio : 1, tone: 'hi' as const },
    { point: series.comparison, units: primaryIsLarger ? 1 : ratio, tone: 'lo' as const },
  ];
  const ratioText = ratio.toLocaleString('en-US', { maximumFractionDigits: 1 });

  return (
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
  );
}
