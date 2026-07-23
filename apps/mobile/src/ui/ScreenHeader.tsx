/**
 * Compact tab-screen masthead: optional copper kicker, Sora title, optional muted dek.
 * Keeps hierarchy dense and consistent across Explore-adjacent tabs without full-bleed title blocks.
 */
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { space } from './tokens';

export type ScreenHeaderProps = {
  /** Small copper navigational label above the title (e.g. "Longform", "Records"). */
  readonly kicker?: string;
  readonly title: string;
  readonly dek?: string;
  /** Tighter vertical rhythm for map-led screens that share chrome with a toolbar. */
  readonly compact?: boolean;
};

export function ScreenHeader({ kicker, title, dek, compact = false }: ScreenHeaderProps) {
  return (
    <View style={[styles.block, compact ? styles.compact : undefined]} accessibilityRole="header">
      {kicker ? (
        <Text variant="caption" colorRole="accent">
          {kicker}
        </Text>
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
});
