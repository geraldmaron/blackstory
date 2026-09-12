/**
 * The Stories tab home: a deliberately authored landing, not a flat list of everything.
 *
 * Composition follows the web Stories index so the two surfaces teach the same shape — a chapter
 * to start on, then the deep narrative form, then the corrections, then the shorter entries, then
 * a way to browse. It used to open with a "More to read" band pointing at `/learn/history`,
 * `/learn/myths` and `/learn/methodology`: two of those were the same publication surface under
 * different addresses, and the third was reference material filed inside the narrative tab.
 */
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import {
  ApiStatusBanner,
  EditionBrandHeader,
  LedgerRow,
  LedgerSectionLabel,
  NavIcon,
  ScreenCanvas,
  useScreenScrollInsets,
} from '@/ui';
import type { ContentEntry } from '@/features/content';
import { FeaturedStoryCard } from './FeaturedStoryCard';
import { StoryCompactRow } from './StoryCompactRow';
import { listStoriesOfFormat, listStoryEntries, pickFeaturedStory, storyHref } from './story-index';

function countLabel(entries: readonly ContentEntry[]): string {
  return entries.length === 1 ? '1 story' : `${entries.length} stories`;
}

export function StoriesHomeScreen() {
  const insets = useScreenScrollInsets();
  const allStories = listStoryEntries();
  const featured = pickFeaturedStory(allStories);
  const withoutFeatured = (entries: readonly ContentEntry[]): readonly ContentEntry[] =>
    featured ? entries.filter((entry) => entry.page.slug !== featured.page.slug) : entries;

  // Each band is one editorial format. A band with nothing in it renders nothing at all rather
  // than an empty heading: structural chrome over no content reads as a fault.
  const bands = [
    {
      id: 'chapters',
      label: 'Chapters',
      meta: 'The long form',
      entries: withoutFeatured(listStoriesOfFormat('chapter')),
    },
    {
      id: 'corrections',
      label: 'Corrections',
      meta: 'Claims the record does not support',
      entries: withoutFeatured(listStoriesOfFormat('myth')),
    },
    {
      id: 'entries',
      label: 'Entries',
      meta: 'Shorter pieces',
      entries: withoutFeatured(listStoriesOfFormat('entry')),
    },
  ].filter((band) => band.entries.length > 0);

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
          <EditionBrandHeader
            kicker="Stories"
            title="History pinned to place"
            dek="Chapters, shorter entries, and corrections to claims the record does not support. Every piece names the records it stands on."
            compact
            dense
          />

          {featured ? (
            <View>
              <LedgerSectionLabel meta={countLabel(allStories)}>Start here</LedgerSectionLabel>
              <FeaturedStoryCard
                entry={featured}
                onPress={() => router.push(storyHref(featured) as never)}
              />
            </View>
          ) : null}

          {bands.map((band) => (
            <View key={band.id}>
              <LedgerSectionLabel ruleAbove meta={band.meta}>
                {band.label}
              </LedgerSectionLabel>
              {band.entries.map((entry, index) => (
                <StoryCompactRow
                  key={entry.page.slug}
                  entry={entry}
                  onPress={() => router.push(storyHref(entry) as never)}
                  showDivider={index < band.entries.length - 1}
                />
              ))}
            </View>
          ))}

          <View>
            <LedgerSectionLabel ruleAbove>Browse</LedgerSectionLabel>
            {/* Themes are a Story collection, not a peer destination in More. They were listed
                beside Law and Data there, which put a set of narrative packets in the reference
                drawer and gave the archive two parallel publication surfaces. */}
            <LedgerRow
              title="Themes"
              summary="Policy-impact collections, each with its evidence attached"
              leading={<NavIcon name="collection" size={20} />}
              showChevron
              onPress={() => router.push('/themes' as never)}
            />
            <LedgerRow
              title="Records"
              summary="The whole archive as a list, searchable by era, kind and place"
              leading={<NavIcon name="records" size={20} />}
              showChevron
              onPress={() => router.push('/records' as never)}
              showDivider={false}
            />
          </View>
        </View>
      </ScrollView>
    </ScreenCanvas>
  );
}
