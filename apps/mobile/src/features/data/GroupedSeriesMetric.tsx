/**
 * Two series across periods, as a figure: paired bars by period in Plain, every value in
 * Numbers. A period with no value for a series is left out of Numbers, never printed as zero.
 */
import { DataFigure } from './DataFigure';
import { formatDataValue } from './format';
import { SparklineStrip } from './SparklineStrip';
import type { DataGroupedBarSeries } from './types';

export type GroupedSeriesMetricProps = {
  readonly series: DataGroupedBarSeries;
};

export function GroupedSeriesMetric({ series }: GroupedSeriesMetricProps) {
  const numbers = series.points.flatMap((point) =>
    series.series.flatMap((def) => {
      const raw = point.values[def.id];
      return typeof raw === 'number'
        ? [
            {
              key: `${point.period}-${def.id}`,
              label: `${point.period} · ${def.label}`,
              value: formatDataValue(raw, series.unit),
            },
          ]
        : [];
    }),
  );
  const periods = series.points.map((point) => point.period);

  return (
    <DataFigure
      title={series.title}
      scope={[series.geographyLabel, periods[0], periods.length > 1 ? periods.at(-1) : undefined]
        .filter(Boolean)
        .join(' · ')}
      limits={series.caption}
      sources={series.sources}
      plain={<SparklineStrip series={series} />}
      numbers={numbers}
    />
  );
}
