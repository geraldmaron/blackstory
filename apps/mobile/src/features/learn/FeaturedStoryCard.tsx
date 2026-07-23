/**
 * Featured story band for the Stories tab home — browse-density facts (Inter + mono),
 * compact title/dek, and copper read affordance on a continuous panel surface.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { RecordFactStrip, Text, space } from '@/ui';
import { plainRangeText } from '../record-facts/record-facts';
import type { LearnContentEntry } from './content-catalog';

export interface FeaturedStoryCardProps {
  readonly entry: LearnContentEntry;
  readonly onPress: () => void;
}

export function FeaturedStoryCard({ entry, onPress }: FeaturedStoryCardProps) {
  const { page } = entry;
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
      style={({ pressed }) => [styles.pressable, { opacity: pressed ? 0.92 : 1 }]}
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
  },
  inner: {
    gap: space['2'],
  },
});
