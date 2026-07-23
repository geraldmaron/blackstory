/**
 * Race-pair metric block: two values + optional ratio, sources as links.
 * Accessible text juxtaposition — no color-only encoding.
 */
import { StyleSheet, View } from 'react-native';
import { LedgerRow, Link, LiftedSurface, Text, space } from '@/ui';
import { formatDataValue } from './format';
import type { DataRacePairSeries } from './types';

export type RacePairMetricProps = {
  readonly series: DataRacePairSeries;
};

export function RacePairMetric({ series }: RacePairMetricProps) {
  return (
    <View style={styles.block} accessibilityRole="summary">
      <Text variant="bodyEmphasis" isHeading>
        {series.title}
      </Text>
      <Text variant="code" colorRole="inkMuted">
        {series.geographyLabel} · {series.referencePeriod}
      </Text>
      <Text variant="body" colorRole="inkMuted">
        {series.caption}
      </Text>
      <LiftedSurface tone="surface" shadow="none">
        <LedgerRow
          title={series.primary.label}
          summary={formatDataValue(series.primary.value, series.primary.unit)}
          showDivider
          showChevron={false}
        />
        <LedgerRow
          title={series.comparison.label}
          summary={formatDataValue(series.comparison.value, series.comparison.unit)}
          showDivider={Boolean(series.ratioLabel && series.ratioValue !== undefined)}
          showChevron={false}
        />
        {series.ratioLabel && series.ratioValue !== undefined ? (
          <LedgerRow
            title={series.ratioLabel}
            summary={String(series.ratioValue)}
            showDivider={false}
            showChevron={false}
          />
        ) : null}
      </LiftedSurface>
      <View style={styles.sources}>
        {series.sources.map((source) => (
          <Link key={source.url} href={source.url} textRole="code">
            {source.label}
          </Link>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space['2'],
  },
  sources: {
    gap: space['1'],
  },
});
