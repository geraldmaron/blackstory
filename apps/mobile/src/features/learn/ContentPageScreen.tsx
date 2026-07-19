/**
 * Full content-page screen body (MOB-015): wires `useContentPage` (real cache/connectivity) →
 * `normalizeContentPage` (allowlisted-schema defense) → `ContentRenderer` (presentation). Used by
 * both `/learn/[section]/index.tsx` (single-page sections) and `/learn/[section]/[slug].tsx`
 * (multi-page sections).
 */
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ErrorState } from '@/ui';
import { normalizeTypedContentPage } from './content-blocks';
import type { CatalogSectionId } from './content-catalog';
import { ContentRenderer } from './ContentRenderer';
import { isContentVersionStale } from './legal-version';
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
}

export function ContentPageScreen({ section, slug, currentContentVersion }: ContentPageScreenProps) {
  const state = useContentPage(section, slug);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
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
                cached={{ fetchedAt: state.fetchedAt, degraded: state.degraded }}
                versionStale={versionStale}
              />
            );
          })()
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
