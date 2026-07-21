/**
 * National Black population by census decade, 1790–2020 — server-rendered SVG.
 *
 * Consumes the materialized national-timeline snapshot rows. For 1790–1860 the bar is stacked
 * enslaved (base) + free (top) so the two sum to the Black total; from 1870 on the Black total
 * is a single bar. Series fills stay distinct: enslaved uses copper (`--ds-viz-2`), free uses
 * sand (`--ds-viz-4`), and post-1860 Black total uses ink (`--ds-viz-1`) so the enslaved color
 * never continues as if slavery persists after emancipation. A dashed rule marks the 2000
 * measurement-regime boundary ("Black alone", the multiple-race methodology) so the chart never
 * implies pre-2000 and post-2000 counts are perfectly comparable, and 1870 is flagged for the
 * documented Southern undercount. A screen-reader table carries every value, including the
 * free/enslaved split.
 */
import React from 'react';
import type { NationalPopulationTimelineRow } from '@repo/domain/statistics/public-data-summaries';
import { DataChartFrame } from './DataChartFrame';
import { formatChartCount, formatSharePct, niceMax, scaleLinear } from './chart-utils';

/** Copper — enslaved segment only (1790–1860). Must not be reused for post-1860 totals. */
const FILL_ENSLAVED = 'var(--ds-viz-2)';
/** Sand — free Black segment stacked on enslaved (1790–1860). */
const FILL_FREE = 'var(--ds-viz-4)';
/** Ink — Black population total from 1870 onward (no free/enslaved split in the source). */
const FILL_BLACK_TOTAL = 'var(--ds-viz-1)';

export type PopulationByDecadeChartProps = {
  readonly rows: readonly NationalPopulationTimelineRow[];
  readonly sources: readonly { readonly label: string; readonly url: string }[];
};

// Wider than the shared 640 so 24 decades breathe; scales responsively via viewBox.
const WIDTH = 960;
const HEIGHT = 320;
const MARGIN = { top: 24, right: 20, bottom: 64, left: 84 } as const;
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

export function PopulationByDecadeChart({ rows, sources }: PopulationByDecadeChartProps) {
  if (rows.length === 0) {
    return null;
  }

  const maxBlack = niceMax(Math.max(...rows.map((row) => row.blackPopulation)));
  const xScale = scaleLinear(0, rows.length, MARGIN.left, MARGIN.left + PLOT_W);
  const yScale = scaleLinear(0, maxBlack, MARGIN.top + PLOT_H, MARGIN.top);
  const groupWidth = PLOT_W / rows.length;
  const barWidth = groupWidth * 0.62;
  const yTicks = [0, maxBlack / 4, maxBlack / 2, (maxBlack * 3) / 4, maxBlack];
  const zeroY = yScale(0);

  // Boundary marker sits between the last pre-2000 decade and 2000.
  const boundaryIndex = rows.findIndex((row) => row.opensDefinitionBoundary);

  return (
    <DataChartFrame
      title="Black population by decade, 1790–2020"
      caption={
        'Enslaved and free counts are stacked for 1790–1860 (they add up to the Black total). ' +
        'From 1870 the Black total is a single bar. The dashed line marks the 2000 switch to ' +
        '“Black alone” when people could mark more than one race — counts before and after are ' +
        'not a perfect match. ‡ 1870 is a known Southern undercount.'
      }
      sources={sources}
      ariaLabel="Bar chart of Black population by census decade, 1790 to 2020"
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>Black population by decade, 1790–2020</caption>
          <thead>
            <tr>
              <th scope="col">Decade</th>
              <th scope="col">Black population</th>
              <th scope="col">Free</th>
              <th scope="col">Enslaved</th>
              <th scope="col">Total population</th>
              <th scope="col">Share</th>
              <th scope="col">Category</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.decade}>
                <th scope="row">
                  {row.decade}
                  {row.southernUndercountCaveat ? ' ‡' : ''}
                </th>
                <td>{formatChartCount(row.blackPopulation)}</td>
                <td>
                  {row.freeBlackPopulation === null
                    ? '—'
                    : formatChartCount(row.freeBlackPopulation)}
                </td>
                <td>
                  {row.enslavedBlackPopulation === null
                    ? '—'
                    : formatChartCount(row.enslavedBlackPopulation)}
                </td>
                <td>{formatChartCount(row.totalPopulation)}</td>
                <td>{formatSharePct(row.blackPopulation, row.totalPopulation)}</td>
                <td>{row.raceCategoryLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <svg
        className="ds-data-chart__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-hidden="true"
      >
        {yTicks.map((tick) => {
          const y = yScale(tick);
          return (
            <g key={tick}>
              <line
                className="ds-data-chart__grid-line"
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y}
                y2={y}
              />
              <text
                className="ds-data-chart__axis-label"
                x={MARGIN.left - 8}
                y={y + 4}
                textAnchor="end"
              >
                {formatChartCount(Math.round(tick))}
              </text>
            </g>
          );
        })}

        {boundaryIndex > 0
          ? (() => {
              const x = xScale(boundaryIndex);
              return (
                <g>
                  <line
                    x1={x}
                    x2={x}
                    y1={MARGIN.top}
                    y2={zeroY}
                    stroke="var(--ds-text-muted, #888)"
                    strokeDasharray="4 4"
                  />
                  <text
                    className="ds-data-chart__axis-label"
                    x={x + 4}
                    y={MARGIN.top + 10}
                    textAnchor="start"
                  >
                    2000: “Black alone”
                  </text>
                </g>
              );
            })()
          : null}

        {rows.map((row, index) => {
          const centerX = xScale(index + 0.5);
          const barX = centerX - barWidth / 2;
          const blackTop = yScale(row.blackPopulation);
          const showLabel = index % 2 === 0 || index === rows.length - 1;

          // Split decades: enslaved base + free on top; else a single ink Black-total bar.
          const segments =
            row.enslavedBlackPopulation !== null && row.freeBlackPopulation !== null
              ? [
                  {
                    key: 'enslaved',
                    from: 0,
                    to: row.enslavedBlackPopulation,
                    fill: FILL_ENSLAVED,
                  },
                  {
                    key: 'free',
                    from: row.enslavedBlackPopulation,
                    to: row.blackPopulation,
                    fill: FILL_FREE,
                  },
                ]
              : [
                  {
                    key: 'black',
                    from: 0,
                    to: row.blackPopulation,
                    fill: FILL_BLACK_TOTAL,
                  },
                ];

          return (
            <g key={row.decade}>
              {segments.map((segment) => {
                const top = yScale(segment.to);
                const bottom = yScale(segment.from);
                return (
                  <rect
                    key={segment.key}
                    x={barX}
                    y={top}
                    width={barWidth}
                    height={Math.max(0, bottom - top)}
                    fill={segment.fill}
                  />
                );
              })}
              {showLabel ? (
                <text
                  className="ds-data-chart__axis-label"
                  x={centerX}
                  y={HEIGHT - MARGIN.bottom + 18}
                  textAnchor="middle"
                >
                  {row.decade}
                  {row.southernUndercountCaveat ? '‡' : ''}
                </text>
              ) : null}
              {index === rows.length - 1 ? (
                <text
                  className="ds-data-chart__axis-label"
                  x={centerX}
                  y={blackTop - 6}
                  textAnchor="middle"
                >
                  {formatSharePct(row.blackPopulation, row.totalPopulation)}
                </text>
              ) : null}
            </g>
          );
        })}

        <text
          className="ds-data-chart__axis-label"
          x={14}
          y={MARGIN.top + PLOT_H / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${MARGIN.top + PLOT_H / 2})`}
        >
          Black population
        </text>
      </svg>
      <ul className="ds-data-chart__legend" aria-hidden="true">
        <li className="ds-data-chart__legend-item">
          <span className="ds-data-chart__legend-swatch" style={{ background: FILL_ENSLAVED }} />
          Enslaved (1790–1860)
        </li>
        <li className="ds-data-chart__legend-item">
          <span className="ds-data-chart__legend-swatch" style={{ background: FILL_FREE }} />
          Free (1790–1860)
        </li>
        <li className="ds-data-chart__legend-item">
          <span className="ds-data-chart__legend-swatch" style={{ background: FILL_BLACK_TOTAL }} />
          Black population (1870–2020)
        </li>
      </ul>
    </DataChartFrame>
  );
}
