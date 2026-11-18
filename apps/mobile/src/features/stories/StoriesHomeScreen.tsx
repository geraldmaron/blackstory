/**
 * The Stories tab home, on the live `/v1/stories` list.
 *
 * Composition follows the web Stories index: the newest chapter to start on, the other chapters,
 * any shorter standalone pieces, then ways to browse. Collections of uniform entries (the
 * presidents) are not stories; they are offered under Browse and live on their own screen.
 */
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import type { StoryListItemV1 } from '@repo/public-contracts/v1/story';
import {
  ApiStatusBanner,
  EditionBrandHeader,
  ErrorState,
  LedgerRow,
  LedgerSectionLabel,
  NavIcon,
  Notice,
  ScreenCanvas,
  space,
  useScreenScrollInsets,
} from '@/ui';
import { FeaturedStoryCard } from './FeaturedStoryCard';
import { StoryCompactRow } from './StoryCompactRow';
import { listedOnStories, pickFeaturedStory, storyHref } from './story-index';
import { useStoryList } from './use-stories';

function countLabel(stories: readonly StoryListItemV1[]): string {
  return stories.length === 1 ? '1 story' : `${stories.length} stories`;
}

function StoryBands({ all }: { readonly all: readonly StoryListItemV1[] }) {
  const stories = all.filter(listedOnStories);
  const featured = pickFeaturedStory(stories);
  const rest = stories.filter((story) => story !== featured);
  const bands = [
    { id: 'chapters', label: 'Chapters', meta: 'The long form', items: rest.filter((s) => s.format === 'chapter') },
    { id: 'more', label: 'More stories', meta: 'Shorter pieces', items: rest.filter((s) => s.format !== 'chapter') },
  ].filter((band) => band.items.length > 0);

  return (
    <>
      {featured ? (
        <View>
          <LedgerSectionLabel meta={countLabel(stories)}>Start here</LedgerSectionLabel>
          <FeaturedStoryCard story={featured} onPress={() => router.push(storyHref(featured) as never)} />
        </View>
      ) : null}
      {bands.map((band) => (
        <View key={band.id}>
          <LedgerSectionLabel ruleAbove meta={band.meta}>
            {band.label}
          </LedgerSectionLabel>
          {band.items.map((story, index) => (
            <StoryCompactRow
              key={story.slug}
              story={story}
              onPress={() => router.push(storyHref(story) as never)}
              showDivider={index < band.items.length - 1}
            />
          ))}
        </View>
      ))}
    </>
  );
}

export function StoriesHomeScreen() {
  const insets = useScreenScrollInsets();
  const { state, retry } = useStoryList();

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
            dek="Long-form pieces built from the archive. Every one names the records it stands on and cites its sources line by line."
            compact
            dense
          />

          {state.kind === 'loading' ? (
            <ActivityIndicator accessibilityLabel="Loading stories" style={{ margin: space['6'] }} />
          ) : null}
          {state.kind === 'ready' ? (
            <>
              {state.result.freshness.degraded ? (
                <Notice tone="info" title="Showing the stories saved on this phone" compact />
              ) : null}
              <StoryBands all={state.result.value.stories} />
            </>
          ) : null}
          {state.kind === 'offline-no-cache' ? (
            <ErrorState
              compact
              title="You’re offline"
              description="Stories load from the archive. Connect and try again."
              retry={{ label: 'Try again', onPress: () => void retry() }}
            />
          ) : null}
          {state.kind === 'error' || state.kind === 'not-found' ? (
            <ErrorState
              compact
              title="Stories didn’t load"
              description={state.kind === 'error' ? state.message : undefined}
              retry={{ label: 'Try again', onPress: () => void retry() }}
            />
          ) : null}

          <View>
            <LedgerSectionLabel ruleAbove>Browse</LedgerSectionLabel>
            <LedgerRow
              title="Presidents"
              summary="Every president, in order, with the sources for each line"
              leading={<NavIcon name="institution" size={20} />}
              showChevron
              onPress={() => router.push('/presidents' as never)}
            />
            {/* Themes are a Story collection, not a peer destination in More. */}
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
