/**
 * Black share of the U.S. population at every census, 1790 to 2020. The line BREAKS at the 2000
 * definition change ("Black alone", when people could mark more than one race) and the span after
 * it is labeled, so the chart never implies the two sides are measured the same way. The baseline
 * is zero: a truncated axis made the fall from 1790 and the recovery after 1930 look far steeper
 * than they are.
 *
 * `ShareLine` is also the drawing inside the decade spine (Figure 1), at strip height.
 */
import React, { type ReactNode } from 'react';
import type { NationalPopulationTimelineRow } from '@repo/domain/statistics/public-data-summaries';
import { DataChartFrame } from './DataChartFrame';
import {
  Band,
  Dot,
  Lines,
  Mark,
  Plot,
  PointLabel,
  Tip,
  bandLayout,
  categoryTicks,
  valueScale,
  type LinePoint,
} from './chart-kit';
import { formatSharePct } from './chart-utils';

void React;

export type BlackPopulationShareChartProps = {
  readonly rows: readonly NationalPopulationTimelineRow[];
  readonly sources: readonly { readonly label: string; readonly url: string }[];
  readonly reading?: ReactNode;
  readonly span?: 'wide' | 'half';
  readonly id?: string;
};

function shareOf(row: NationalPopulationTimelineRow): number {
  return row.totalPopulation > 0 ? (row.blackPopulation / row.totalPopulation) * 100 : 0;
}

export function ShareLine({
  rows,
  size,
  annotateExtremes,
}: {
  readonly rows: readonly NationalPopulationTimelineRow[];
  readonly size: 'sm' | 'md';
  /** Label the peak, the low point and the latest value on the line (the spine does). */
  readonly annotateExtremes: boolean;
}) {
  const shares = rows.map(shareOf);
  const { top, ticks } = valueScale(Math.max(...shares), (value) => `${value}%`);
  const { center, width } = bandLayout(rows.length);
  const y = (value: number) => (value / top) * 100;
  const boundary = rows.findIndex((row) => row.opensDefinitionBoundary);

  const points: LinePoint[] = [];
  rows.forEach((_, index) => {
    if (index === boundary && index > 0) points.push(null);
    points.push({ x: center(index), y: y(shares[index]!) });
  });

  const peak = shares.indexOf(Math.max(...shares));
  const trough = shares.indexOf(Math.min(...shares));
  const last = rows.length - 1;
  const step = size === 'sm' ? 3 : 2;

  return (
    <Plot
      label="Black share of the U.S. population at each census"
      {...(size === 'md' ? { unit: 'Percent of the U.S. population' } : {})}
      size={size}
      yTicks={size === 'sm' ? ticks.filter((_, index) => index % 2 === 0) : ticks}
      xTicks={categoryTicks(
        rows.map((row) => row.decade),
        center,
        step,
      )}
    >
      {boundary > 0 ? (
        <Band
          from={center(boundary) - width / 2}
          to={100}
          kind="break"
          label="“Black alone” from 2000"
        />
      ) : null}
      <Lines series={[{ id: 'share', points, tone: 'hi', area: size === 'sm' }]} />
      {rows.map((row, index) => (
        <Mark
          key={row.decade}
          x={center(index)}
          width={width}
          first={index === 0}
          crosshair
          ariaLabel={`${row.decade}: ${formatSharePct(row.blackPopulation, row.totalPopulation)} of the U.S. population`}
          tipY={y(shares[index]!)}
          tip={
            <Tip
              title={`${row.decade} census`}
              rows={[
                {
                  value: formatSharePct(row.blackPopulation, row.totalPopulation),
                  label: 'of the population',
                },
              ]}
            />
          }
        >
          <Dot x={50} y={y(shares[index]!)} size={size === 'sm' ? 'sm' : 'md'} />
        </Mark>
      ))}
      {annotateExtremes
        ? [peak, trough, last].map((index) => (
            <PointLabel
              key={index}
              x={center(index)}
              y={y(shares[index]!)}
              place={index === trough ? 'below' : 'above'}
              strong={index === last}
            >
              {formatSharePct(rows[index]!.blackPopulation, rows[index]!.totalPopulation)}{' '}
              {rows[index]!.decade}
            </PointLabel>
          ))
        : null}
    </Plot>
  );
}

export function BlackPopulationShareChart({
  rows,
  sources,
  reading,
  span,
  id,
}: BlackPopulationShareChartProps) {
  if (rows.length === 0) return null;

  return (
    <DataChartFrame
      title="Black share of the U.S. population, 1790 to 2020"
      {...(reading !== undefined ? { reading } : {})}
      {...(span !== undefined ? { span } : {})}
      {...(id !== undefined ? { id } : {})}
      caption={
        'Black share of the total U.S. population in each census. The line breaks at 2000, when ' +
        '“Black alone” and multiple-race answers began: a definition change, not a missing year. ' +
        'The axis starts at zero.'
      }
      sources={sources}
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>Black share of the U.S. population, 1790 to 2020</caption>
          <thead>
            <tr>
              <th scope="col">Decade</th>
              <th scope="col">Share of total population</th>
              <th scope="col">Category</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.decade}>
                <th scope="row">{row.decade}</th>
                <td>{formatSharePct(row.blackPopulation, row.totalPopulation)}</td>
                <td>{row.raceCategoryLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ShareLine rows={rows} size="md" annotateExtremes={false} />
    </DataChartFrame>
  );
}
