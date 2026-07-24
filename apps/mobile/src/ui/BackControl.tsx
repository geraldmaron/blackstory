/**
 * Shared copper back chevron for stack headers and optional ScreenHeader leading
 * slots. Flat matte press feedback; 44dp target via hitSlop when the visual box
 * is compact (edition stack chrome).
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { MIN_TOUCH_TARGET, space, useThemeColors } from './tokens';

const ICON_SIZE = 22;
const VISUAL_SIZE = 36;

export type BackControlProps = {
  readonly onPress: () => void;
  /** Defaults to "Go back". */
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly testID?: string;
};

export function BackControl({
  onPress,
  accessibilityLabel = 'Go back',
  accessibilityHint,
  testID,
}: BackControlProps) {
  const theme = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      {...(testID ? { testID } : {})}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: pressed ? theme.surfacePressed : 'transparent',
        },
      ]}
    >
      <Ionicons
        name="chevron-back"
        size={ICON_SIZE}
        color={theme.accent}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: VISUAL_SIZE,
    height: VISUAL_SIZE,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    marginLeft: -space['2'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
