/**
 * Full content-page screen body (MOB-015): Ledger Line canvas masthead + flat
 * article body (no indexed Surface stack, no nested card around prose).
 */
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  ScreenCanvas,
  ScreenHeader,
  screenScrollInsets,
  space,
  useThemeColors,
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

/** Title/3-paragraph skeleton shown while the page loads — a shape hint, not a spinner glyph. */
function ContentPageSkeleton() {
  const theme = useThemeColors();
  const bar = (widthPct: number, height: number, extra?: object) => (
    <View
      style={[
        styles.skeletonBar,
        { backgroundColor: theme.surfaceRaised, borderColor: theme.border, width: `${widthPct}%`, height },
        extra,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
  return (
    <View accessibilityLabel="Loading story" accessibilityRole="progressbar">
      <View style={styles.skeletonTitleBlock}>
        {bar(80, 24)}
        {bar(55, 24)}
      </View>
      {[0, 1, 2].map((paragraph) => (
        <View key={paragraph} style={styles.skeletonParagraph}>
          {bar(100, 14)}
          {bar(96, 14)}
          {bar(88, 14)}
          {bar(paragraph === 2 ? 40 : 70, 14)}
        </View>
      ))}
    </View>
  );
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
      ? normalizeTypedContentPage(state.value.page).page?.title ?? fallbackTitle
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
          gap: space['3'],
        }}
      >
        {state.status === 'loading' ? (
          <ContentPageSkeleton />
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
              <>
                <ScreenHeader
                  kicker={longform ? 'Longform' : 'Document'}
                  title={page.title}
                  dek={page.dek}
                  compact
                  dense
                />
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
              </>
            );
          })()
        )}
      </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  skeletonTitleBlock: {
    gap: space['2'],
    marginBottom: space['6'],
  },
  skeletonParagraph: {
    gap: space['2'],
    marginBottom: space['5'],
  },
  skeletonBar: {
    borderRadius: space['1'],
    borderWidth: StyleSheet.hairlineWidth,
  },
});
