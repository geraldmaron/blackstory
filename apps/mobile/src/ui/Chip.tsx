/**
 * Filter chip. One selected style for every screen: ink fill plus a check glyph, so a selected
 * chip differs from its neighbors by shape and fill and not by hue alone.
 */
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { NavIcon, type NavIconName } from './NavIcon';
import { Text } from './Text';
import { MIN_TOUCH_TARGET, radius, space, useThemeColors } from './tokens';

export type ChipProps = {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  /** `radio` inside a radiogroup (reports `checked`); `button` otherwise (reports `selected`). */
  readonly role?: 'radio' | 'button';
  /** Defaults to `label`. */
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  /** Leading icon while unselected; the check takes its place when selected. */
  readonly iconName?: NavIconName;
  readonly numberOfLines?: number;
  /** Per-screen metrics (padding, gap). Colors and the touch-target floor stay the chip's. */
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
};

export function Chip({
  label,
  selected,
  onPress,
  role = 'button',
  accessibilityLabel = label,
  accessibilityHint,
  iconName,
  numberOfLines,
  style,
  testID,
}: ChipProps) {
  const theme = useThemeColors();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      // A radio reports `checked`; `selected` is for tabs and list items and reads as nothing there.
      accessibilityState={role === 'radio' ? { checked: selected } : { selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        style,
        {
          backgroundColor: selected ? theme.ink : pressed ? theme.surfacePressed : theme.surface,
          borderColor: selected ? theme.ink : theme.borderControl,
          opacity: selected && pressed ? 0.85 : 1,
        },
      ]}
    >
      {selected ? (
        <Ionicons
          name="checkmark"
          size={14}
          color={theme.inverseInk}
          accessibilityElementsHidden
          importantForAccessibility="no"
          testID="chip-check"
        />
      ) : iconName ? (
        <NavIcon name={iconName} size={14} />
      ) : null}
      <Text
        variant="caption"
        colorRole={selected ? 'inverseInk' : 'ink'}
        numberOfLines={numberOfLines}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    // A visible box at the platform floor (44pt iOS, 48dp Android) in both directions.
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['1'],
    paddingHorizontal: space['3'],
    paddingVertical: space['1'],
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
