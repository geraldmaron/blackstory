/**
 * Featured story band for the Stories tab home — browse-density facts (Inter + mono),
 * compact title/dek, and copper read affordance on a continuous panel surface.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { RecordFactStrip, Text, space, useThemeColors } from '@/ui';
import { plainRangeText } from '../record-facts/record-facts';
import type { LearnContentEntry } from './content-catalog';

export interface FeaturedStoryCardProps {
  readonly entry: LearnContentEntry;
  readonly onPress: () => void;
}

export function FeaturedStoryCard({ entry, onPress }: FeaturedStoryCardProps) {
  const { page } = entry;
  const theme = useThemeColors();
  const facts = [
    ...(page.eraLabel
      ? [{ key: 'era', label: 'Era', value: plainRangeText(page.eraLabel) }]
      : []),
    ...(page.placeLabel ? [{ key: 'where', label: 'Where', value: page.placeLabel }] : []),
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Featured story: ${page.title}`}
      onPress={onPress}
      android_ripple={{ color: theme.border }}
      // `canvas` (not opacity) — matches LedgerRow press feedback, visible on #FBF8F2.
      style={({ pressed }) => [styles.pressable, { backgroundColor: pressed ? theme.canvas : 'transparent' }]}
    >
      <View style={styles.inner}>
        {facts.length > 0 ? <RecordFactStrip facts={facts} valueVariant="bodySmall" /> : null}
        <Text variant="bodyEmphasis" isHeading>
          {page.title}
        </Text>
        {page.dek ? (
          <Text variant="bodySmall" colorRole="inkMuted" numberOfLines={3}>
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
  pressable: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space['3'],
  },
  inner: {
    gap: space['2'],
  },
});
