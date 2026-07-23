/**
 * Full content-page screen body (MOB-015): wires `useContentPage` (real cache/connectivity) →
 * `normalizeContentPage` (allowlisted-schema defense) → `ContentRenderer` (presentation). Used by
 * both `/learn/[section]/index.tsx` (single-page sections) and `/learn/[section]/[slug].tsx`
 * (multi-page sections). Sets the stack `headerTitle` from the page title — never a route pattern.
 */
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { ScrollView } from 'react-native';
import { EmptyState, ErrorState, ScreenCanvas, space } from '@/ui';
import { normalizeTypedContentPage } from './content-blocks';
import type { CatalogSectionId } from './content-catalog';
import { ContentRenderer } from './ContentRenderer';
import { isContentVersionStale } from './legal-version';
import { isLongformSection } from './story-index';
import { useContentPage } from './useContentPage';

export interface ContentPageScreenProps {
  readonly section: CatalogSectionId;
  readonly slug: string;
  /**
   * The most recently known bootstrap content-version, when available. `undefined` today (see
   * `legal-version.ts`'s doc comment — no live endpoint exposes this to mobile yet); left as an
   * explicit prop so wiring a real bootstrap-derived value later is a call-site change, not a
   * screen rewrite.
   */
  readonly currentContentVersion?: string;
  /** Fallback stack title while loading / on error (e.g. "Story", "Methodology"). */
  readonly fallbackTitle?: string;
}

function compactHeaderTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= 36) return trimmed;
  return `${trimmed.slice(0, 33).trimEnd()}…`;
}

export function ContentPageScreen({
  section,
  slug,
  currentContentVersion,
  fallbackTitle = 'Story',
}: ContentPageScreenProps) {
  const navigation = useNavigation();
  const state = useContentPage(section, slug);
  const longform = isLongformSection(section);

  const resolvedTitle =
    state.status === 'ok'
      ? compactHeaderTitle(normalizeTypedContentPage(state.value.page).page?.title ?? fallbackTitle)
      : fallbackTitle;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: resolvedTitle,
      headerTitle: resolvedTitle,
      headerBackTitle: 'Stories',
      headerLargeTitle: false,
      headerBackButtonDisplayMode: 'minimal',
    });
  }, [navigation, resolvedTitle]);

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={
          longform
            ? { paddingHorizontal: space['5'], paddingVertical: space['6'], paddingBottom: space['12'] }
            : { padding: space['4'] }
        }
      >
        {state.status === 'loading' ? (
          <EmptyState title="Loading…" />
        ) : state.status === 'error' ? (
          <ErrorState title="Something went wrong" description="This page could not be loaded." />
        ) : state.status === 'not-found' ? (
          <EmptyState title="Not found" description="This content is not available." />
        ) : state.status === 'offline-miss' ? (
          <ErrorState
            title="Can't load — offline"
            description="This page hasn't been viewed yet, and there's no connection to fetch it now."
          />
        ) : (
          (() => {
            const { page, blocks, skippedSections } = normalizeTypedContentPage(state.value.page);
            if (!page) {
              return <ErrorState title="This page could not be displayed" />;
            }
            const versionStale = isContentVersionStale(state.value.contentVersion, currentContentVersion);
            return (
              <ContentRenderer
                page={page}
                blocks={blocks}
                skippedSections={skippedSections}
                sources={state.value.sources}
                requiresCitation={state.value.requiresCitation}
                presentation={longform ? 'longform' : 'document'}
                cached={{ fetchedAt: state.fetchedAt, degraded: state.degraded }}
                versionStale={versionStale}
              />
            );
          })()
        )}
      </ScrollView>
    </ScreenCanvas>
  );
}
