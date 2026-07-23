/**
 * Race-pair metric block: two values + optional ratio, values rendered as
 * right-aligned mono in the trailing slot (not the muted summary), sources as
 * links with a full touch target. Accessible text juxtaposition — no color-only
 * encoding.
 */
import { StyleSheet, View } from 'react-native';
import { LedgerRow, Link, MIN_TOUCH_TARGET, Text, space } from '@/ui';
import { formatDataValue } from './format';
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
      <View>
        <LedgerRow
          title={series.primary.label}
          trailing={
            <Text variant="code" style={styles.value}>
              {formatDataValue(series.primary.value, series.primary.unit)}
            </Text>
          }
          showDivider
          showChevron={false}
        />
        <LedgerRow
          title={series.comparison.label}
          trailing={
            <Text variant="code" style={styles.value}>
              {formatDataValue(series.comparison.value, series.comparison.unit)}
            </Text>
          }
          showDivider={hasRatio}
          showChevron={false}
        />
        {hasRatio ? (
          <LedgerRow
            title={series.ratioLabel as string}
            trailing={
              <Text variant="code" style={styles.value}>
                {String(series.ratioValue)}
              </Text>
            }
            showDivider={false}
            showChevron={false}
          />
        ) : null}
      </View>
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
  value: {
    textAlign: 'right',
  },
  sources: {
    gap: space['2'],
  },
  sourceItem: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
});
