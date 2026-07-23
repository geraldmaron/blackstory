/**
 * Featured story band for the Stories tab home — one composition with era/place
 * meta, title, dek, and a copper read affordance (matte surface, no gradient).
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, radius, space, useThemeColors } from '@/ui';
import type { LearnContentEntry } from './content-catalog';

export interface FeaturedStoryCardProps {
  readonly entry: LearnContentEntry;
  readonly onPress: () => void;
}

export function FeaturedStoryCard({ entry, onPress }: FeaturedStoryCardProps) {
  const theme = useThemeColors();
  const { page } = entry;
  const meta = [page.eraLabel, page.placeLabel].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Featured story: ${page.title}${meta ? `, ${meta}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.kickerRow}>
          <View
            style={[styles.tick, { backgroundColor: theme.accentGraphic }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Text variant="code" colorRole="accent">
            Featured
          </Text>
        </View>
        {meta ? (
          <Text variant="code" colorRole="inkMuted">
            {meta}
          </Text>
        ) : null}
        <Text variant="title" isHeading>
          {page.title}
        </Text>
        {page.dek ? (
          <Text variant="editorial" colorRole="inkMuted" numberOfLines={3}>
            {page.dek}
          </Text>
        ) : null}
        <Text variant="bodyEmphasis" colorRole="accent">
          Read story
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space['5'],
    gap: space['3'],
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
});
