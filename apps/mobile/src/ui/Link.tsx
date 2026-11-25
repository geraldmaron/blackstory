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
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { Text, type TextProps } from './Text';
import { useAnnounceOnChange } from './useAnnounceOnChange';
import { MIN_TOUCH_TARGET, radius, useThemeColors } from './tokens';

/** Spoken hint for any control that hands the reader off to the system browser. */
export const EXTERNAL_LINK_HINT = 'Opens in your browser';

/** Shown and announced when the system refuses the URL. Same words as `CitationLink`. */
export const LINK_OPEN_FAILED = 'This link could not be opened.';

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
  const [failed, setFailed] = useState(false);
  useAnnounceOnChange(failed ? LINK_OPEN_FAILED : null);

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    // Cleared first so a second failure in a row is announced again.
    setFailed(false);
    Linking.openURL(href).catch(() => {
      // An unreachable/unsupported URL must not crash the app, and must not fail silently
      // either. Nothing is logged (the URL stays out of logs, per the privacy posture).
      setFailed(true);
    });
  };

  return (
    <>
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
      {failed ? (
        <Text variant="caption" colorRole="inkMuted" accessibilityLiveRegion="polite">
          {LINK_OPEN_FAILED}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.sm,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
});
