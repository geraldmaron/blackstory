/**
 * Compact proportional bar row for Explore metrics. Flat matte fill only —
 * no gradients, glow, or heat color. Width is static (reduce-motion safe);
 * full counts and percents live in accessibilityLabel. Copper is reserved for
 * optional emphasis (e.g. leading bucket); default bars use muted ink.
 */
import { StyleSheet, View } from 'react-native';
import { Text, radius, space, useThemeColors } from '@/ui';

export type MetricBarRowProps = {
  readonly label: string;
  readonly count: number;
  readonly maxCount: number;
  /** Optional share of total (0–100) shown beside the count. */
  readonly percent?: number;
  /** When true, bar fill uses copper accent; otherwise matte inkMuted. */
  readonly emphasize?: boolean;
  readonly testID?: string;
};

export function MetricBarRow({
  label,
  count,
  maxCount,
  percent,
  emphasize = false,
  testID,
}: MetricBarRowProps) {
  const theme = useThemeColors();
  const ratio = maxCount > 0 ? Math.max(0, Math.min(1, count / maxCount)) : 0;
  const countPhrase = count === 1 ? '1 record' : `${count} records`;
  const accessibilityLabel =
    typeof percent === 'number'
      ? `${label}: ${countPhrase}, ${percent}%`
      : `${label}: ${countPhrase}`;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View style={styles.labelRow}>
        <Text variant="body" colorRole="ink" numberOfLines={1} style={styles.label}>
          {label}
        </Text>
        <Text variant="code" colorRole="inkMuted">
          {typeof percent === 'number' ? `${percent}% · ${count}` : String(count)}
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
              backgroundColor: emphasize ? theme.accent : theme.inkMuted,
              width: `${Math.round(ratio * 100)}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: space['1'],
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['2'],
    minHeight: 22,
  },
  label: {
    flex: 1,
  },
  track: {
    height: 8,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.sm,
  },
});
