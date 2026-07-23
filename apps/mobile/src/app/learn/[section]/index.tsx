/**
 * `/learn/[section]` (MOB-015 requirement #3). Resolves the `section` route param against the
 * known registry (`src/features/learn/sections.ts`) — never a raw dispatch on the incoming
 * string. Two shapes, depending on the section:
 *
 *   - Single-page section (`directSlug` set, e.g. Methodology, About, Privacy, Errata, Quick
 *     facts): renders that page directly here — no extra "pick a page" hop.
 *   - Multi-page section (History, Topics, Myths, Legal): lists its catalog entries as rows that
 *     push `/learn/[section]/[slug]`.
 *
 * An unknown/malformed `section` param redirects to Explore (the app's safe-default route),
 * mirroring `entity/[id].tsx`'s "never crash on hostile input, always fall back to a safe
 * default" convention (MOB-008 threat-model T4).
 */
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { ContentPageScreen, SectionListScreen, StorySectionIndexScreen, isLongformSection, listCatalogEntries, parseSectionParam } from '@/features/learn';

export default function LearnSectionIndexScreen() {
  const { section } = useLocalSearchParams<{ section?: string | string[] }>();
  const row = parseSectionParam(section);

  if (!row) {
    return <Redirect href="/explore" />;
  }

  if (row.directSlug) {
    return <ContentPageScreen section={row.catalogSection} slug={row.directSlug} />;
  }

  const entries = listCatalogEntries(row.catalogSection);

  if (isLongformSection(row.catalogSection)) {
    return <StorySectionIndexScreen section={row} />;
  }

  return (
    <SectionListScreen
      title={row.title}
      intro={row.subtitle}
      rows={entries.map((entry) => ({
        key: entry.page.slug,
        title: entry.page.title,
        subtitle: entry.page.dek,
        onPress: () => router.push(`/learn/${row.routeId}/${entry.page.slug}` as never),
      }))}
    />
  );
}
