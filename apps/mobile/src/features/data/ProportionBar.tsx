/**
 * Flat matte proportion bar for race-pair juxtaposition. Primary series uses
 * copper graphic; comparison uses rule fill. Values stay in accessible text;
 * color is never the only signal.
 */
import { StyleSheet, View } from 'react-native';
import { Text, space, useThemeColors } from '@/ui';
import { formatDataValue } from './format';
import type { DataValueUnit } from './types';

export type ProportionBarRow = {
  readonly label: string;
  readonly value: number;
  readonly unit: DataValueUnit;
  /** Copper fill for the primary (navigational) series only. */
  readonly accent?: boolean;
};

export type ProportionBarProps = {
  readonly rows: readonly ProportionBarRow[];
  /** Optional accessibility name for the chart group. */
  readonly accessibilityLabel?: string;
};

export function ProportionBar({ rows, accessibilityLabel }: ProportionBarProps) {
  const theme = useThemeColors();
  const maxValue = Math.max(0, ...rows.map((row) => row.value));
  if (maxValue <= 0 || rows.length === 0) {
    return null;
  }

  return (
    <View
      style={styles.block}
      accessibilityRole="summary"
      accessibilityLabel={
        accessibilityLabel ??
        rows.map((row) => `${row.label}: ${formatDataValue(row.value, row.unit)}`).join('. ')
      }
    >
      {rows.map((row) => {
        const widthPct = Math.max(4, (row.value / maxValue) * 100);
        return (
          <View key={row.label} style={styles.row}>
            <View style={styles.labelRow}>
              <Text variant="caption" colorRole="ink" style={styles.label} numberOfLines={1}>
                {row.label}
              </Text>
              <Text variant="code" style={styles.value}>
                {formatDataValue(row.value, row.unit)}
              </Text>
            </View>
            <View
              style={[styles.track, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <View
                style={[
                  styles.fill,
                  {
                    width: `${widthPct}%`,
                    backgroundColor: row.accent ? theme.accentGraphic : theme.border,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space['2'],
  },
  row: {
    gap: space['1'],
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space['2'],
  },
  label: {
    flexShrink: 1,
  },
  value: {
    textAlign: 'right',
  },
  track: {
    height: 8,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
