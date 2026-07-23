/**
 * Pressable-based Button primitive with native accessible press semantics:
 * accessibilityRole="button" (overridable via a passed-through `accessibilityRole`, e.g.
 * "radio" for a toggle/filter chip), accessibilityState (disabled/busy, merged with an optional
 * caller-supplied `selected`/`checked`/`expanded` — see `accessibilityState` prop, MOB-017) kept
 * in sync, and a minimum 44x44dp hit target (Apple HIG / Material guidance) via hitSlop when the
 * rendered box is smaller. Colors/radius/spacing/motion all come from generated tokens.
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

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent';
export type ButtonDensity = 'default' | 'compact';

export type ButtonProps = Omit<PressableProps, 'children' | 'style' | 'accessibilityState'> & {
  /** Visible label. Also becomes the default accessibilityLabel. */
  label: string;
  variant?: ButtonVariant;
  /** Shows a spinner and sets accessibilityState.busy; interaction is disabled while true. */
  loading?: boolean;
  /** Overrides the default (label-derived) accessible name — use for icon-only or ambiguous labels. */
  accessibilityLabel?: string;
  /**
   * Extra accessibilityState to merge with the button's own tracked `disabled`/`busy` state —
   * e.g. `{ selected: true }` when `Button` is used as a toggle/radio-style control (pair with
   * `accessibilityRole="radio"`, which flows through as an ordinary `Pressable` prop). Merged
   * rather than replacing the whole object so callers can't accidentally drop the disabled/busy
   * tracking by supplying this.
   */
  accessibilityState?: Pick<
    NonNullable<PressableProps['accessibilityState']>,
    'selected' | 'checked' | 'expanded'
  >;
  /** Tighter padding for filter chips and inline actions. */
  density?: ButtonDensity;
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  accessibilityLabel,
  accessibilityState,
  onPress,
  density = 'default',
  ...rest
}: ButtonProps) {
  const theme = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const isDisabled = Boolean(disabled) || loading;

  const palette = {
    primary: { bg: theme.ink, fg: theme.inverseInk, border: theme.ink },
    secondary: { bg: theme.surfaceRaised, fg: theme.ink, border: theme.border },
    ghost: { bg: 'transparent', fg: theme.accent, border: 'transparent' },
    accent: { bg: theme.accent, fg: theme.inverseInk, border: theme.accent },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading, ...accessibilityState }}
      disabled={isDisabled}
      hitSlop={density === 'compact' ? 10 : 8}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[
        styles.base,
        density === 'compact' ? styles.compact : null,
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
        <Text variant={density === 'compact' ? 'bodySmall' : 'bodyEmphasis'} style={{ color: palette.fg }}>
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
  compact: {
    minHeight: 36,
    paddingHorizontal: space['3'],
    paddingVertical: space['1'],
  },
});
