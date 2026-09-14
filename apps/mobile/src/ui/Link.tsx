/**
 * Link primitive: accessibilityRole="link" with underline + accent color
 * from generated tokens. Deliberately navigation-layer-agnostic — actual
 * routing/deep-link wiring is MOB-008's scope, not this brand/primitives
 * bead. The default `onPress` opens `href` via `Linking.openURL` (works for
 * both https:// and custom-scheme URLs); pass `onPress` to override with a
 * router-aware handler once MOB-008 lands.
 *
 * A link that leaves the app says so. When the Link opens an http(s) `href` itself, it carries an
 * "Opens in your browser" hint, so a screen reader user is not surprised to land in Safari or
 * Chrome. A caller-supplied `onPress` decides the destination, so no hint is derived for it; pass
 * `accessibilityHint` to state one, or to override the derived one.
 */
import { Linking, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { Text, type TextProps } from './Text';
import { MIN_TOUCH_TARGET, radius, useThemeColors } from './tokens';

/** Spoken hint for any control that hands the reader off to the system browser. */
export const EXTERNAL_LINK_HINT = 'Opens in your browser';

/** The browser hint for a web `href`; undefined for anything that is not http(s). */
export function externalLinkHint(href: string): string | undefined {
  return /^https?:\/\//i.test(href.trim()) ? EXTERNAL_LINK_HINT : undefined;
}

export type LinkProps = Omit<PressableProps, 'children' | 'style' | 'onPress'> & {
  href: string;
  children: string;
  onPress?: () => void;
  textRole?: TextProps['variant'];
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function Link({
  href,
  children,
  onPress,
  textRole = 'body',
  accessibilityLabel,
  accessibilityHint,
  ...rest
}: LinkProps) {
  const theme = useThemeColors();
  const hint = accessibilityHint ?? (onPress ? undefined : externalLinkHint(href));

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
      {...(hint ? { accessibilityHint: hint } : {})}
      hitSlop={{ left: 8, right: 8 }}
      onPress={handlePress}
      android_ripple={{ color: theme.border }}
      // Tint on press. The box itself is at least 44pt tall, so the visible target clears the
      // floor without leaning on an invisible vertical hitSlop; the text stays centered in it.
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
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
});
