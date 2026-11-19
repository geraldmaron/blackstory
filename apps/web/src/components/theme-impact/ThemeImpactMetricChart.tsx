/**
 * Groups a packet's own cited observations by `metricId` into time series and
 * renders each series with >=2 periods as a small SVG line chart. Two series
 * sharing the same reference-period set (e.g. Black/white rates for one
 * indicator) are drawn on one shared chart, solid vs. dashed. No data is fetched
 * separately — the chart is built entirely from what the packet already cites,
 * so it never diverges from the provenance the reader sees below.
 *
 * Series are drawn in ink, labeled directly at the line end (no legend), and every
 * observation is marked with a dot: the data are benchmark years, and the line
 * between two dots is a reading aid, not data. The title above the plot states the
 * finding from the first and last observations.
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

/**
 * One name for the whole series. A row label often carries that row's own year or note
 * ("…, 1860 (last pre-war benchmark)"); those belong to the observation, not the series, so
 * they are stripped and the most common remainder wins.
 */
export function seriesLabel(
  rows: readonly Pick<ThemeImpactObservationView, 'label'>[],
  fallback: string,
): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = (row.label ?? '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/,?\s*\d{4}\s*$/, '')
      .trim();
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  let best = fallback;
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) [best, bestCount] = [label, count];
  }
  return best;
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

    series.push({ metricId, label: seriesLabel(rows, metricId), unit: rows[0]!.unit, points });
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
const HEIGHT = 180;
const PAD_LEFT = 34;
const PAD_RIGHT = 12;
const PAD_TOP = 26;
const PAD_BOTTOM = 22;

/** Round y ticks from zero: a 1, 2 or 5 step, so the axis reads 0, 20, 40, 60. */
export function niceTicks(max: number, target = 3): number[] {
  if (!(max > 0)) return [0];
  const raw = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((m) => m * magnitude >= raw) ?? 10) * magnitude;
  const ticks: number[] = [];
  for (let tick = 0; tick < max + step; tick += step) ticks.push(Number(tick.toPrecision(12)));
  return ticks;
}

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
  const minValue = 0;
  const yTicks = niceTicks(Math.max(...values));
  const maxValue = yTicks[yTicks.length - 1]!;

  const xScale = (year: number) =>
    maxYear === minYear
      ? PAD_LEFT
      : PAD_LEFT + ((year - minYear) / (maxYear - minYear)) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const yScale = (value: number) =>
    HEIGHT -
    PAD_BOTTOM -
    ((value - minValue) / (maxValue - minValue || 1)) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

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

  const lead = group.series[0]!;
  const leadFirst = lead.points[0]!;
  const leadLast = lead.points[lead.points.length - 1]!;
  const finding = `From ${formatTick(leadFirst.estimate, lead.unit)} in ${leadFirst.year} to ${formatTick(leadLast.estimate, lead.unit)} in ${leadLast.year}`;

  return (
    <figure className="ds-theme-impact-chart">
      <p className="ds-theme-impact-chart__finding">{finding}</p>
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
          const variant = index === 0 ? 'a' : 'b';
          // Direct label at the line end: the first series above its last point, the second below.
          const labelY = yScale(last.estimate) + (index === 0 ? -9 : 14);
          return (
            <g key={s.metricId}>
              <path
                className={`ds-theme-impact-chart__line ds-theme-impact-chart__line--${variant}`}
                d={path}
              />
              {s.points.map((p) => (
                <circle
                  key={p.year}
                  className={`ds-theme-impact-chart__dot ds-theme-impact-chart__dot--${variant}`}
                  cx={xScale(p.year)}
                  cy={yScale(p.estimate)}
                  r={2.5}
                />
              ))}
              <text
                className="ds-theme-impact-chart__label"
                x={xScale(last.year)}
                y={Math.max(PAD_TOP - 4, labelY)}
              >
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
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
