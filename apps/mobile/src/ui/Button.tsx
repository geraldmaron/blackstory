/**
 * Pressable-based Button primitive with native accessible press semantics:
 * accessibilityRole="button" (overridable via a passed-through `accessibilityRole`, e.g.
 * "radio" for a toggle/filter chip), accessibilityState (disabled/busy, merged with an optional
 * caller-supplied `selected`/`checked`/`expanded` — see `accessibilityState` prop, MOB-017) kept
 * in sync, and a minimum 44x44dp hit target (Apple HIG / Material guidance) via hitSlop when the
 * rendered box is smaller. Colors/radius/spacing/motion all come from generated tokens.
 *
 * Variants follow v6 copper discipline: primary = ink fill; accent = copper navigational CTA;
 * secondary/ghost for supporting actions.
 */
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './Text';
import { MIN_TOUCH_TARGET, radius, space, useThemeColors } from './tokens';

/** Visual box height for `density="compact"` — the 44dp target is restored via hitSlop. */
const COMPACT_BOX_HEIGHT = 32;
const COMPACT_HIT_SLOP = { top: 6, bottom: 6, left: 8, right: 8 } as const;

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
  const isDisabled = Boolean(disabled) || loading;

  // `pressedBg` shifts the fill tone rather than dimming the whole button — a blanket
  // opacity drop fades the border and label along with the fill, which reads as
  // "disabled" instead of "pressed". Tones are token-only and visible in both themes.
  const palette = {
    primary: { bg: theme.ink, pressedBg: theme.inkMuted, fg: theme.inverseInk, border: theme.ink },
    secondary: { bg: theme.surface, pressedBg: theme.border, fg: theme.ink, border: theme.border },
    ghost: { bg: 'transparent', pressedBg: theme.border, fg: theme.accent, border: 'transparent' },
    accent: {
      bg: theme.ink,
      pressedBg: theme.inkMuted,
      fg: theme.inverseInk,
      border: theme.accentGraphic,
    },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading, ...accessibilityState }}
      disabled={isDisabled}
      hitSlop={density === 'compact' ? COMPACT_HIT_SLOP : 8}
      android_ripple={{ color: palette.pressedBg }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        density === 'compact' ? styles.compact : null,
        {
          backgroundColor: pressed && !isDisabled ? palette.pressedBg : palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.5 : 1,
        },
        variant === 'accent' ? styles.accentBorder : null,
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
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space['4'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentBorder: {
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  compact: {
    minHeight: COMPACT_BOX_HEIGHT,
    paddingHorizontal: space['3'],
    paddingVertical: space['1'],
  },
});
