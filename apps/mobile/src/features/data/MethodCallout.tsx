/**
 * Compact modeling / method callout for Data — mono label + short body.
 * Used for juxtaposition rules and honest warehouse gaps.
 */
import { StyleSheet, View } from 'react-native';
import { Text, space, useThemeColors } from '@/ui';

export type MethodCalloutProps = {
  readonly label: string;
  readonly body: string;
};

export function MethodCallout({ label, body }: MethodCalloutProps) {
  const theme = useThemeColors();
  return (
    <View
      style={[styles.block, { borderColor: theme.border, backgroundColor: theme.surface }]}
      accessibilityRole="summary"
      accessibilityLabel={`${label}. ${body}`}
    >
      <View style={styles.head}>
        <View
          style={[styles.tick, { backgroundColor: theme.accentGraphic }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Text variant="sectionLabel" colorRole="accent" style={styles.label}>
          {label}
        </Text>
      </View>
      <Text variant="caption" colorRole="inkMuted">
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: space['2'],
    padding: space['3'],
    gap: space['1'],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  tick: {
    width: 3,
    height: 14,
    borderRadius: 1,
  },
  label: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
