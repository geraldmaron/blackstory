/**
 * Link primitive: accessibilityRole="link" with underline + accent color
 * from generated tokens. Deliberately navigation-layer-agnostic — actual
 * routing/deep-link wiring is MOB-008's scope, not this brand/primitives
 * bead. The default `onPress` opens `href` via `Linking.openURL` (works for
 * both https:// and custom-scheme URLs); pass `onPress` to override with a
 * router-aware handler once MOB-008 lands.
 */
import { Linking, Pressable, type PressableProps } from 'react-native';
import { Text, type TextProps } from './Text';
import { useThemeColors } from './tokens';

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
      hitSlop={8}
      onPress={handlePress}
      {...rest}
    >
      <Text variant={textRole} style={{ color: theme.accent, textDecorationLine: 'underline' }}>
        {children}
      </Text>
    </Pressable>
  );
}
