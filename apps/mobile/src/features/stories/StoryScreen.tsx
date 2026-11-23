/**
 * One live story (`/v1/stories/{slug}`), for `/stories/{slug}` and a collection's own route
 * (`/presidents/{slug}`). A story requested under the wrong base is sent to its own address, the
 * same rule the site follows, so a shared link opens the same piece on both.
 */
import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
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
import { plainRangeText } from '../record-facts/record-facts';
import { StoryBlocks, StoryImageExhibit, StoryReferences, storyWebUrl } from './StoryBody';
import { useStory } from './use-stories';

export function StoryScreen({ slug, base }: { readonly slug: string; readonly base: string }) {
  const insets = useScreenScrollInsets();
  const { state, retry } = useStory(slug);
  const story = state.kind === 'ready' ? state.result.value : undefined;
  const misplaced = story !== undefined && !story.webPath.startsWith(`${base}/`);

  useEffect(() => {
    if (story && misplaced) router.replace(story.webPath as never);
  }, [story, misplaced]);

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <ScrollView
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
              <Text variant="meta" colorRole="accent">
                {[story.collection.label, story.collection.positionLabel]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
            <Text variant="title" isHeading>
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
            {story.heroImage ? <StoryImageExhibit image={story.heroImage} /> : null}

            <StoryBlocks blocks={story.body} webUrl={storyWebUrl(story.webPath)} />
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
