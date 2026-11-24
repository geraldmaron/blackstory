/**
 * A two-group comparison at one point in time, as a figure: bars in Plain, the two values and
 * their ratio in Numbers.
 */
import { DataFigure } from './DataFigure';
import { formatDataValue } from './format';
import { ProportionBar } from './ProportionBar';
import type { DataRacePairSeries } from './types';

export type RacePairMetricProps = {
  readonly series: DataRacePairSeries;
};

export function RacePairMetric({ series }: RacePairMetricProps) {
  const pair = [series.primary, series.comparison];
  return (
    <DataFigure
      title={series.title}
      scope={`${series.geographyLabel} · ${series.referencePeriod}`}
      limits={series.caption}
      sources={series.sources}
      plain={
        <ProportionBar
          accessibilityLabel={`${series.title} for ${series.geographyLabel}`}
          rows={pair.map((point, index) => ({ ...point, accent: index === 0 }))}
        />
      }
      numbers={[
        ...pair.map((point) => ({
          key: point.label,
          label: point.label,
          value: formatDataValue(point.value, point.unit),
        })),
        ...(series.ratioLabel && series.ratioValue !== undefined
          ? [{ key: 'ratio', label: series.ratioLabel, value: String(series.ratioValue) }]
          : []),
      ]}
    />
  );
}
