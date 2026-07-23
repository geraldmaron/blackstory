/**
 * Dev-only header affordance for the Expo developer menu. Sits in the masthead
 * trailing slot so the native floating dev FAB does not overlap browse content.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { radius, useThemeColors } from './tokens';

const GHOST_SIZE = 36;
const ICON_SIZE = 17;

export function DevMenuHeaderButton() {
  const theme = useThemeColors();

  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return null;
  }

  function handlePress() {
    try {
      // expo-dev-client re-exports expo-dev-menu; openMenu is unavailable in Jest.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const devMenu = require('expo-dev-menu') as { openMenu?: () => void };
      devMenu.openMenu?.();
    } catch {
      // Non-fatal when dev menu native module is absent (tests, production builds).
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Developer menu"
      hitSlop={8}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: pressed ? theme.surfaceRaised : theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <Ionicons name="options-outline" size={ICON_SIZE} color={theme.inkMuted} accessibilityElementsHidden />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
