/**
 * Featured story band for the Stories tab home — one elevated card with era/place meta, title,
 * dek, and a calm read affordance (no progress gamification).
 */
import { Pressable, View } from 'react-native';
import { GradientPanel, Text, space, useGradient, useShadowStyle, useThemeColors } from '@/ui';
import type { LearnContentEntry } from './content-catalog';

export interface FeaturedStoryCardProps {
  readonly entry: LearnContentEntry;
  readonly onPress: () => void;
}

export function FeaturedStoryCard({ entry, onPress }: FeaturedStoryCardProps) {
  const theme = useThemeColors();
  const shadow = useShadowStyle('md');
  const copperEdge = useGradient('copperAccentEdge');
  const { page } = entry;
  const meta = [page.eraLabel, page.placeLabel].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Featured story: ${page.title}${meta ? `, ${meta}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      <View style={shadow}>
        <GradientPanel
          name="surfaceLift"
          radiusKey="lg"
          style={{ borderWidth: 1, borderColor: theme.border }}
        >
          <View
            style={{
              height: 2,
              width: '100%',
              backgroundColor: copperEdge.colors[copperEdge.colors.length - 1],
            }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <View style={{ padding: space['5'], gap: space['3'] }}>
            <Text variant="caption" colorRole="accent" accessibilityRole="text">
              Featured
            </Text>
            {meta ? (
              <Text variant="code" colorRole="inkMuted">
                {meta}
              </Text>
            ) : null}
            <Text variant="title" isHeading>
              {page.title}
            </Text>
            {page.dek ? (
              <Text variant="bodySmall" colorRole="inkMuted">
                {page.dek}
              </Text>
            ) : null}
            <Text variant="bodyEmphasis" colorRole="accent">
              Read story
            </Text>
          </View>
        </GradientPanel>
      </View>
    </Pressable>
  );
}
