/**
 * Stories-forward Learn tab home (Ledger Line): dense masthead, featured band,
 * archive ledger, and secondary links on canvas — hairline section labels, not
 * indexed EditionSurfacePanel cards.
 */
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import {
  ApiStatusBanner,
  LedgerRow,
  LedgerSectionLabel,
  NavIcon,
  ScreenCanvas,
  ScreenHeader,
  useScreenScrollInsets,
} from '@/ui';
import { LEARN_SECTIONS } from './sections';
import { FeaturedStoryCard } from './FeaturedStoryCard';
import { StoryCompactRow } from './StoryCompactRow';
import { isLongformSection, listStoryEntries, pickFeaturedStory, storyHref } from './story-index';

const SECONDARY_ICONS = {
  history: 'history',
  myths: 'myths',
  methodology: 'methodology',
} as const;

export function StoriesHomeScreen() {
  const insets = useScreenScrollInsets();
  const allStories = listStoryEntries();
  const featured = pickFeaturedStory(allStories);
  const archiveStories = featured
    ? allStories.filter((entry) => entry.page.slug !== featured.page.slug)
    : allStories;
  // The archive index (above) already lists every longform story, so Context only
  // carries sections that would NOT already appear there — methodology and other
  // non-longform sections.
  const secondarySections = LEARN_SECTIONS.filter(
    (section) => !isLongformSection(section.catalogSection),
  );
  const countLabel = allStories.length === 1 ? '1 story' : `${allStories.length} stories`;

  return (
    <ScreenCanvas edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: insets.paddingHorizontal,
          paddingTop: insets.paddingTop,
          paddingBottom: insets.paddingBottom,
        }}
      >
        <View style={{ gap: insets.gap }}>
          <ApiStatusBanner compact />
          <ScreenHeader
            kicker="Longform"
            title="History pinned to place"
            dek="Each piece links to the records it rests on, with sources you can open. Era and geography stay visible in every entry."
            compact
            dense
          />

          {featured ? (
            <View>
              <LedgerSectionLabel>Start here</LedgerSectionLabel>
              <FeaturedStoryCard
                entry={featured}
                onPress={() => router.push(storyHref(featured) as never)}
              />
            </View>
          ) : null}

          {archiveStories.length > 0 ? (
            <View>
              <LedgerSectionLabel ruleAbove meta={countLabel}>
                Published stories
              </LedgerSectionLabel>
              {archiveStories.map((entry, index) => (
                <StoryCompactRow
                  key={`${entry.section}-${entry.page.slug}`}
                  entry={entry}
                  onPress={() => router.push(storyHref(entry) as never)}
                  showDivider={index < archiveStories.length - 1}
                />
              ))}
            </View>
          ) : null}

          {secondarySections.length > 0 ? (
            <View>
              <LedgerSectionLabel ruleAbove>More to read</LedgerSectionLabel>
              {secondarySections.map((section, index) => (
                <LedgerRow
                  key={section.routeId}
                  title={section.title}
                  summary={section.subtitle}
                  leading={
                    <NavIcon
                      name={SECONDARY_ICONS[section.routeId as keyof typeof SECONDARY_ICONS]}
                      size={20}
                    />
                  }
                  showChevron
                  onPress={() => router.push(`/learn/${section.routeId}` as never)}
                  showDivider={index < secondarySections.length - 1}
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenCanvas>
  );
}
