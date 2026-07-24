/**
 * Compact period sparkline for grouped series — dual flat matte columns per
 * period (primary copper graphic, comparison rule). Paired with text rows so
 * values remain readable without color alone.
 */
import { StyleSheet, View } from 'react-native';
import { Text, space, useThemeColors } from '@/ui';
import { formatDataValue } from './format';
import type { DataGroupedBarSeries } from './types';

export type SparklineStripProps = {
  readonly series: DataGroupedBarSeries;
};

export function SparklineStrip({ series }: SparklineStripProps) {
  const theme = useThemeColors();
  const primaryId = series.series[0]?.id;
  const comparisonId = series.series[1]?.id;
  if (!primaryId || !comparisonId || series.points.length === 0) {
    return null;
  }

  const allValues = series.points.flatMap((point) => {
    const a = point.values[primaryId];
    const b = point.values[comparisonId];
    return [typeof a === 'number' ? a : 0, typeof b === 'number' ? b : 0];
  });
  const maxValue = Math.max(1, ...allValues);
  const primaryLabel = series.series[0]?.label ?? 'Primary';
  const comparisonLabel = series.series[1]?.label ?? 'Comparison';

  return (
    <View
      style={styles.block}
      accessibilityRole="summary"
      accessibilityLabel={`${series.title} sparkline across ${series.points.length} periods`}
    >
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: theme.accentGraphic }]} />
          <Text variant="caption" colorRole="inkMuted">
            {primaryLabel}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: theme.border }]} />
          <Text variant="caption" colorRole="inkMuted">
            {comparisonLabel}
          </Text>
        </View>
      </View>
      <View style={styles.rail}>
        {series.points.map((point) => {
          const primary = point.values[primaryId] ?? 0;
          const comparison = point.values[comparisonId] ?? 0;
          const primaryH = Math.max(4, (primary / maxValue) * 48);
          const comparisonH = Math.max(4, (comparison / maxValue) * 48);
          return (
            <View key={point.period} style={styles.period}>
              <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View
                  style={[
                    styles.bar,
                    { height: primaryH, backgroundColor: theme.accentGraphic },
                  ]}
                />
                <View
                  style={[styles.bar, { height: comparisonH, backgroundColor: theme.border }]}
                />
              </View>
              <Text variant="sectionLabel" colorRole="inkMuted" style={styles.periodLabel}>
                {point.period}
              </Text>
              <Text variant="code" style={styles.periodValue} numberOfLines={1}>
                {formatDataValue(primary, series.unit)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space['2'],
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['3'],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  rail: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space['2'],
    minHeight: 72,
  },
  period: {
    flex: 1,
    alignItems: 'center',
    gap: space['1'],
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 48,
  },
  bar: {
    width: 8,
    borderRadius: 1,
  },
  periodLabel: {
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  periodValue: {
    fontSize: 10,
    textAlign: 'center',
  },
});
