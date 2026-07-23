/**
 * Ledger index row for search / archive listings: optional mono index, KIND ·
 * PLACE slug, Sora title, serif one-liner. Hairline divider — not a card stack.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Divider } from './Divider';
import { space, useThemeColors } from './tokens';

const MIN_ROW_HEIGHT = 44;

export type LedgerRowProps = {
  readonly title: string;
  /** Mono KIND · PLACE (or similar) slug above the title. */
  readonly slug?: string;
  /** Serif / body one-liner under the title. */
  readonly summary?: string;
  /** Optional leading mono index (01, 02…). */
  readonly indexLabel?: string;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  readonly onPress?: (event: GestureResponderEvent) => void;
  readonly accessibilityLabel?: string;
  readonly showDivider?: boolean;
  readonly showChevron?: boolean;
  /** Secondary trailing action (e.g. Show on map). */
  readonly secondaryAction?: ReactNode;
};

export function LedgerRow({
  title,
  slug,
  summary,
  indexLabel,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  showDivider = true,
  showChevron = false,
  secondaryAction,
}: LedgerRowProps) {
  const theme = useThemeColors();
  const label =
    accessibilityLabel ??
    [title, slug, summary].filter((part) => typeof part === 'string' && part.length > 0).join('. ');

  const trailingContent =
    trailing ??
    (showChevron && onPress ? (
      <Ionicons name="chevron-forward" size={18} color={theme.inkMuted} accessibilityElementsHidden />
    ) : null);

  const content = (
    <View style={styles.row}>
      {indexLabel ? (
        <Text variant="code" colorRole="inkSubtle" style={styles.index}>
          {indexLabel}
        </Text>
      ) : null}
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.textColumn}>
        {slug ? (
          <Text variant="code" colorRole="inkMuted" numberOfLines={1}>
            {slug}
          </Text>
        ) : null}
        <Text variant="bodyEmphasis" numberOfLines={2}>
          {title}
        </Text>
        {summary ? (
          <Text variant="editorial" colorRole="inkMuted" numberOfLines={2}>
            {summary}
          </Text>
        ) : null}
        {secondaryAction ? <View style={styles.secondary}>{secondaryAction}</View> : null}
      </View>
      {trailingContent ? <View style={styles.trailing}>{trailingContent}</View> : null}
    </View>
  );

  return (
    <View>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={({ pressed }) => [
            styles.pressable,
            { backgroundColor: pressed ? theme.surfaceRaised : 'transparent' },
          ]}
        >
          {content}
        </Pressable>
      ) : (
        <View accessibilityLabel={label} style={styles.pressable}>
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
    paddingHorizontal: space['3'],
    paddingVertical: space['2'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space['2'],
  },
  index: {
    minWidth: 28,
    paddingTop: 2,
  },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  secondary: {
    marginTop: space['1'],
  },
  trailing: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
});
