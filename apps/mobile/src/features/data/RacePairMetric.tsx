/**
 * Race-pair metric block: proportion bars + mono values + sources.
 * Accessible text juxtaposition — copper marks the primary series only.
 */
import { StyleSheet, View } from 'react-native';
import { Link, MIN_TOUCH_TARGET, Text, space } from '@/ui';
import { ProportionBar } from './ProportionBar';
import type { DataRacePairSeries } from './types';

export type RacePairMetricProps = {
  readonly series: DataRacePairSeries;
};

export function RacePairMetric({ series }: RacePairMetricProps) {
  const hasRatio = Boolean(series.ratioLabel && series.ratioValue !== undefined);

  return (
    <View style={styles.block} accessibilityRole="summary">
      <Text variant="rowTitle" isHeading>
        {series.title}
      </Text>
      <Text variant="sectionLabel" colorRole="inkMuted" style={styles.meta}>
        {series.geographyLabel} · {series.referencePeriod}
      </Text>
      <Text variant="caption" colorRole="inkMuted">
        {series.caption}
      </Text>
      <ProportionBar
        accessibilityLabel={`${series.title} for ${series.geographyLabel}`}
        rows={[
          {
            label: series.primary.label,
            value: series.primary.value,
            unit: series.primary.unit,
            accent: true,
          },
          {
            label: series.comparison.label,
            value: series.comparison.value,
            unit: series.comparison.unit,
          },
        ]}
      />
      {hasRatio ? (
        <View style={styles.ratioRow}>
          <Text variant="caption" colorRole="inkMuted">
            {series.ratioLabel}
          </Text>
          <Text variant="code">{String(series.ratioValue)}</Text>
        </View>
      ) : null}
      <View style={styles.sources}>
        {series.sources.map((source) => (
          <View key={source.url} style={styles.sourceItem}>
            <Link href={source.url} textRole="code">
              {source.label}
            </Link>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space['2'],
  },
  meta: {
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  ratioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space['2'],
  },
  sources: {
    gap: space['2'],
  },
  sourceItem: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
});
