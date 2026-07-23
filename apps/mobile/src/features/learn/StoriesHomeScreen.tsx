/**
 * Stories-forward Learn tab home: v6 Surface edition stack with indexed intro,
 * featured story band, compact archive ledger, and secondary context links.
 */
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import {
  ApiStatusBanner,
  EditionSurfacePanel,
  EditionSurfaceStack,
  LedgerRow,
  LiftedSurface,
  NavIcon,
  ScreenCanvas,
  screenScrollInsets,
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
        }}
      >
        <ApiStatusBanner compact />
        <EditionSurfaceStack>
          <EditionSurfacePanel
            index="00"
            kicker="Longform"
            title="History pinned to place"
            dek="Each piece links to the records it rests on, with sources you can open. Era and geography stay visible in every entry."
          />

          {featured ? (
            <EditionSurfacePanel index="01" kicker="Featured" title="Start here">
              <FeaturedStoryCard entry={featured} onPress={() => router.push(storyHref(featured) as never)} />
            </EditionSurfacePanel>
          ) : null}

          {archiveStories.length > 0 ? (
            <EditionSurfacePanel
              index={featured ? '02' : '01'}
              kicker="Archive"
              title="Published stories"
              panelLabel="Catalog"
              panelMeta={countLabel}
            >
              <LiftedSurface tone="surfaceRaised" shadow="none">
                {archiveStories.map((entry, index) => (
                  <StoryCompactRow
                    key={`${entry.section}-${entry.page.slug}`}
                    entry={entry}
                    indexLabel={String(index + 1).padStart(2, '0')}
                    onPress={() => router.push(storyHref(entry) as never)}
                    showDivider={index < archiveStories.length - 1}
                  />
                ))}
              </LiftedSurface>
            </EditionSurfacePanel>
          ) : null}

          {secondarySections.length > 0 ? (
            <EditionSurfacePanel
              index={featured ? '03' : '02'}
              kicker="Context"
              title="More to read"
              panelMeta="Context and method"
            >
              <LiftedSurface tone="surfaceRaised" shadow="none">
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
              </LiftedSurface>
            </EditionSurfacePanel>
          ) : null}
        </EditionSurfaceStack>
      </ScrollView>
    </ScreenCanvas>
  );
}
