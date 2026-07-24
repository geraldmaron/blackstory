/**
 * Link primitive: accessibilityRole="link" with underline + accent color
 * from generated tokens. Deliberately navigation-layer-agnostic — actual
 * routing/deep-link wiring is MOB-008's scope, not this brand/primitives
 * bead. The default `onPress` opens `href` via `Linking.openURL` (works for
 * both https:// and custom-scheme URLs); pass `onPress` to override with a
 * router-aware handler once MOB-008 lands.
 */
import { Linking, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { Text, type TextProps } from './Text';
import { radius, useThemeColors } from './tokens';

export type LinkProps = Omit<PressableProps, 'children' | 'style' | 'onPress'> & {
  href: string;
  children: string;
  onPress?: () => void;
  textRole?: TextProps['variant'];
  accessibilityLabel?: string;
};

export function Link({ href, children, onPress, textRole = 'body', accessibilityLabel, ...rest }: LinkProps) {
  const theme = useThemeColors();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    Linking.openURL(href).catch(() => {
      // Swallow: an unreachable/unsupported URL should not crash the app.
      // A future MOB-018 observability pass may log this (without the URL,
      // per the program's privacy posture) if it proves to matter.
    });
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? children}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      onPress={handlePress}
      android_ripple={{ color: theme.border }}
      // Links had no press feedback at all. Tint only — no padding/alignment change —
      // so adding this cannot reflow any existing caller's layout.
      style={({ pressed }) => [
        styles.pressable,
        pressed ? { backgroundColor: theme.border } : null,
      ]}
      {...rest}
    >
      <Text variant={textRole} style={{ color: theme.accent, textDecorationLine: 'underline' }}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.sm,
  },
});
