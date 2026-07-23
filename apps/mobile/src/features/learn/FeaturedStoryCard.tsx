/**
 * Featured story band for the Stories tab home — v6 Surface card with label-over-value
 * era/place facts, title, dek, and copper read affordance.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { LiftedSurface, RecordFactStrip, Text, space } from '@/ui';
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
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      <LiftedSurface tone="surface" shadow="none" paddingKey="5">
        <View style={styles.inner}>
          {facts.length > 0 ? <RecordFactStrip facts={facts} /> : null}
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
      </LiftedSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    gap: space['3'],
  },
});
