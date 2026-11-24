/**
 * Long-arc lines: a benchmark-year ratio back to 1860, a rate measured every year for two decades.
 *
 * When every period is a year, points sit at their true distance in time, so a twenty-year jump
 * between benchmarks is not drawn as one step. A missing value breaks the line and its span is
 * hatched and labeled "Not published"; so is a skipped year inside an annual run. Series are named
 * at the right edge, level with their latest value.
 */
import React from 'react';
import type { DataPageGroupedBarSeries } from '@repo/domain/statistics/data-page-series';
import {
  Band,
  Dot,
  EndLabels,
  Lines,
  Mark,
  Plot,
  Tip,
  valueScale,
  type AxisTick,
} from './chart-kit';
import { formatDataPageValue } from './chart-utils';
import { axisValue, seriesTone } from './series-format';

void React;

export type TrendLineChartProps = {
  readonly series: DataPageGroupedBarSeries;
  /** `md` is the shorter plot. */
  readonly size?: 'md' | 'lg';
};

/** Year positions when every period is a plain year, else evenly spaced indexes. */
export function trendPositions(periods: readonly string[]): {
  readonly x: readonly number[];
  readonly years: readonly number[] | null;
} {
  const years = periods.every((period) => /^\d{4}$/.test(period)) ? periods.map(Number) : null;
  if (years && years.length > 1) {
    const first = years[0]!;
    const span = years.at(-1)! - first || 1;
    return { x: years.map((year) => ((year - first) / span) * 100), years };
  }
  const step = 100 / Math.max(1, periods.length - 1);
  return { x: periods.map((_, index) => index * step), years: null };
}

/**
 * Skipped years inside an annual run: a jump of two or three years between points whose
 * neighbors are one year apart. A long gap between benchmark years is a sampling plan, not a
 * missing release, and is not marked.
 */
export function skippedYears(
  years: readonly number[],
): readonly { readonly after: number; readonly before: number }[] {
  const out: { after: number; before: number }[] = [];
  for (let index = 1; index < years.length; index += 1) {
    const jump = years[index]! - years[index - 1]!;
    if (jump < 2 || jump > 3) continue;
    const annualBefore = index >= 2 && years[index - 1]! - years[index - 2]! === 1;
    const annualAfter = index + 1 < years.length && years[index + 1]! - years[index]! === 1;
    if (annualBefore || annualAfter) out.push({ after: index - 1, before: index });
  }
  return out;
}

export function TrendLineChart({ series, size = 'lg' }: TrendLineChartProps) {
  if (series.points.length === 0 || series.series.length === 0) return null;

  const periods = series.points.map((point) => point.period);
  const { x, years } = trendPositions(periods);
  const values = series.points.flatMap((point) =>
    series.series
      .map((def) => point.values[def.id])
      .filter((value): value is number => value !== undefined),
  );
  const { top, ticks } = valueScale(Math.max(0, ...values), (value) =>
    axisValue(value, series.unit),
  );
  const y = (value: number) => (value / top) * 100;

  // Hit bands reach halfway to each neighbor.
  const edges = x.map((value, index) => {
    const left = index === 0 ? value : (value + x[index - 1]!) / 2;
    const right = index === x.length - 1 ? value : (value + x[index + 1]!) / 2;
    return { center: (left + right) / 2, width: Math.max(1.5, right - left) };
  });

  // About eight labels across, always the first and last, never two crowding the end.
  const labelGap = years ? (years.at(-1)! - years[0]!) / 7 : periods.length / 7;
  const xTicks: AxisTick[] = [];
  periods.forEach((period, index) => {
    const at = years ? years[index]! : index;
    const lastAt = xTicks.length > 0 ? (years ? Number(xTicks.at(-1)!.label) : 0) : -Infinity;
    const isLast = index === periods.length - 1;
    if (isLast || (years ? at - lastAt >= labelGap : index % Math.ceil(labelGap) === 0)) {
      const end = years ? years.at(-1)! : periods.length - 1;
      if (!isLast && end - at < labelGap / 2) return;
      xTicks.push({ at: x[index]!, label: period, minor: xTicks.length % 2 === 1 && !isLast });
    }
  });

  const gaps: { from: number; to: number }[] = [];
  for (const def of series.series) {
    series.points.forEach((point, index) => {
      if (point.values[def.id] !== undefined) return;
      gaps.push({
        from: edges[index]!.center - edges[index]!.width / 2,
        to: edges[index]!.center + edges[index]!.width / 2,
      });
    });
  }
  if (years) {
    for (const { after, before } of skippedYears(years)) {
      gaps.push({ from: x[after]!, to: x[before]! });
    }
  }

  const last = series.points.at(-1)!;

  return (
    <Plot
      label={series.title}
      unit={series.yAxisLabel}
      size={size}
      yWidth="3rem"
      endWidth={series.series.length > 1 ? 'min(9rem, 28cqi)' : '3.5rem'}
      yTicks={ticks}
      xTicks={xTicks}
    >
      {gaps.map((gap) => (
        <Band
          key={`${gap.from}-${gap.to}`}
          from={gap.from}
          to={gap.to}
          kind="gap"
          label="Not published"
        />
      ))}
      <Lines
        series={series.series.map((def) => ({
          id: def.id,
          tone: seriesTone(series, def.id),
          points: series.points.flatMap((point, index) => {
            const value = point.values[def.id];
            const here = value === undefined ? null : { x: x[index]!, y: y(value) };
            const skipped =
              years && index > 0 && skippedYears(years).some((gap) => gap.before === index);
            return skipped ? [null, here] : [here];
          }),
        }))}
      />
      {series.points.map((point, index) => {
        const present = series.series.filter((def) => point.values[def.id] !== undefined);
        const highest = Math.max(0, ...present.map((def) => point.values[def.id]!));
        return (
          <Mark
            key={point.period}
            x={edges[index]!.center}
            width={edges[index]!.width}
            first={index === 0}
            crosshair
            tipY={y(highest)}
            ariaLabel={`${point.period}: ${
              present.length === 0
                ? 'not published'
                : present
                    .map(
                      (def) =>
                        `${def.label} ${formatDataPageValue(point.values[def.id]!, series.unit)}`,
                    )
                    .join(', ')
            }`}
            tip={
              <Tip
                title={point.period}
                rows={series.series.map((def) => {
                  const value = point.values[def.id];
                  return {
                    value:
                      value === undefined
                        ? 'Not published'
                        : formatDataPageValue(value, series.unit),
                    label: def.label,
                    tone: seriesTone(series, def.id),
                  };
                })}
              />
            }
          >
            {(index === 0 || x[index]! - x[index - 1]! >= 2.5) &&
            (index === x.length - 1 || x[index + 1]! - x[index]! >= 2.5)
              ? present.map((def) => (
                  <Dot
                    key={def.id}
                    x={
                      ((x[index]! - (edges[index]!.center - edges[index]!.width / 2)) /
                        edges[index]!.width) *
                      100
                    }
                    y={y(point.values[def.id]!)}
                    tone={seriesTone(series, def.id)}
                    size="sm"
                  />
                ))
              : null}
          </Mark>
        );
      })}
      <EndLabels
        items={series.series.flatMap((def) => {
          const value = last.values[def.id];
          return value === undefined
            ? []
            : [
                {
                  id: def.id,
                  y: y(value),
                  name: series.series.length > 1 ? def.label : '',
                  value: formatDataPageValue(value, series.unit),
                  tone: seriesTone(series, def.id),
                },
              ];
        })}
      />
    </Plot>
  );
}
