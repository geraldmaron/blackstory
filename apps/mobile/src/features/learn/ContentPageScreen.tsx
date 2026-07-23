/**
 * Full content-page screen body (MOB-015): v6 Surface edition stack with indexed intro panel
 * and raised body panel. Wires `useContentPage` through `ContentRenderer`.
 */
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { ScrollView } from 'react-native';
import {
  EditionSurfacePanel,
  EditionSurfaceStack,
  EmptyState,
  ErrorState,
  LiftedSurface,
  ScreenCanvas,
  screenScrollInsets,
} from '@/ui';
import { normalizeTypedContentPage } from './content-blocks';
import type { CatalogSectionId } from './content-catalog';
import { ContentRenderer } from './ContentRenderer';
import { isContentVersionStale } from './legal-version';
import { isLongformSection } from './story-index';
import { useContentPage } from './useContentPage';

export interface ContentPageScreenProps {
  readonly section: CatalogSectionId;
  readonly slug: string;
  readonly currentContentVersion?: string;
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
        contentContainerStyle={{
          paddingHorizontal: screenScrollInsets.paddingHorizontal,
          paddingTop: screenScrollInsets.paddingTop,
          paddingBottom: screenScrollInsets.paddingBottom,
        }}
      >
        {state.status === 'loading' ? (
          <EmptyState title="Loading…" />
        ) : state.status === 'error' ? (
          <ErrorState title="Something went wrong" description="This page could not be loaded." />
        ) : state.status === 'not-found' ? (
          <EmptyState title="Not found" description="This content is not available." />
        ) : state.status === 'offline-miss' ? (
          <ErrorState
            title="Can't load offline"
            description="This page hasn't been viewed yet, and there's no connection to fetch it now."
          />
        ) : (
          (() => {
            const { page, blocks, skippedSections } = normalizeTypedContentPage(state.value.page);
            if (!page) {
              return <ErrorState title="This page could not be displayed" />;
            }
            const versionStale = isContentVersionStale(state.value.contentVersion, currentContentVersion);
            const facts = [
              ...(page.eraLabel ? [{ key: 'era', label: 'Era', value: page.eraLabel }] : []),
              ...(page.placeLabel ? [{ key: 'where', label: 'Where', value: page.placeLabel }] : []),
            ];

            return (
              <EditionSurfaceStack>
                <EditionSurfacePanel
                  index="00"
                  kicker={longform ? 'Longform' : 'Document'}
                  title={page.title}
                  dek={page.dek}
                  compact
                />

                <EditionSurfacePanel index="01" kicker="Body" title="Read">
                  <LiftedSurface tone="surfaceRaised" shadow="none" paddingKey={longform ? '5' : '4'}>
                    <ContentRenderer
                      page={page}
                      blocks={blocks}
                      skippedSections={skippedSections}
                      sources={state.value.sources}
                      requiresCitation={state.value.requiresCitation}
                      presentation={longform ? 'longform' : 'document'}
                      cached={{ fetchedAt: state.fetchedAt, degraded: state.degraded }}
                      versionStale={versionStale}
                      headerFacts={facts}
                      hideTitle
                    />
                  </LiftedSurface>
                </EditionSurfacePanel>
              </EditionSurfaceStack>
            );
          })()
        )}
      </ScrollView>
    </ScreenCanvas>
  );
}
