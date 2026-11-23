/**
 * One live story (`/v1/stories/{slug}`), for `/stories/{slug}` and a collection's own route
 * (`/presidents/{slug}`). A story requested under the wrong base is sent to its own address, the
 * same rule the site follows, so a shared link opens the same piece on both.
 */
import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { router } from 'expo-router';
import {
  ErrorState,
  Link,
  Notice,
  RecordFactStrip,
  ScreenCanvas,
  Text,
  space,
  useScreenScrollInsets,
} from '@/ui';
import { CiteButton } from '@/features/cite/CiteButton';
import { plainRangeText } from '../record-facts/record-facts';
import { StoryBlocks, StoryImageExhibit, StoryReferences, storyWebUrl } from './StoryBody';
import { StoryProgress, type StoryProgressHandle } from './StoryProgress';
import { storyPosition, type ChapterMark } from './story-progress';
import { useStory } from './use-stories';

export function StoryScreen({ slug, base }: { readonly slug: string; readonly base: string }) {
  const insets = useScreenScrollInsets();
  const progress = useRef<StoryProgressHandle>(null);
  // Chapter offsets are measured inside the blocks; `blocksTop` places the blocks in the scroll.
  const chapters = useRef(new Map<string, number>());
  const blocksTop = useRef(0);
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const marks: ChapterMark[] = [...chapters.current].map(([text, y]) => ({
      text,
      y: y + blocksTop.current,
    }));
    progress.current?.set(
      storyPosition(contentOffset.y, layoutMeasurement.height, contentSize.height, marks),
    );
  }, []);
  const { state, retry } = useStory(slug);
  const story = state.kind === 'ready' ? state.result.value : undefined;
  const misplaced = story !== undefined && !story.webPath.startsWith(`${base}/`);

  useEffect(() => {
    if (story && misplaced) router.replace(story.webPath as never);
  }, [story, misplaced]);

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      {story && !misplaced ? <StoryProgress ref={progress} title={story.title} /> : null}
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{
          paddingHorizontal: insets.paddingHorizontal,
          paddingTop: space['4'],
          paddingBottom: insets.paddingBottom,
        }}
      >
        {state.kind === 'loading' || misplaced ? (
          <ActivityIndicator
            accessibilityLabel="Loading the story"
            style={{ margin: space['6'] }}
          />
        ) : null}
        {state.kind === 'not-found' ? (
          <ErrorState
            title="This story isn’t published"
            description="It may have been withdrawn, or the link is wrong."
          />
        ) : null}
        {state.kind === 'offline-no-cache' ? (
          <ErrorState
            title="You’re offline"
            description="This story hasn’t been saved on this phone yet. Connect and try again."
            retry={{ label: 'Try again', onPress: () => void retry() }}
          />
        ) : null}
        {state.kind === 'error' ? (
          <ErrorState
            title="This story didn’t load"
            description={state.message}
            retry={{ label: 'Try again', onPress: () => void retry() }}
          />
        ) : null}

        {story && !misplaced ? (
          <View style={{ gap: space['4'], maxWidth: 672 }}>
            {state.kind === 'ready' && state.result.freshness.degraded ? (
              <Notice tone="info" title="Showing the copy saved on this phone" compact />
            ) : null}
            {story.collection ? (
              <Text
                variant="meta"
                colorRole="inkMuted"
                style={{ letterSpacing: 1, textTransform: 'uppercase' }}
              >
                {[story.collection.label, story.collection.positionLabel]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
            <Text variant="display" isHeading>
              {story.title}
            </Text>
            <Text variant="editorial" colorRole="inkMuted">
              {story.summary}
            </Text>
            <RecordFactStrip
              facts={[
                {
                  key: 'years',
                  label: story.format === 'entry' ? 'Term' : 'Years',
                  value: plainRangeText(story.eraLabel),
                },
                ...(story.format === 'entry'
                  ? []
                  : [{ key: 'place', label: 'Place', value: story.placeLabel }]),
                ...(story.references.length > 0
                  ? [{ key: 'sources', label: 'Sources', value: String(story.references.length) }]
                  : []),
              ]}
            />
            {/* The page's date is its last revision; the subject's years never enter a citation. */}
            <CiteButton
              source={{
                title: story.title,
                url: storyWebUrl(story.webPath),
                published: story.updatedAt ?? story.publishedAt,
              }}
            />
            {story.heroImage ? (
              <StoryImageExhibit image={story.heroImage} bleed={insets.paddingHorizontal} />
            ) : null}

            <View
              onLayout={(event) => {
                blocksTop.current = event.nativeEvent.layout.y + space['4'];
              }}
            >
              <StoryBlocks
                blocks={story.body}
                webUrl={storyWebUrl(story.webPath)}
                bleed={insets.paddingHorizontal}
                onChapterLayout={(text, y) => chapters.current.set(text, y)}
              />
            </View>
            <StoryReferences references={story.references} />

            <View style={{ gap: space['2'], marginTop: space['4'] }}>
              <Link href={storyWebUrl(story.webPath)} textRole="bodySmall">
                Read this on the web
              </Link>
              <Link
                href="/corrections/submit"
                textRole="bodySmall"
                onPress={() => router.push('/corrections/submit' as never)}
              >
                Report an error
              </Link>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </ScreenCanvas>
  );
}
