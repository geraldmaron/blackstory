/**
 * List/sheet row primitive: a pressable row with optional leading content,
 * title/subtitle, and trailing content. Meets the 44dp minimum touch target
 * via minHeight, and exposes accessibilityRole="button" (row navigates/acts)
 * or "none" (row is purely a static container — set `interactive={false}`)
 * so screen readers don't announce non-interactive rows as buttons.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Divider } from './Divider';
import { MIN_TOUCH_TARGET, space, useThemeColors } from './tokens';

const MIN_ROW_HEIGHT = MIN_TOUCH_TARGET;

export type ListRowDensity = 'default' | 'compact';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  /** Set false for a static, non-pressable row (e.g. a plain info row inside a sheet). */
  interactive?: boolean;
  accessibilityLabel?: string;
  showDivider?: boolean;
  /** Tighter vertical rhythm for dense browse/settings lists. */
  density?: ListRowDensity;
  /** Renders a standard forward chevron for navigation rows (Ionicons, not unicode triangles). */
  showChevron?: boolean;
};

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  interactive = Boolean(onPress),
  accessibilityLabel,
  showDivider = true,
  density = 'default',
  showChevron = false,
}: ListRowProps) {
  const theme = useThemeColors();
  const label = accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title);
  const densityStyles = density === 'compact' ? styles.compactPressable : styles.pressable;
  const trailingContent =
    trailing ??
    (showChevron && interactive ? (
      <Ionicons name="chevron-forward" size={18} color={theme.inkMuted} accessibilityElementsHidden />
    ) : null);

  const content = (
    <View style={styles.row}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.textColumn}>
        <Text variant="rowTitle">{title}</Text>
        {subtitle ? (
          <Text variant="caption" colorRole="inkMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailingContent ? <View style={styles.trailing}>{trailingContent}</View> : null}
    </View>
  );

  return (
    <View>
      {interactive ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          android_ripple={{ color: theme.border }}
          style={({ pressed }) => [
            densityStyles,
            // Press steps down the Archive Paper ladder (surface → surfacePressed).
            { backgroundColor: pressed ? theme.surfacePressed : 'transparent' },
          ]}
        >
          {content}
        </Pressable>
      ) : (
        <View accessibilityLabel={label} style={densityStyles}>
          {content}
        </View>
      )}
      {showDivider ? <Divider /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: MIN_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: space['4'],
    paddingVertical: space['2'],
  },
  compactPressable: {
    minHeight: MIN_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: space['3'],
    paddingVertical: space['1'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
  },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
  },
  trailing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
