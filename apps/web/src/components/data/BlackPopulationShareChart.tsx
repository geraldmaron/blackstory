/**
 * Black share of the U.S. population at every census, 1790 to 2020: the Plain drawing of figure
 * D-01 (`figures/registry.tsx`). The line BREAKS at the 2000 definition change ("Black alone", when
 * people could mark more than one race) and the span after it is labeled, so the chart never
 * implies the two sides are measured the same way. A census with no total breaks the line too: a
 * gap, never a zero. The baseline is zero: a truncated axis made the fall from 1790 and the
 * recovery after 1930 look far steeper than they are.
 */
import React from 'react';
import type { NationalPopulationTimelineRow } from '@repo/domain/statistics/public-data-summaries';
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

function shareOf(row: NationalPopulationTimelineRow): number {
  return row.totalPopulation > 0 ? (row.blackPopulation / row.totalPopulation) * 100 : 0;
}

export function ShareLine({ rows }: { readonly rows: readonly NationalPopulationTimelineRow[] }) {
  const shares = rows.map(shareOf);
  const { top, ticks } = valueScale(Math.max(...shares), (value) => `${value}%`);
  const { center, width } = bandLayout(rows.length);
  const y = (value: number) => (value / top) * 100;
  const boundary = rows.findIndex((row) => row.opensDefinitionBoundary);

  const points: LinePoint[] = [];
  rows.forEach((row, index) => {
    if (index === boundary && index > 0) points.push(null);
    points.push(row.totalPopulation > 0 ? { x: center(index), y: y(shares[index]!) } : null);
  });

  const peak = shares.indexOf(Math.max(...shares));
  const trough = shares.indexOf(
    Math.min(...shares.filter((_, index) => rows[index]!.totalPopulation > 0)),
  );
  const last = rows.length - 1;

  return (
    <Plot
      label="Black share of the U.S. population at each census"
      unit="Percent of the U.S. population"
      size="md"
      yTicks={ticks}
      xTicks={categoryTicks(
        rows.map((row) => row.decade),
        center,
        2,
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
      <Lines series={[{ id: 'share', points, tone: 'hi' }]} />
      {rows.map((row, index) =>
        row.totalPopulation > 0 ? (
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
            <Dot x={50} y={y(shares[index]!)} size="md" />
          </Mark>
        ) : (
          <PointLabel key={row.decade} x={center(index)} y={0}>
            no data
          </PointLabel>
        ),
      )}
      {/* The peak, the low point and the latest value, named on the line. */}
      {[peak, trough, last].map((index) => (
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
      ))}
    </Plot>
  );
}
