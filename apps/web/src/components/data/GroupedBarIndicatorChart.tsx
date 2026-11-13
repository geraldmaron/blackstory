/**
 * Grouped columns across periods: homeownership, mortgage denial rates, sentences, net worth. The
 * Black series is ink and the comparison a lighter neutral; the series are named at the right edge
 * beside the latest pair, and every period's values are in its tooltip and the table.
 */
import React, { type ReactNode } from 'react';
import type { DataPageGroupedBarSeries } from '@repo/domain/statistics/data-page-series';
import { DataChartFrame } from './DataChartFrame';
import {
  Bar,
  EndLabels,
  Mark,
  Plot,
  Tip,
  bandLayout,
  categoryTicks,
  valueScale,
} from './chart-kit';
import { chapterHrefForTheme, formatDataPageValue } from './chart-utils';
import { axisValue, seriesSubtitle, seriesTone } from './series-format';

void React;

export type GroupedBarIndicatorChartProps = {
  readonly series: DataPageGroupedBarSeries;
  readonly reading?: ReactNode;
  readonly span?: 'wide' | 'half';
  readonly id?: string;
};

export function GroupedBarIndicatorChart({
  series,
  reading,
  span,
  id,
}: GroupedBarIndicatorChartProps) {
  if (series.points.length === 0 || series.series.length === 0) return null;

  const { top, ticks } = valueScale(
    Math.max(
      ...series.points.flatMap((point) => series.series.map((def) => point.values[def.id] ?? 0)),
    ),
    (value) => axisValue(value, series.unit),
  );
  const y = (value: number) => (value / top) * 100;
  const { center, width } = bandLayout(series.points.length);
  const count = series.series.length;
  // Bars share their band: each gets an equal slice, with a 2px-ish gap between them.
  const thickness = Math.min(30, 72 / count);
  const shift = (index: number) => (index - (count - 1) / 2) * (thickness + 4);
  const chapterHref = chapterHrefForTheme(series.themeId);
  const last = series.points.at(-1)!;

  return (
    <DataChartFrame
      title={seriesSubtitle(series)}
      {...(reading !== undefined ? { reading } : {})}
      {...(span !== undefined ? { span } : {})}
      {...(id !== undefined ? { id } : {})}
      {...(chapterHref ? { chapterHref } : {})}
      caption={series.caption}
      sources={series.sources}
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>{series.title}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              {series.series.map((def) => (
                <th scope="col" key={def.id}>
                  {def.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.points.map((point) => (
              <tr key={point.period}>
                <th scope="row">{point.period}</th>
                {series.series.map((def) => {
                  const value = point.values[def.id];
                  return (
                    <td key={def.id}>
                      {value === undefined ? 'N/A' : formatDataPageValue(value, series.unit)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <Plot
        label={series.title}
        unit={series.yAxisLabel}
        size={span === 'half' ? 'md' : 'lg'}
        yWidth="3rem"
        endWidth={span === 'half' ? 'min(5.5rem, 26cqi)' : 'min(9rem, 28cqi)'}
        yTicks={ticks}
        xTicks={categoryTicks(
          series.points.map((point) => point.period),
          center,
          series.points.length > 8 ? 2 : 1,
        )}
      >
        {series.points.map((point, index) => {
          const present = series.series.filter((def) => point.values[def.id] !== undefined);
          const highest = Math.max(0, ...present.map((def) => point.values[def.id]!));
          return (
            <Mark
              key={point.period}
              x={center(index)}
              width={width}
              first={index === 0}
              tipY={y(highest)}
              ariaLabel={`${point.period}: ${present
                .map(
                  (def) =>
                    `${def.label} ${formatDataPageValue(point.values[def.id]!, series.unit)}`,
                )
                .join(', ')}`}
              tip={
                <Tip
                  title={point.period}
                  rows={present.map((def) => ({
                    value: formatDataPageValue(point.values[def.id]!, series.unit),
                    label: def.label,
                    tone: seriesTone(series, def.id),
                  }))}
                />
              }
            >
              {series.series.map((def, seriesIndex) => {
                const value = point.values[def.id];
                return value === undefined ? null : (
                  <Bar
                    key={def.id}
                    height={y(value)}
                    tone={seriesTone(series, def.id)}
                    thickness={thickness}
                    shift={shift(seriesIndex)}
                  />
                );
              })}
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
                    name: def.label,
                    value: formatDataPageValue(value, series.unit),
                    tone: seriesTone(series, def.id),
                  },
                ];
          })}
        />
      </Plot>
    </DataChartFrame>
  );
}
