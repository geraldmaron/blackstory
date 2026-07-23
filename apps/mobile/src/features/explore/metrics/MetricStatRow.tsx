/**
 * Compact presence / coverage stat for the Explore metrics header strip.
 * Count + short label with a full accessibility text alternative.
 */
import { StyleSheet, View } from 'react-native';
import { Text, space, useThemeColors } from '@/ui';

export type MetricStatRowProps = {
  readonly value: string;
  readonly label: string;
  readonly accessibilityLabel: string;
  /** When false, omits the trailing hairline (last cell in a strip). */
  readonly showEdge?: boolean;
  readonly testID?: string;
};

export function MetricStatRow({
  value,
  label,
  accessibilityLabel,
  showEdge = true,
  testID,
}: MetricStatRowProps) {
  const theme = useThemeColors();

  return (
    <View
      style={[
        styles.stat,
        { borderColor: theme.border, borderRightWidth: showEdge ? StyleSheet.hairlineWidth : 0 },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Text variant="subtitle" colorRole="ink">
        {value}
      </Text>
      <Text variant="code" colorRole="inkMuted" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: {
    flex: 1,
    minWidth: 72,
    gap: 2,
    paddingVertical: space['2'],
    paddingHorizontal: space['2'],
  },
});
