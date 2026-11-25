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

function isMeasured(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function SparklineStrip({ series }: SparklineStripProps) {
  const theme = useThemeColors();
  const primaryId = series.series[0]?.id;
  const comparisonId = series.series[1]?.id;
  if (!primaryId || !comparisonId || series.points.length === 0) {
    return null;
  }

  const maxValue = Math.max(
    1,
    ...series.points.flatMap((point) =>
      [point.values[primaryId], point.values[comparisonId]].filter(isMeasured),
    ),
  );
  const primaryLabel = series.series[0]?.label ?? 'Primary';
  const comparisonLabel = series.series[1]?.label ?? 'Comparison';

  return (
    <View style={styles.block}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: theme.accentGraphic }]} />
          <Text variant="caption" colorRole="inkMuted">
            {primaryLabel}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: theme.borderControl }]} />
          <Text variant="caption" colorRole="inkMuted">
            {comparisonLabel}
          </Text>
        </View>
      </View>
      <View style={styles.rail}>
        {series.points.map((point) => {
          // A missing value stays missing: no bar, and "not available" in words. Drawing it as a
          // short bar would present an unmeasured period as a measured zero.
          const primary = point.values[primaryId];
          const comparison = point.values[comparisonId];
          const say = (value: number | undefined) =>
            isMeasured(value) ? formatDataValue(value, series.unit) : 'not available';
          const barHeight = (value: number | undefined) =>
            isMeasured(value) ? Math.max(4, (value / maxValue) * 48) : 0;
          return (
            // The bars are hidden from assistive tech, so each period speaks both values.
            <View
              key={point.period}
              style={styles.period}
              accessible
              accessibilityLabel={`${point.period}: ${primaryLabel} ${say(primary)}, ${comparisonLabel} ${say(comparison)}`}
            >
              <View
                style={styles.bars}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View
                  style={[
                    styles.bar,
                    { height: barHeight(primary), backgroundColor: theme.accentGraphic },
                  ]}
                />
                <View
                  style={[
                    styles.bar,
                    { height: barHeight(comparison), backgroundColor: theme.borderControl },
                  ]}
                />
              </View>
              <Text variant="meta" colorRole="inkMuted" style={styles.periodLabel}>
                {point.period}
              </Text>
              <Text
                variant="caption"
                style={styles.periodValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {isMeasured(primary) ? formatDataValue(primary, series.unit) : 'n/a'}
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
  },
  periodLabel: {
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  periodValue: {
    textAlign: 'center',
  },
});
