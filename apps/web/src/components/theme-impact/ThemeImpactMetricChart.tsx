/**
 * Groups a packet's own cited observations by `metricId` into time series and
 * renders each series with >=2 periods as a small SVG line chart. Two series
 * sharing the same reference-period set (e.g. Black/white rates for one
 * indicator) are drawn on one shared chart, styled solid vs. dashed. No data
 * is fetched separately — the chart is built entirely from what the packet
 * already cites, so it never diverges from the provenance the reader sees below.
 */
import React from 'react';
import type { ThemeImpactObservationView } from '@repo/domain';

void React;

export type ThemeImpactMetricChartProps = {
  readonly observations: readonly ThemeImpactObservationView[];
};

type SeriesPoint = { readonly period: string; readonly year: number; readonly estimate: number };

type Series = {
  readonly metricId: string;
  readonly label: string;
  readonly unit: string;
  readonly points: readonly SeriesPoint[];
};

type ChartGroup = {
  readonly key: string;
  readonly unit: string;
  readonly series: readonly Series[];
};

function parseYear(period: string): number | undefined {
  const match = /\d{4}/.exec(period);
  return match ? Number(match[0]) : undefined;
}

function buildSeries(observations: readonly ThemeImpactObservationView[]): Series[] {
  const byMetric = new Map<string, ThemeImpactObservationView[]>();
  for (const obs of observations) {
    if (!obs.metricId || !obs.referencePeriod) continue;
    const bucket = byMetric.get(obs.metricId) ?? [];
    bucket.push(obs);
    byMetric.set(obs.metricId, bucket);
  }

  const series: Series[] = [];
  for (const [metricId, rows] of byMetric) {
    const points = rows
      .map((row) => {
        const year = parseYear(row.referencePeriod ?? '');
        return year === undefined
          ? undefined
          : { period: row.referencePeriod!, year, estimate: row.estimate };
      })
      .filter((point): point is SeriesPoint => point !== undefined)
      .sort((a, b) => a.year - b.year);

    if (points.length < 2) continue;

    const label = (rows[0]!.label ?? metricId).replace(/,?\s*\d{4}\s*$/, '').trim();
    series.push({ metricId, label, unit: rows[0]!.unit, points });
  }
  return series;
}

/** Group same-unit series that share most of their period range onto one chart. */
function groupSeries(series: readonly Series[]): ChartGroup[] {
  const groups: ChartGroup[] = [];
  const used = new Set<string>();

  for (const s of series) {
    if (used.has(s.metricId)) continue;
    const partner = series.find(
      (other) =>
        !used.has(other.metricId) &&
        other.metricId !== s.metricId &&
        other.unit === s.unit &&
        Math.min(other.points.length, s.points.length) /
          Math.max(other.points.length, s.points.length) >=
          0.5,
    );
    const group = partner ? [s, partner] : [s];
    group.forEach((g) => used.add(g.metricId));
    groups.push({ key: group.map((g) => g.metricId).join('+'), unit: s.unit, series: group });
  }

  return groups;
}

const WIDTH = 480;
const HEIGHT = 160;
const PAD_LEFT = 34;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

function formatTick(estimate: number, unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized === 'percent' || normalized === 'pct' || normalized === '%') {
    return `${Math.round(estimate)}%`;
  }
  if (normalized === 'usd') {
    return `$${Math.round(estimate).toLocaleString('en-US')}`;
  }
  return Math.round(estimate).toLocaleString('en-US');
}

function ChartFigure({ group }: { readonly group: ChartGroup }) {
  const allPoints = group.series.flatMap((s) => s.points);
  const years = allPoints.map((p) => p.year);
  const values = allPoints.map((p) => p.estimate);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const minValue = Math.min(...values, 0);
  const maxValueRaw = Math.max(...values);
  const pad = (maxValueRaw - minValue || 1) * 0.1;
  const maxValue = maxValueRaw + pad;

  const xScale = (year: number) =>
    maxYear === minYear
      ? PAD_LEFT
      : PAD_LEFT + ((year - minYear) / (maxYear - minYear)) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const yScale = (value: number) =>
    HEIGHT -
    PAD_BOTTOM -
    ((value - minValue) / (maxValue - minValue || 1)) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  const yTicks = [minValue, (minValue + maxValue) / 2, maxValue];
  const xTicks =
    maxYear === minYear
      ? [minYear]
      : Array.from(new Set([minYear, Math.round((minYear + maxYear) / 2), maxYear]));

  const ariaLabel = group.series
    .map((s) => {
      const first = s.points[0]!;
      const last = s.points[s.points.length - 1]!;
      return `${s.label}: ${formatTick(first.estimate, s.unit)} in ${first.year} to ${formatTick(last.estimate, s.unit)} in ${last.year}`;
    })
    .join('; ');

  return (
    <figure className="ds-theme-impact-chart">
      <svg
        className="ds-theme-impact-chart__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              className="ds-theme-impact-chart__gridline"
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yScale(tick)}
              y2={yScale(tick)}
            />
            <text
              className="ds-theme-impact-chart__tick ds-theme-impact-chart__tick--y"
              x={PAD_LEFT - 6}
              y={yScale(tick)}
            >
              {formatTick(tick, group.unit)}
            </text>
          </g>
        ))}

        {xTicks.map((year) => (
          <text
            key={year}
            className="ds-theme-impact-chart__tick ds-theme-impact-chart__tick--x"
            x={xScale(year)}
            y={HEIGHT - 6}
          >
            {year}
          </text>
        ))}

        {group.series.map((s, index) => {
          const path = s.points
            .map(
              (p, i) =>
                `${i === 0 ? 'M' : 'L'}${xScale(p.year).toFixed(1)} ${yScale(p.estimate).toFixed(1)}`,
            )
            .join(' ');
          const last = s.points[s.points.length - 1]!;
          return (
            <g key={s.metricId}>
              <path
                className={`ds-theme-impact-chart__line ds-theme-impact-chart__line--${index === 0 ? 'a' : 'b'}`}
                d={path}
              />
              <circle
                className={`ds-theme-impact-chart__dot ds-theme-impact-chart__dot--${index === 0 ? 'a' : 'b'}`}
                cx={xScale(last.year)}
                cy={yScale(last.estimate)}
                r={2.5}
              />
            </g>
          );
        })}
      </svg>
      <figcaption className="ds-theme-impact-chart__legend">
        {group.series.map((s, index) => (
          <span
            key={s.metricId}
            className={`ds-theme-impact-chart__legend-item ds-theme-impact-chart__legend-item--${index === 0 ? 'a' : 'b'}`}
          >
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function ThemeImpactMetricChart({ observations }: ThemeImpactMetricChartProps) {
  const series = buildSeries(observations);
  if (series.length === 0) return null;
  const groups = groupSeries(series);

  return (
    <div className="ds-theme-impact-chart-group">
      {groups.map((group) => (
        <ChartFigure key={group.key} group={group} />
      ))}
    </div>
  );
}
