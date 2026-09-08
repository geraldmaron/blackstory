/**
 * `/stories/[slug]` — one published Story.
 *
 * The slug is validated against the catalog before any lookup happens, so an unknown slug
 * redirects to Explore rather than reaching a lookup with an unvalidated string (ADR-021
 * threat-model T4, the same convention `entity/[id].tsx` follows).
 *
 * There is no `[section]` segment any more. The address used to be
 * `/learn/{history|topics|myths}/{slug}`, which put the editorial partition in the URL and made
 * three parallel content trees out of one publication surface.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

import { ContentPageScreen, parseSectionParam, parseSlugParam } from '@/features/content';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function StoryPageScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const row = parseSectionParam('stories');
  const safeSlug = row ? parseSlugParam(slug, row) : undefined;

  useEditionStackBack({
    fallbackHref: '/stories',
    accessibilityHint: 'Returns to Stories when there is no previous screen',
  });

  if (!row || !safeSlug) {
    return <Redirect href="/explore" />;
  }

  return <ContentPageScreen section="stories" slug={safeSlug} />;
}
