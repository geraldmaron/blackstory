/**
 * Grouped-series metric block: period rows with labeled values (accessible stand-in
 * for web's grouped bar charts — numbers always visible as text).
 */
import { StyleSheet, View } from 'react-native';
import { LedgerRow, Link, LiftedSurface, Text, space } from '@/ui';
import { formatDataValue } from './format';
import type { DataGroupedBarSeries } from './types';

export type GroupedSeriesMetricProps = {
  readonly series: DataGroupedBarSeries;
};

export function GroupedSeriesMetric({ series }: GroupedSeriesMetricProps) {
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
        {series.points.map((point, index) => {
          const summary = series.series
            .map((def) => {
              const raw = point.values[def.id];
              if (typeof raw !== 'number') return null;
              return `${def.label}: ${formatDataValue(raw, series.unit)}`;
            })
            .filter((part): part is string => part !== null)
            .join(' · ');

          return (
            <LedgerRow
              key={point.period}
              title={point.period}
              summary={summary}
              showDivider={index < series.points.length - 1}
              showChevron={false}
            />
          );
        })}
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
