/**
 * Grouped-series metric block: one row per (period × group) with the value in the
 * trailing slot as right-aligned mono, so figures read as the primary element
 * rather than being buried in a muted, clip-prone summary string.
 */
import { StyleSheet, View } from 'react-native';
import { LedgerRow, Link, LiftedSurface, MIN_TOUCH_TARGET, Text, space } from '@/ui';
import { formatDataValue } from './format';
import type { DataGroupedBarSeries } from './types';

export type GroupedSeriesMetricProps = {
  readonly series: DataGroupedBarSeries;
};

export function GroupedSeriesMetric({ series }: GroupedSeriesMetricProps) {
  const rows = series.points.flatMap((point) =>
    series.series
      .map((def) => {
        const raw = point.values[def.id];
        if (typeof raw !== 'number') return null;
        return { key: `${point.period}-${def.id}`, period: point.period, label: def.label, raw };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
  );

  return (
    <View style={styles.block} accessibilityRole="summary">
      <Text variant="bodyEmphasis" isHeading>
        {series.title}
      </Text>
      <Text variant="code" colorRole="inkMuted">
        {series.geographyLabel}
      </Text>
      <Text variant="body" colorRole="inkMuted">
        {series.caption}
      </Text>
      <LiftedSurface tone="surface" shadow="none">
        {rows.map((row, index) => (
          <LedgerRow
            key={row.key}
            slug={row.label}
            title={row.period}
            trailing={
              <Text variant="code" style={styles.value}>
                {formatDataValue(row.raw, series.unit)}
              </Text>
            }
            showDivider={index < rows.length - 1}
            showChevron={false}
          />
        ))}
      </LiftedSurface>
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
