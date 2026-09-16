/**
 * Decade spine for the Data chapter: share of the U.S. population as a continuous path across
 * census decades. Acts as the visual time axis that Counted and Lived share.
 */
import React, { type ReactNode } from 'react';
import type { NationalPopulationTimelineRow } from '@repo/domain/statistics/public-data-summaries';
import { DataChartFrame } from './DataChartFrame';
import { formatSharePct, niceMax, scaleLinear } from './chart-utils';

void React;

export type PopulationDecadeSpineProps = {
  readonly rows: readonly NationalPopulationTimelineRow[];
  readonly sources: readonly { readonly label: string; readonly url: string }[];
  readonly reading?: ReactNode;
  readonly figureLabel?: string;
  readonly id?: string;
};

const WIDTH = 960;
const HEIGHT = 220;
const MARGIN = { top: 28, right: 24, bottom: 48, left: 48 } as const;
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

export function PopulationDecadeSpine({
  rows,
  sources,
  reading,
  figureLabel,
  id,
}: PopulationDecadeSpineProps) {
  if (rows.length < 2) return null;

  const shares = rows.map((row) =>
    row.totalPopulation > 0 ? (row.blackPopulation / row.totalPopulation) * 100 : 0,
  );
  const maxShare = niceMax(Math.max(...shares, 1));
  const xScale = scaleLinear(0, rows.length - 1, MARGIN.left, MARGIN.left + PLOT_W);
  const yScale = scaleLinear(0, maxShare, MARGIN.top + PLOT_H, MARGIN.top);
  const boundaryIndex = rows.findIndex((row) => row.opensDefinitionBoundary);

  const linePoints = rows
    .map((row, index) => `${xScale(index).toFixed(1)},${yScale(shares[index] ?? 0).toFixed(1)}`)
    .join(' ');

  const areaPoints = [
    `${xScale(0).toFixed(1)},${yScale(0).toFixed(1)}`,
    ...rows.map(
      (row, index) => `${xScale(index).toFixed(1)},${yScale(shares[index] ?? 0).toFixed(1)}`,
    ),
    `${xScale(rows.length - 1).toFixed(1)},${yScale(0).toFixed(1)}`,
  ].join(' ');

  const labelEvery = rows.length > 16 ? 3 : 2;

  return (
    <DataChartFrame
      title="Share of the nation, decade by decade"
      {...(reading !== undefined ? { reading } : {})}
      {...(figureLabel !== undefined ? { figureLabel } : {})}
      {...(id !== undefined ? { id } : {})}
      caption={
        'Black share of the U.S. total at each census. The dashed line marks the 2000 switch to ' +
        '“Black alone” when people could mark more than one race. This path is the time spine ' +
        'for the figures below.'
      }
      sources={sources}
      ariaLabel="Line chart of Black share of U.S. population by census decade"
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>Black share of U.S. population by decade</caption>
          <thead>
            <tr>
              <th scope="col">Decade</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.decade}>
                <th scope="row">{row.decade}</th>
                <td>{formatSharePct(row.blackPopulation, row.totalPopulation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <svg
        className="ds-data-chart__svg ds-data-spine"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-hidden="true"
      >
        <polygon points={areaPoints} className="ds-data-spine__area" />
        <polyline points={linePoints} className="ds-data-spine__line" fill="none" />
        {boundaryIndex > 0 ? (
          <line
            x1={xScale(boundaryIndex - 0.5)}
            x2={xScale(boundaryIndex - 0.5)}
            y1={MARGIN.top}
            y2={MARGIN.top + PLOT_H}
            className="ds-data-spine__boundary"
          />
        ) : null}
        {rows.map((row, index) => {
          const cx = xScale(index);
          const cy = yScale(shares[index] ?? 0);
          return (
            <g key={row.decade}>
              <circle cx={cx} cy={cy} r={3.5} className="ds-data-spine__dot" />
              {index % labelEvery === 0 || index === rows.length - 1 ? (
                <text x={cx} y={HEIGHT - 14} textAnchor="middle" className="ds-data-spine__tick">
                  {row.decade}
                </text>
              ) : null}
            </g>
          );
        })}
        <text x={MARGIN.left} y={MARGIN.top - 8} className="ds-data-spine__axis">
          {maxShare.toFixed(0)}%
        </text>
      </svg>
    </DataChartFrame>
  );
}
