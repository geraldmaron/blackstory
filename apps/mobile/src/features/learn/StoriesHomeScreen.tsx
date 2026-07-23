/**
 * Stories-forward Learn tab home: v6 dense masthead, featured story band, compact archive
 * ledger, and secondary context links — continuous surfaces matching History browse density.
 */
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import {
  ApiStatusBanner,
  EditionSurfacePanel,
  EditionSurfaceStack,
  LedgerRow,
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
  // The archive index (above) already lists every longform story, so the Context panel only
  // carries sections that would NOT already appear there — methodology and other non-longform
  // sections. This stops History/Myths from being listed as both individual stories and links.
  const secondarySections = LEARN_SECTIONS.filter(
    (section) => !isLongformSection(section.catalogSection),
  );
  // Count the whole catalog (featured included), not just the rows below the featured band.
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

          <EditionSurfaceStack dense>
            {featured ? (
              <EditionSurfacePanel index="01" title="Start here" compact dense>
                <FeaturedStoryCard entry={featured} onPress={() => router.push(storyHref(featured) as never)} />
              </EditionSurfacePanel>
            ) : null}

            {archiveStories.length > 0 ? (
              <EditionSurfacePanel
                index={featured ? '02' : '01'}
                title="Published stories"
                panelMeta={countLabel}
                compact
                dense
              >
                {archiveStories.map((entry, index) => (
                  <StoryCompactRow
                    key={`${entry.section}-${entry.page.slug}`}
                    entry={entry}
                    indexLabel={String(index + 1).padStart(2, '0')}
                    onPress={() => router.push(storyHref(entry) as never)}
                    showDivider={index < archiveStories.length - 1}
                  />
                ))}
              </EditionSurfacePanel>
            ) : null}

            {secondarySections.length > 0 ? (
              <EditionSurfacePanel
                index={featured ? '03' : '02'}
                title="More to read"
                compact
                dense
              >
                {secondarySections.map((section, index) => (
                  <LedgerRow
                    key={section.routeId}
                    title={section.title}
                    summary={section.subtitle}
                    indexLabel={String(index + 1).padStart(2, '0')}
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
              </EditionSurfacePanel>
            ) : null}
          </EditionSurfaceStack>
        </View>
      </ScrollView>
    </ScreenCanvas>
  );
}
