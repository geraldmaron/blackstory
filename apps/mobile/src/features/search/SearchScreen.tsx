/**
 * Search feature screen (MOB-013). `apps/mobile/src/app/(tabs)/search.tsx` is a thin route
 * wrapper around this component (mirrors `apps/mobile/src/features/map/MapScreen.tsx`'s "feature
 * component, route just wires params" pattern).
 *
 * States rendered: browse (empty query -- categories + recent searches, NO network call),
 * loading, results (with pagination + an honest degraded/offline freshness banner when serving a
 * cached page), empty, error, offline-with-no-cache. See `search-controller.ts` for the state
 * machine these are driven from.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  ApiStatusBanner,
  Button,
  EmptyState,
  ErrorState,
  LiftedSurface,
  ListRow,
  NavIcon,
  navIconForEntityKind,
  Notice,
  ScreenCanvas,
  ScreenHeader,
  SectionHeader,
  Text,
  screenScrollInsets,
  space,
  useThemeColors,
} from '@/ui';
import { parseEntityId } from '../../app/_lib/route-params';
import { useSearch } from './useSearch';
import { MAX_RAW_INPUT_LENGTH, MIN_QUERY_LENGTH } from './query-normalization';
import { SearchResultCard, toSearchResultCardProps } from './SearchResultCard';
import { BROWSE_CATEGORIES } from './browse-categories';
import type { SearchResultV1 } from './search-contracts';
import type { SearchRuntime } from './search-runtime';

export interface SearchScreenProps {
  readonly initialQuery?: string;
  readonly initialKind?: string;
  /** Test-only runtime injection, threaded straight through to `useSearch`. */
  readonly runtime?: SearchRuntime;
}

function formatRelativeTime(fetchedAt: number, now: number): string {
  const diffMs = Math.max(0, now - fetchedAt);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function SearchScreen({ initialQuery, initialKind, runtime }: SearchScreenProps) {
  const theme = useThemeColors();
  const {
    draft,
    setDraft,
    filterKind,
    setFilterKind,
    state,
    loadMore,
    retry,
    recentSearches,
    selectRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  } = useSearch({ initialQuery, initialKind, runtime });

  useEffect(() => {
    if (state.kind === 'browse') return;
    router.setParams({ q: state.query, ...(state.filterKind ? { kind: state.filterKind } : {}) });
  }, [state]);

  const [now] = useState(() => Date.now());

  function handlePressResult(id: string) {
    const safeId = parseEntityId(id);
    if (!safeId) return;
    router.push(`/entity/${safeId}`);
  }

  function handleShowOnMap(id: string, kind: string) {
    const safeId = parseEntityId(id);
    if (!safeId) return;
    router.push({
      pathname: '/explore',
      params: {
        selected: safeId,
        ...(kind.trim().length > 0 ? { kind } : {}),
      },
    });
  }

  const cardData = useMemo(
    () =>
      state.kind === 'results'
        ? state.results.map((r: SearchResultV1) =>
            toSearchResultCardProps(r, { onPress: handlePressResult, onShowOnMap: handleShowOnMap }),
          )
        : [],
    [state],
  );

  return (
    <ScreenCanvas>
      <View style={styles.container}>
        <ApiStatusBanner />
        <ScreenHeader
          kicker="Records"
          title="Search"
          dek="Names, places, and events across the archive."
          compact
        />

        <LiftedSurface tone="surface" shadow="none" paddingKey="3" style={styles.searchField}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={20} color={theme.inkMuted} accessibilityElementsHidden />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              returnKeyType="search"
              placeholder="Search names, places, events..."
              placeholderTextColor={theme.inkMuted}
              accessibilityLabel="Search"
              maxLength={MAX_RAW_INPUT_LENGTH}
              autoCorrect={false}
              style={[styles.input, { color: theme.ink, flex: 1 }]}
            />
          </View>
        </LiftedSurface>

        {state.kind !== 'browse' ? (
          <FilterChipsRow filterKind={filterKind} onChangeFilterKind={setFilterKind} />
        ) : null}

        {state.kind === 'browse' ? (
          <BrowseModeView
            draftLength={draft.trim().length}
            recentSearches={recentSearches}
            onSelectRecent={selectRecentSearch}
            onRemoveRecent={removeRecentSearch}
            onClearRecent={clearRecentSearches}
          />
        ) : null}

        {state.kind === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator accessibilityLabel="Searching" />
          </View>
        ) : null}

        {state.kind === 'empty' ? (
          <EmptyState
            title="No matching records"
            description={
              state.degraded
                ? 'No saved results match this search while offline. Reconnect, or open Explore to browse the map.'
                : 'Try a different spelling, clear a filter, or browse the map for places nearby.'
            }
          />
        ) : null}

        {state.kind === 'error' ? (
          <ErrorState
            title="Search could not finish"
            description={state.message || 'Something went wrong. Try again, or open Explore to browse by place.'}
            retry={{ label: 'Try again', onPress: retry }}
          />
        ) : null}

        {state.kind === 'offline-empty' ? (
          <ErrorState
            title="You're offline"
            description="No saved copy of this search is available yet. Reconnect and try again."
            retry={{ label: 'Try again', onPress: retry }}
          />
        ) : null}

        {state.kind === 'results' ? (
          <View style={styles.resultsPane}>
            {state.freshness.degraded ? (
              <Notice
                tone="info"
                title="Showing saved results"
                description={`Last updated ${formatRelativeTime(state.freshness.fetchedAt, now)} -- you're offline or the server is unreachable. This is not a live search.`}
              />
            ) : null}
            <SectionHeader title="Results" meta={`${cardData.length} shown`} headingScale="bodyEmphasis" />
            <LiftedSurface tone="surface" shadow="none" style={styles.resultsList}>
              <FlatList
                testID="search-results-list"
                data={cardData}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <SearchResultCard {...item} indexLabel={String(index + 1).padStart(2, '0')} />
                )}
                ListFooterComponent={
                  <SearchListFooter
                    hasMore={state.hasMore}
                    loadingMore={state.loadingMore}
                    loadMoreError={state.loadMoreError}
                    onLoadMore={loadMore}
                  />
                }
              />
            </LiftedSurface>
          </View>
        ) : null}
      </View>
    </ScreenCanvas>
  );
}

function FilterChipsRow({
  filterKind,
  onChangeFilterKind,
}: {
  filterKind: string | undefined;
  onChangeFilterKind: (kind: string | undefined) => void;
}) {
  return (
    <View style={styles.chipRow}>
      <Button
        label="All kinds"
        density="compact"
        variant={filterKind === undefined ? 'primary' : 'secondary'}
        accessibilityState={filterKind === undefined ? { selected: true } : undefined}
        onPress={() => onChangeFilterKind(undefined)}
      />
      {BROWSE_CATEGORIES.map((category) => (
        <Button
          key={category.kind}
          label={category.label}
          density="compact"
          variant={filterKind === category.kind ? 'primary' : 'secondary'}
          accessibilityState={filterKind === category.kind ? { selected: true } : undefined}
          onPress={() => onChangeFilterKind(category.kind)}
        />
      ))}
    </View>
  );
}

function BrowseModeView({
  draftLength,
  recentSearches,
  onSelectRecent,
  onRemoveRecent,
  onClearRecent,
}: {
  draftLength: number;
  recentSearches: readonly { readonly term: string; readonly savedAt: number }[];
  onSelectRecent: (term: string) => void;
  onRemoveRecent: (term: string) => void;
  onClearRecent: () => void;
}) {
  const theme = useThemeColors();

  return (
    <View style={styles.browsePane}>
      {draftLength > 0 && draftLength < MIN_QUERY_LENGTH ? (
        <Text variant="bodySmall" colorRole="inkMuted">
          Keep typing to search ({MIN_QUERY_LENGTH}+ characters).
        </Text>
      ) : null}

      <View style={styles.browseSection}>
        <SectionHeader title="Browse by category" meta="Explore map" />
        <View style={styles.categoryGrid}>
          {BROWSE_CATEGORIES.map((category) => (
            <Pressable
              key={category.kind}
              accessibilityRole="button"
              accessibilityLabel={`Browse ${category.label} on the map`}
              onPress={() => router.push({ pathname: '/explore', params: { kind: category.kind } })}
              style={({ pressed }) => [{ flex: 1, minWidth: '46%', opacity: pressed ? 0.85 : 1 }]}
            >
              <LiftedSurface tone="surface" shadow="none" paddingKey="3" style={{ minHeight: 44, justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space['2'] }}>
                  <NavIcon name={navIconForEntityKind(category.kind)} size={20} />
                  <View style={{ flex: 1, gap: space['1'] }}>
                    <Text variant="bodyEmphasis">{category.label}</Text>
                    <Text variant="code" colorRole="inkMuted">
                      {category.kind}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.inkMuted} accessibilityElementsHidden />
                </View>
              </LiftedSurface>
            </Pressable>
          ))}
        </View>
      </View>

      {recentSearches.length > 0 ? (
        <View style={styles.browseSection}>
          <SectionHeader
            title="Recent searches"
            action={<Button label="Clear all" variant="ghost" density="compact" onPress={onClearRecent} />}
          />
          <LiftedSurface tone="surface" shadow="none">
            {recentSearches.map((entry, index) => (
              <ListRow
                key={entry.term}
                density="compact"
                title={entry.term}
                leading={<NavIcon name="search" size={20} />}
                showChevron
                onPress={() => onSelectRecent(entry.term)}
                trailing={
                  <Button
                    label="Remove"
                    variant="ghost"
                    density="compact"
                    onPress={() => onRemoveRecent(entry.term)}
                    accessibilityLabel={`Remove ${entry.term} from recent searches`}
                  />
                }
                accessibilityLabel={`Search again for ${entry.term}`}
                showDivider={index < recentSearches.length - 1}
              />
            ))}
          </LiftedSurface>
        </View>
      ) : (
        <EmptyState title="Search BlackStory" description="Type a name, place, or event to search." />
      )}
    </View>
  );
}

function SearchListFooter({
  hasMore,
  loadingMore,
  loadMoreError,
  onLoadMore,
}: {
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: string | undefined;
  onLoadMore: () => void;
}) {
  if (loadingMore) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator accessibilityLabel="Loading more results" />
      </View>
    );
  }
  if (loadMoreError) {
    return (
      <View style={[styles.centered, { gap: space['2'] }]}>
        <Text variant="bodySmall" colorRole="inkMuted">
          {loadMoreError}
        </Text>
        <Button label="Try again" variant="secondary" density="compact" onPress={onLoadMore} />
      </View>
    );
  }
  if (hasMore) {
    return (
      <View style={styles.centered}>
        <Button label="Load more" variant="secondary" density="compact" onPress={onLoadMore} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: screenScrollInsets.paddingHorizontal,
    paddingTop: screenScrollInsets.paddingTop,
    gap: screenScrollInsets.gap,
  },
  searchField: {
    minHeight: 44,
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
    padding: 0,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['2'],
  },
  browsePane: {
    gap: space['4'],
  },
  browseSection: {
    gap: space['2'],
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['2'],
  },
  resultsPane: {
    flex: 1,
    gap: space['2'],
  },
  resultsList: {
    flex: 1,
    overflow: 'hidden',
  },
  centered: {
    paddingVertical: space['4'],
    alignItems: 'center',
  },
});
