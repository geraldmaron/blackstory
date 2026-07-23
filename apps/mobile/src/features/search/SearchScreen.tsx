/**
 * History / find-in-time screen (MOB-013). Tab route at `(tabs)/history`; legacy `/search`
 * redirects here. v6 Surface edition: dense masthead, continuous browse sections,
 * rip-list results with RecordFactStrip against the live search API.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { ApiStatusBanner } from '@/ui/ApiStatusBanner';
import { Button } from '@/ui/Button';
import { DevMenuHeaderButton } from '@/ui/DevMenuHeaderButton';
import { EditionSurfacePanel } from '@/ui/EditionSurfacePanel';
import { EditionSurfaceStack } from '@/ui/EditionSurfaceStack';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { LiftedSurface } from '@/ui/LiftedSurface';
import { ListRow } from '@/ui/ListRow';
import { NavIcon } from '@/ui/NavIcon';
import { Notice } from '@/ui/Notice';
import { ScreenCanvas, screenScrollInsets } from '@/ui/ScreenCanvas';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { SectionHeader } from '@/ui/SectionHeader';
import { Text } from '@/ui/Text';
import { space, useThemeColors } from '@/ui/tokens';
import { parseEntityId } from '@/lib/route-params';
import { BrowseCategoryList } from './BrowseCategoryList';
import { useSearch } from './useSearch';
import { MAX_RAW_INPUT_LENGTH, MIN_QUERY_LENGTH } from './query-normalization';
import { SearchResultCard, toSearchResultCardProps } from './SearchResultCard';
import { BROWSE_CATEGORIES } from './browse-categories';
import type { SearchResultV1 } from './search-contracts';
import type { SearchRuntime } from './search-runtime';

export interface SearchScreenProps {
  readonly initialQuery?: string;
  readonly initialKind?: string;
  readonly runtime?: SearchRuntime;
  /** Live map feature count for the active release (geo-anchored records). */
  readonly pinnedRecordCount?: number;
  readonly archiveScopeLabel?: string;
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

export function SearchScreen({
  initialQuery,
  initialKind,
  runtime,
  pinnedRecordCount,
  archiveScopeLabel = 'Active release',
}: SearchScreenProps) {
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

  const showResults = state.kind === 'results';
  const showLoading = state.kind === 'loading';
  const showEmpty = state.kind === 'empty';
  const showError = state.kind === 'error';
  const showOfflineEmpty = state.kind === 'offline-empty';
  const showBrowse = state.kind === 'browse';
  const draftLength = draft.trim().length;

  return (
    <ScreenCanvas>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.page}>
        <ApiStatusBanner compact />
        <ScreenHeader
          kicker="Find in time"
          title="History"
          dek="Search names, places, and events. Filter by kind, then open a record or show it on the map."
          compact
          dense
          trailing={typeof __DEV__ !== 'undefined' && __DEV__ ? <DevMenuHeaderButton /> : undefined}
        />

        <LiftedSurface tone="surfaceRaised" shadow="none" paddingKey="2" style={styles.searchField}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={18} color={theme.inkMuted} accessibilityElementsHidden />
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

        <EditionSurfaceStack dense>
          {!showBrowse ? (
            <EditionSurfacePanel index="01" kicker="Filter" title="Kind" compact dense>
              <FilterChipsRow filterKind={filterKind} onChangeFilterKind={setFilterKind} />
            </EditionSurfacePanel>
          ) : null}

          {showBrowse ? (
            <BrowseModePanels
              draftLength={draftLength}
              recentSearches={recentSearches}
              pinnedRecordCount={pinnedRecordCount}
              archiveScopeLabel={archiveScopeLabel}
              onSelectRecent={selectRecentSearch}
              onRemoveRecent={removeRecentSearch}
              onClearRecent={clearRecentSearches}
            />
          ) : null}

          {showLoading ? (
            <EditionSurfacePanel index="02" kicker="Search" title="Working" compact dense>
              <View style={styles.centered}>
                <ActivityIndicator accessibilityLabel="Searching" />
              </View>
            </EditionSurfacePanel>
          ) : null}

          {showEmpty ? (
            <EditionSurfacePanel index="02" kicker="Results" title="No matches" compact dense>
              <EmptyState
                title="No matching records"
                description={
                  state.degraded
                    ? 'No saved results match this search while offline. Reconnect, or open Explore to browse the map.'
                    : 'Try a different spelling, clear a filter, or browse the map for places nearby.'
                }
              />
            </EditionSurfacePanel>
          ) : null}

          {showError ? (
            <EditionSurfacePanel index="02" kicker="Search" title="Could not finish" compact dense>
              <ErrorState
                title="Search could not finish"
                description={state.message || 'Something went wrong. Try again, or open Explore to browse by place.'}
                retry={{ label: 'Try again', onPress: retry }}
              />
            </EditionSurfacePanel>
          ) : null}

          {showOfflineEmpty ? (
            <EditionSurfacePanel index="02" kicker="Offline" title="No saved copy" compact dense>
              <ErrorState
                title="You're offline"
                description="No saved copy of this search is available yet. Reconnect and try again."
                retry={{ label: 'Try again', onPress: retry }}
              />
            </EditionSurfacePanel>
          ) : null}

          {showResults ? (
            <EditionSurfacePanel
              index="02"
              kicker="Archive"
              title="Results"
              panelMeta={`${cardData.length} shown`}
              compact
              dense
            >
              {state.freshness.degraded ? (
                <Notice
                  tone="info"
                  compact
                  title="Showing saved results"
                  description={`Last updated ${formatRelativeTime(state.freshness.fetchedAt, now)}. You are offline or the server is unreachable. This is not a live search.`}
                />
              ) : null}
              <LiftedSurface tone="surfaceRaised" shadow="none" paddingKey="0" style={styles.resultsList}>
                <FlatList
                  testID="search-results-list"
                  scrollEnabled={false}
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
            </EditionSurfacePanel>
          ) : null}
        </EditionSurfaceStack>
        </View>
      </ScrollView>
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

function formatArchiveCount(count: number): string {
  return count.toLocaleString('en-US');
}

function BrowseModePanels({
  draftLength,
  recentSearches,
  pinnedRecordCount,
  archiveScopeLabel,
  onSelectRecent,
  onRemoveRecent,
  onClearRecent,
}: {
  draftLength: number;
  recentSearches: readonly { readonly term: string; readonly savedAt: number }[];
  pinnedRecordCount?: number;
  archiveScopeLabel: string;
  onSelectRecent: (term: string) => void;
  onRemoveRecent: (term: string) => void;
  onClearRecent: () => void;
}) {
  const archiveMeta =
    pinnedRecordCount != null && pinnedRecordCount > 0
      ? `${formatArchiveCount(pinnedRecordCount)} records pinned on the map`
      : undefined;

  return (
    <>
      {archiveMeta ? (
        <EditionSurfacePanel
          index="01"
          kicker="Archive"
          title="Scale"
          panelMeta={`${archiveScopeLabel} · ${archiveMeta}`}
          compact
          dense
        />
      ) : null}

      <LiftedSurface tone="surface" shadow="none" paddingKey="2">
        <SectionHeader
          title="By category"
          meta="Browse · Explore map"
          headingScale="bodyEmphasis"
        />
        {draftLength > 0 && draftLength < MIN_QUERY_LENGTH ? (
          <Text variant="caption" colorRole="inkMuted" style={styles.hint}>
            Keep typing to search ({MIN_QUERY_LENGTH}+ characters).
          </Text>
        ) : null}
        <BrowseCategoryList categories={BROWSE_CATEGORIES} />
      </LiftedSurface>

      {recentSearches.length > 0 ? (
        <LiftedSurface tone="surface" shadow="none" paddingKey="2">
          <SectionHeader title="Recent searches" meta="Search" headingScale="bodyEmphasis" />
          {recentSearches.map((entry, index) => (
            <ListRow
              key={entry.term}
              density="compact"
              title={entry.term}
              leading={<NavIcon name="search" size={18} />}
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
          <Button label="Clear all" variant="ghost" density="compact" onPress={onClearRecent} />
        </LiftedSurface>
      ) : (
        <LiftedSurface tone="surface" shadow="none" paddingKey="2">
          <SectionHeader title="Start searching" meta="Search" headingScale="bodyEmphasis" />
          <EmptyState
            title="No recent searches yet"
            description="Type a name, place, or event to search the archive."
          />
        </LiftedSurface>
      )}
    </>
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
  scrollContent: {
    flexGrow: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: screenScrollInsets.paddingHorizontal,
    paddingTop: screenScrollInsets.paddingTop,
    paddingBottom: screenScrollInsets.paddingBottom,
    gap: space['3'],
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
  hint: {
    marginBottom: space['1'],
  },
  resultsList: {
    overflow: 'hidden',
  },
  centered: {
    paddingVertical: space['3'],
    alignItems: 'center',
  },
});
