/**
 * `/presidents/[slug]`: one president's entry, from the live story read. The slug is checked
 * against the slug grammar before any request (threat model T4, deep-link injection); whether it
 * exists is the server's answer, shown as an honest not-found.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';
import { StoryScreen } from '@/features/stories';
import { parseStorySlugParam } from '@/features/stories/story-params';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function PresidentRoute() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const safeSlug = parseStorySlugParam(slug);
  useEditionStackBack({
    fallbackHref: '/presidents',
    accessibilityHint: 'Returns to Presidents when there is no previous screen',
  });
  if (!safeSlug) return <Redirect href={"/presidents" as never} />;
  return <StoryScreen slug={safeSlug} base="/presidents" />;
}
