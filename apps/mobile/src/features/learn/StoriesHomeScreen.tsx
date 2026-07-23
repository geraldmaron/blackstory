/**
 * Stories-forward Learn tab home: featured story band, compact archive index, and secondary links
 * to History, Myths, and Methodology (not a flat dump of generic ListRows).
 */
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import {
  ApiStatusBanner,
  LiftedSurface,
  ListRow,
  NavIcon,
  ScreenCanvas,
  ScreenHeader,
  SectionHeader,
  screenScrollInsets,
  space,
} from '@/ui';
import { LEARN_SECTIONS } from './sections';
import { FeaturedStoryCard } from './FeaturedStoryCard';
import { StoryCompactRow } from './StoryCompactRow';
import { listStoryEntries, pickFeaturedStory, storyHref } from './story-index';

const SECONDARY_ROUTE_IDS = new Set(['history', 'myths', 'methodology']);

const SECONDARY_ICONS = {
  history: 'history',
  myths: 'myths',
  methodology: 'methodology',
} as const;

export function StoriesHomeScreen() {
  const allStories = listStoryEntries();
  const featured = pickFeaturedStory(allStories);
  const archiveStories = featured
    ? allStories.filter((entry) => entry.page.slug !== featured.page.slug)
    : allStories;
  const secondarySections = LEARN_SECTIONS.filter((section) => SECONDARY_ROUTE_IDS.has(section.routeId));
  const countLabel = archiveStories.length === 1 ? '1 story' : `${archiveStories.length} stories`;

  return (
    <ScreenCanvas>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: screenScrollInsets.paddingHorizontal,
          paddingTop: screenScrollInsets.paddingTop,
          paddingBottom: screenScrollInsets.paddingBottom,
          gap: screenScrollInsets.gap,
        }}
      >
        <ApiStatusBanner />
        <ScreenHeader
          kicker="Longform"
          title="Stories"
          dek="History pinned to place and era. Each piece links to the records it rests on, with sources you can open."
        />

        {featured ? (
          <FeaturedStoryCard entry={featured} onPress={() => router.push(storyHref(featured) as never)} />
        ) : null}

        {archiveStories.length > 0 ? (
          <View style={{ gap: space['2'] }} accessibilityRole="none">
            <SectionHeader title="In the archive" meta={countLabel} headingScale="bodyEmphasis" />
            <LiftedSurface gradient="panelAtmosphere" shadow="sm">
              {archiveStories.map((entry, index) => (
                <StoryCompactRow
                  key={`${entry.section}-${entry.page.slug}`}
                  entry={entry}
                  onPress={() => router.push(storyHref(entry) as never)}
                  showDivider={index < archiveStories.length - 1}
                />
              ))}
            </LiftedSurface>
          </View>
        ) : null}

        {secondarySections.length > 0 ? (
          <View style={{ gap: space['2'] }}>
            <SectionHeader title="More to read" meta="Context & method" headingScale="bodyEmphasis" />
            <LiftedSurface gradient="panelAtmosphere" shadow="sm">
              {secondarySections.map((section, index) => (
                <ListRow
                  key={section.routeId}
                  density="compact"
                  title={section.title}
                  subtitle={section.subtitle}
                  leading={
                    <NavIcon
                      name={SECONDARY_ICONS[section.routeId as keyof typeof SECONDARY_ICONS]}
                    />
                  }
                  showChevron
                  onPress={() => router.push(`/learn/${section.routeId}` as never)}
                  showDivider={index < secondarySections.length - 1}
                />
              ))}
            </LiftedSurface>
          </View>
        ) : null}
      </ScrollView>
    </ScreenCanvas>
  );
}
