/**
 * `/learn/[section]/[slug]` (MOB-015 requirement #3). Renders one content page. Both the
 * `section` and `slug` params are validated against the known registry/catalog before any lookup
 * happens (`parseSectionParam`/`parseSlugParam`, `src/features/learn/route-guards.ts`) — an
 * unknown section or a slug that doesn't resolve to a real catalog entry under that section
 * redirects to Explore rather than attempting a lookup with an unvalidated string (MOB-008
 * threat-model T4, same convention `entity/[id].tsx` and `learn/[section]/index.tsx` follow).
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

import {
  ContentPageScreen,
  learnSectionBackFallback,
  parseSectionParam,
  parseSlugParam,
} from '@/features/learn';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function LearnContentPageScreen() {
  const { section, slug } = useLocalSearchParams<{
    section?: string | string[];
    slug?: string | string[];
  }>();
  const row = parseSectionParam(section);
  const safeSlug = row ? parseSlugParam(slug, row) : undefined;
  const fallbackHref = row ? learnSectionBackFallback(row.routeId) : '/learn';

  useEditionStackBack({
    fallbackHref,
    accessibilityHint:
      fallbackHref === '/more'
        ? 'Returns to More when there is no previous screen'
        : 'Returns to Stories when there is no previous screen',
  });

  if (!row || !safeSlug) {
    return <Redirect href="/explore" />;
  }

  return <ContentPageScreen section={row.catalogSection} slug={safeSlug} />;
}
