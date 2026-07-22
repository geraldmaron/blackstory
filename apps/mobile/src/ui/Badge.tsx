/**
 * Small status/confidence pill. Never relies on color alone: every badge
 * renders its non-color `cue` text (e.g. "Disputed", "High confidence") from
 * the generated tokens, matching the web design system's accessibility rule
 * that color is a reinforcement, not the only signal.
 */
import { StyleSheet, View, type ViewProps } from 'react-native';
import { Text } from './Text';
import {
  radius,
  space,
  useConfidenceColors,
  useStatusColors,
  type ConfidenceLevel,
  type StatusName,
} from './tokens';

export type BadgeProps = Omit<ViewProps, 'children'> & (
  | { kind: 'status'; status: StatusName }
  | { kind: 'confidence'; level: ConfidenceLevel }
);

export function Badge(props: BadgeProps) {
  const status = useStatusColors();
  const confidence = useConfidenceColors();
  const pair = props.kind === 'status' ? status[props.status] : confidence[props.level];

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={pair.cue}
      style={[
        styles.base,
        { backgroundColor: pair.bg, borderColor: pair.border },
      ]}
    >
      <Text variant="caption" style={{ color: pair.fg }}>
        {pair.cue}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space['3'],
    paddingVertical: space['1'],
  },
});
