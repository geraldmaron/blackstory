/**
 * Compact proportional bar row for Explore metrics. Flat matte fill only —
 * no gradients, glow, or heat color. Width is static (reduce-motion safe);
 * full counts live in accessibilityLabel.
 */
import { StyleSheet, View } from 'react-native';
import { Text, radius, space, useThemeColors } from '@/ui';

export type MetricBarRowProps = {
  readonly label: string;
  readonly count: number;
  readonly maxCount: number;
  readonly testID?: string;
};

export function MetricBarRow({ label, count, maxCount, testID }: MetricBarRowProps) {
  const theme = useThemeColors();
  const ratio = maxCount > 0 ? Math.max(0, Math.min(1, count / maxCount)) : 0;
  const accessibilityLabel = `${label}: ${count === 1 ? '1 record' : `${count} records`}`;

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
          {String(count)}
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
              backgroundColor: theme.accent,
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
