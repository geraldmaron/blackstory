/**
 * Compact tab-screen masthead: copper-tick mono kicker, Sora title, optional
 * muted dek. Keeps hierarchy dense across Search / Stories / More.
 */
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { space, useThemeColors } from './tokens';

export type ScreenHeaderProps = {
  /** Small copper navigational label above the title (e.g. "Longform", "Records"). */
  readonly kicker?: string;
  readonly title: string;
  readonly dek?: string;
  /** Tighter vertical rhythm for map-led screens that share chrome with a toolbar. */
  readonly compact?: boolean;
};

export function ScreenHeader({ kicker, title, dek, compact = false }: ScreenHeaderProps) {
  const theme = useThemeColors();

  return (
    <View style={[styles.block, compact ? styles.compact : undefined]} accessibilityRole="header">
      {kicker ? (
        <View style={styles.kickerRow}>
          <View
            style={[styles.tick, { backgroundColor: theme.accentGraphic }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Text variant="code" colorRole="accent" numberOfLines={1} style={styles.kicker}>
            {kicker}
          </Text>
        </View>
      ) : null}
      <Text variant={compact ? 'title' : 'display'} isHeading>
        {title}
      </Text>
      {dek ? (
        <Text variant="bodySmall" colorRole="inkMuted">
          {dek}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space['2'],
  },
  compact: {
    gap: space['1'],
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  tick: {
    width: 3,
    height: 12,
    borderRadius: 1,
  },
  kicker: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
