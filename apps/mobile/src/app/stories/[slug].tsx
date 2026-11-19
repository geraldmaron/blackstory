/**
 * `/stories/[slug]`: one published story, from the live story read. A collection entry asked for
 * here (a president, say) is sent to its own address, the same rule the site follows. The slug is
 * checked against the slug grammar before any request (threat model T4, deep-link injection).
 */
import { Redirect, useLocalSearchParams } from 'expo-router';
import { StoryScreen } from '@/features/stories';
import { parseStorySlugParam } from '@/features/stories/story-params';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function StoryPageScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const safeSlug = parseStorySlugParam(slug);
  useEditionStackBack({
    fallbackHref: '/stories',
    accessibilityHint: 'Returns to Stories when there is no previous screen',
  });
  if (!safeSlug) return <Redirect href="/stories" />;
  return <StoryScreen slug={safeSlug} base="/stories" />;
}
