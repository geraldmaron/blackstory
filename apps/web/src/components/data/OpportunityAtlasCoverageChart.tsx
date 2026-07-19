/**
 * Opportunity Atlas tract coverage — outcome-field counts and kfrBlackP25 distribution bins.
 * Counts tracts only; never averages percentile ranks nationally.
 */
import React from 'react';
import type { OpportunityAtlasCoverageSummary } from '@repo/firebase';
import { DataChartFrame } from './DataChartFrame';
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  CHART_WIDTH,
  formatChartCount,
  niceMax,
  plotHeight,
  plotWidth,
  scaleLinear,
} from './chart-utils';

void React;

export type OpportunityAtlasCoverageChartProps = {
  readonly coverage: OpportunityAtlasCoverageSummary;
};

export function OpportunityAtlasCoverageChart({ coverage }: OpportunityAtlasCoverageChartProps) {
  const fieldSeries = coverage.outcomeFieldCoverage.map((row, index) => ({
    key: row.field,
    label: row.label,
    value: row.tractCount,
    fill: index % 2 === 0 ? 'var(--ds-accent-graphic)' : 'var(--ds-accent-muted)',
  }));
  const histogram = coverage.kfrBlackP25Histogram;
  const maxFieldValue = niceMax(Math.max(...fieldSeries.map((row) => row.value), 1));
  const maxBinValue = niceMax(Math.max(...histogram.map((bin) => bin.tractCount), 1));

  const fieldGroupWidth = plotWidth() / Math.max(fieldSeries.length, 1);
  const fieldBarWidth = fieldGroupWidth * 0.7;
  const fieldXScale = scaleLinear(
    0,
    fieldSeries.length,
    CHART_MARGIN.left,
    CHART_MARGIN.left + plotWidth(),
  );
  const fieldYScale = scaleLinear(
    0,
    maxFieldValue,
    CHART_MARGIN.top + plotHeight(),
    CHART_MARGIN.top,
  );

  const binGroupWidth = plotWidth() / Math.max(histogram.length, 1);
  const binBarWidth = binGroupWidth * 0.65;
  const binXScale = scaleLinear(
    0,
    histogram.length,
    CHART_MARGIN.left,
    CHART_MARGIN.left + plotWidth(),
  );
  const binYScale = scaleLinear(0, maxBinValue, CHART_MARGIN.top + plotHeight(), CHART_MARGIN.top);

  return (
    <div className="ds-data-opportunity-charts">
      <DataChartFrame
        title="Outcome field coverage"
        caption={`Tracts with a retained estimate for each Opportunity Atlas outcome field (2010 tract geography). Total tracts loaded: ${formatChartCount(coverage.tractCount)}.`}
        sourceLabel={coverage.source}
        sourceUrl={coverage.sourceUrl}
        ariaLabel="Opportunity Atlas outcome field coverage chart"
        textAlternative={
          <table className="ds-data-chart__table">
            <caption>Outcome field coverage</caption>
            <thead>
              <tr>
                <th scope="col">Outcome field</th>
                <th scope="col">Tracts with estimate</th>
              </tr>
            </thead>
            <tbody>
              {fieldSeries.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <td>{formatChartCount(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <svg
          className="ds-data-chart__svg"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-hidden="true"
        >
          {fieldSeries.map((row, index) => {
            const centerX = fieldXScale(index + 0.5);
            const barX = centerX - fieldBarWidth / 2;
            const barTop = fieldYScale(row.value);
            const barBottom = fieldYScale(0);
            return (
              <g key={row.key}>
                <rect
                  x={barX}
                  y={barTop}
                  width={fieldBarWidth}
                  height={barBottom - barTop}
                  fill={row.fill}
                />
                <text
                  className="ds-data-chart__axis-label"
                  x={centerX}
                  y={barTop - 8}
                  textAnchor="middle"
                >
                  {formatChartCount(row.value)}
                </text>
                <text
                  className="ds-data-chart__axis-label ds-data-chart__axis-label--wrap"
                  x={centerX}
                  y={CHART_HEIGHT - CHART_MARGIN.bottom + 28}
                  textAnchor="middle"
                >
                  {row.label
                    .replace('Household income rank ', 'Income ')
                    .replace('Incarceration rate ', 'Jail ')}
                </text>
              </g>
            );
          })}
        </svg>
      </DataChartFrame>

      <DataChartFrame
        title="kfrBlackP25 tract distribution"
        caption="Histogram of retained household income ranks for Black children (parents at the 25th percentile). Bins count tracts — not people — on the Opportunity Atlas 0–100th percentile scale."
        sourceLabel={coverage.source}
        sourceUrl={coverage.sourceUrl}
        ariaLabel="Opportunity Atlas kfrBlackP25 histogram"
        textAlternative={
          <table className="ds-data-chart__table">
            <caption>kfrBlackP25 tract distribution</caption>
            <thead>
              <tr>
                <th scope="col">Percentile bin</th>
                <th scope="col">Tracts</th>
              </tr>
            </thead>
            <tbody>
              {histogram.map((bin) => (
                <tr key={bin.id}>
                  <th scope="row">{bin.label}</th>
                  <td>{formatChartCount(bin.tractCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <svg
          className="ds-data-chart__svg"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-hidden="true"
        >
          {histogram.map((bin, index) => {
            const centerX = binXScale(index + 0.5);
            const barX = centerX - binBarWidth / 2;
            const barTop = binYScale(bin.tractCount);
            const barBottom = binYScale(0);
            return (
              <g key={bin.id}>
                <rect
                  x={barX}
                  y={barTop}
                  width={binBarWidth}
                  height={barBottom - barTop}
                  fill="var(--ds-accent-graphic)"
                />
                <text
                  className="ds-data-chart__axis-label"
                  x={centerX}
                  y={barTop - 8}
                  textAnchor="middle"
                >
                  {formatChartCount(bin.tractCount)}
                </text>
                <text
                  className="ds-data-chart__axis-label"
                  x={centerX}
                  y={CHART_HEIGHT - CHART_MARGIN.bottom + 20}
                  textAnchor="middle"
                >
                  {bin.label}
                </text>
              </g>
            );
          })}
          <text
            className="ds-data-chart__axis-label"
            x={12}
            y={CHART_MARGIN.top + plotHeight() / 2}
            textAnchor="middle"
            transform={`rotate(-90 12 ${CHART_MARGIN.top + plotHeight() / 2})`}
          >
            Tracts
          </text>
        </svg>
      </DataChartFrame>
    </div>
  );
}
