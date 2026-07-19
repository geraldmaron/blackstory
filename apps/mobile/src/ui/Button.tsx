/**
 * Pressable-based Button primitive with native accessible press semantics:
 * accessibilityRole="button", accessibilityState (disabled/busy) kept in
 * sync, and a minimum 44x44dp hit target (Apple HIG / Material guidance) via
 * hitSlop when the rendered box is smaller. Colors/radius/spacing/motion all
 * come from generated tokens.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './Text';
import { radius, space, useThemeColors } from './tokens';

const MIN_TOUCH_TARGET = 44;

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  /** Visible label. Also becomes the default accessibilityLabel. */
  label: string;
  variant?: ButtonVariant;
  /** Shows a spinner and sets accessibilityState.busy; interaction is disabled while true. */
  loading?: boolean;
  /** Overrides the default (label-derived) accessible name — use for icon-only or ambiguous labels. */
  accessibilityLabel?: string;
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  accessibilityLabel,
  onPress,
  ...rest
}: ButtonProps) {
  const theme = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const isDisabled = Boolean(disabled) || loading;

  const palette = {
    primary: { bg: theme.ink, fg: theme.inverseInk, border: theme.ink },
    secondary: { bg: theme.surfaceRaised, fg: theme.ink, border: theme.border },
    ghost: { bg: 'transparent', fg: theme.accent, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={8}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={palette.fg}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : null}
        <Text variant="bodyEmphasis" style={{ color: palette.fg }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: space['4'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
});
