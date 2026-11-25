/**
 * The archive as a findable list (MOB-013) — the Records tab, and the phone's home for search.
 * The legacy `/search` and `/history` routes redirect here, carrying `q`, `kind` and `era`.
 * Ledger Line: dense masthead, search + chips + results on canvas with hairline section
 * labels — no nested LiftedSurface / indexed panels.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';

import { ApiStatusBanner } from '@/ui/ApiStatusBanner';
import { Button } from '@/ui/Button';
import { Divider } from '@/ui/Divider';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { LedgerSectionLabel } from '@/ui/LedgerSectionLabel';
import { ListRow } from '@/ui/ListRow';
import { NavIcon, navIconForEntityKind } from '@/ui/NavIcon';
import { Notice } from '@/ui/Notice';
import { ScreenCanvas } from '@/ui/ScreenCanvas';
import { Text } from '@/ui/Text';
import {
  linesForFontScale,
  space,
  useAnnounceOnChange,
  useScreenScrollInsets,
  Chip,
  SearchField,
} from '@/ui';
import { parseEntityId } from '@/lib/route-params';
import { markPerf } from '@/lib/perf-marks';
import { BrowseCategoryList, showCategoryOnMap } from './BrowseCategoryList';
import { useSearch } from './useSearch';
import { MAX_RAW_INPUT_LENGTH, MIN_QUERY_LENGTH } from './query-normalization';
import { SearchResultCard, toSearchResultCardProps } from './SearchResultCard';
import { BROWSE_CATEGORIES } from './browse-categories';
import type { SearchResultV1 } from './search-contracts';
import type { SearchRuntime } from './search-runtime';

/** The Archive tab's List view. The tab draws the title and the top safe area. */
export interface SearchScreenProps {
  readonly initialQuery?: string;
  readonly initialKind?: string;
  /** Decade-bucket label (e.g. `1950s`) carried by a `/history` or `/records` deep link. */
  readonly initialEra?: string;
  readonly runtime?: SearchRuntime;
  /** Live map feature count for the active release (geo-anchored records). */
  readonly pinnedRecordCount?: number;
  readonly archiveScopeLabel?: string;
}

/** One address key for every direction of the param sync, so an echo compares equal to itself. */
function paramsKey(
  query: string | undefined,
  kind: string | undefined,
  era: string | undefined,
): string {
  return `${query ?? ''}${kind ?? ''}${era ?? ''}`;
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
  initialEra,
  runtime,
  pinnedRecordCount,
  archiveScopeLabel = 'Active release',
}: SearchScreenProps) {
  const insets = useScreenScrollInsets();
  const {
    draft,
    setDraft,
    filterKind,
    setFilterKind,
    setFilterEra,
    state,
    loadMore,
    retry,
    recentSearches,
    selectRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  } = useSearch({ initialQuery, initialKind, initialEra, runtime });

  // Reflect the SETTLED query/filter back into the route params so the deep link stays shareable
  // — but only when they actually change. The controller cycles loading→results→loading per
  // keystroke burst; writing the same params on every one of those transitions is wasted work.
  const settledQuery = 'query' in state ? state.query : undefined;
  const settledKind = 'filterKind' in state ? state.filterKind : undefined;
  const settledEra = 'filterEra' in state ? state.filterEra : undefined;
  const lastParamsRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.kind === 'browse') return;
    const key = paramsKey(settledQuery, settledKind, settledEra);
    if (lastParamsRef.current === key) return;
    lastParamsRef.current = key;
    router.setParams({
      q: settledQuery,
      ...(settledKind ? { kind: settledKind } : {}),
      ...(settledEra ? { era: settledEra } : {}),
    });
  }, [state.kind, settledQuery, settledKind, settledEra]);

  // The reverse direction. `initialQuery` / `initialKind` / `initialEra` seed state at mount only,
  // and a deep link can land on a Records tab that is already mounted — which is exactly what the
  // `/search` and `/history` redirects do. Without this the link arrives, the tab shows, and the
  // reader's query is gone: the failure those redirects exist to prevent.
  //
  // Two changes must NOT re-seed. The echo written just above is this screen's own address
  // update, and adopting it would revert a reader who has kept typing since the query settled;
  // `lastParamsRef` identifies it. An absent param is a plain tab press, and clearing the field
  // on one would lose work the reader can see.
  const incomingParamsKey = paramsKey(initialQuery, initialKind, initialEra);
  const lastIncomingParamsRef = useRef(incomingParamsKey);
  useEffect(() => {
    if (incomingParamsKey.length === 0) return;
    if (incomingParamsKey === lastIncomingParamsRef.current) return;
    lastIncomingParamsRef.current = incomingParamsKey;
    if (incomingParamsKey === lastParamsRef.current) return;
    setDraft(initialQuery ?? '');
    setFilterKind(initialKind);
    setFilterEra(initialEra);
  }, [
    incomingParamsKey,
    initialQuery,
    initialKind,
    initialEra,
    setDraft,
    setFilterKind,
    setFilterEra,
  ]);

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
      pathname: '/archive',
      params: {
        view: 'map',
        selected: safeId,
        ...(kind.trim().length > 0 ? { kind } : {}),
      },
    });
  }

  const cardData = useMemo(
    () =>
      state.kind === 'results'
        ? state.results.map((r: SearchResultV1) =>
            toSearchResultCardProps(r, {
              onPress: handlePressResult,
              onShowOnMap: handleShowOnMap,
            }),
          )
        : [],
    [state],
  );

  const showResults = state.kind === 'results';
  useEffect(() => {
    if (showResults) markPerf('search_results_shown');
  }, [showResults]);
  const showLoading = state.kind === 'loading';
  const showEmpty = state.kind === 'empty';
  const showError = state.kind === 'error';
  const showOfflineEmpty = state.kind === 'offline-empty';
  const showBrowse = state.kind === 'browse';
  const draftLength = draft.trim().length;

  // Speak the settled outcome only. `results` and `empty` are what the controller lands on after
  // its debounce; typing and loading pass null, so nothing is spoken per keystroke. The error
  // states announce themselves through `ErrorState`.
  const shownCount = cardData.length;
  useAnnounceOnChange(
    state.kind === 'results'
      ? `${shownCount} ${shownCount === 1 ? 'record' : 'records'} shown${state.hasMore ? ', more available' : ''}`
      : showEmpty
        ? 'No matching records'
        : null,
  );

  return (
    <ScreenCanvas edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: insets.paddingHorizontal,
          paddingTop: insets.paddingTop,
          paddingBottom: insets.paddingBottom,
          gap: space['3'],
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <ApiStatusBanner compact />
        <Text variant="bodySmall" colorRole="inkMuted">
          Every documented person, place, event and institution. Browse by kind, or search by name.
        </Text>

        <SearchField
          value={draft}
          onChangeText={setDraft}
          placeholder="Search names, places, events..."
          accessibilityLabel="Search"
          maxLength={MAX_RAW_INPUT_LENGTH}
        />

        {!showBrowse ? (
          <View>
            <LedgerSectionLabel>Filter by kind</LedgerSectionLabel>
            <FilterChipsRow filterKind={filterKind} onChangeFilterKind={setFilterKind} />
          </View>
        ) : null}

        {showBrowse ? (
          <BrowseModePanels
            draftLength={draftLength}
            recentSearches={recentSearches}
            pinnedRecordCount={pinnedRecordCount}
            archiveScopeLabel={archiveScopeLabel}
            onSelectCategory={setFilterKind}
            onSelectRecent={selectRecentSearch}
            onRemoveRecent={removeRecentSearch}
            onClearRecent={clearRecentSearches}
          />
        ) : null}

        {showLoading ? (
          <View>
            <LedgerSectionLabel>Working</LedgerSectionLabel>
            <View style={styles.centered}>
              <ActivityIndicator accessibilityLabel="Searching" />
            </View>
          </View>
        ) : null}

        {showEmpty ? (
          <EmptyState
            compact
            title="No matching records"
            description={
              state.degraded
                ? 'No saved results match this search while offline. Reconnect, or open Explore to browse the map.'
                : 'Try a different spelling, clear a filter, or browse the map for places nearby.'
            }
          />
        ) : null}

        {showError ? (
          <ErrorState
            compact
            title="Search could not finish"
            description={
              state.message ||
              'Something went wrong. Try again, or open Explore to browse by place.'
            }
            retry={{ label: 'Try again', onPress: retry }}
          />
        ) : null}

        {showOfflineEmpty ? (
          <ErrorState
            compact
            title="You're offline"
            description="No saved copy of this search is available yet. Reconnect and try again."
            retry={{ label: 'Try again', onPress: retry }}
          />
        ) : null}

        {showResults ? (
          <View>
            <LedgerSectionLabel ruleAbove meta={`${cardData.length} shown`}>
              Results
            </LedgerSectionLabel>
            {filterKind ? (
              <Button
                label="Show these on the map"
                variant="ghost"
                density="compact"
                onPress={() => showCategoryOnMap(filterKind)}
                accessibilityHint="Opens Explore with this kind filter applied"
              />
            ) : null}
            {state.freshness.degraded ? (
              <Notice
                tone="info"
                compact
                title="Showing saved results"
                description={`Last updated ${formatRelativeTime(state.freshness.fetchedAt, now)}. You are offline or the server is unreachable. This is not a live search.`}
              />
            ) : null}
            <View style={styles.resultsList} accessibilityRole="list" testID="search-results-list">
              {cardData.map((item, index) => (
                <SearchResultCard
                  key={item.id}
                  {...item}
                  position={{ index, total: cardData.length, partial: state.hasMore }}
                />
              ))}
              <SearchListFooter
                hasMore={state.hasMore}
                loadingMore={state.loadingMore}
                loadMoreError={state.loadMoreError}
                onLoadMore={loadMore}
              />
            </View>
          </View>
        ) : null}
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
  const { fontScale } = useWindowDimensions();
  const numberOfLines = linesForFontScale(1, fontScale);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled"
    >
      <Chip
        label="All"
        accessibilityLabel={filterKind === undefined ? 'All, selected' : 'All'}
        selected={filterKind === undefined}
        onPress={() => onChangeFilterKind(undefined)}
        numberOfLines={numberOfLines}
        style={styles.chip}
      />
      {BROWSE_CATEGORIES.map((category) => (
        <Chip
          key={category.kind}
          label={category.label}
          accessibilityLabel={
            filterKind === category.kind ? `${category.label}, selected` : category.label
          }
          iconName={navIconForEntityKind(category.kind)}
          selected={filterKind === category.kind}
          onPress={() => onChangeFilterKind(category.kind)}
          numberOfLines={numberOfLines}
          style={styles.chip}
        />
      ))}
    </ScrollView>
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
  onSelectCategory,
  onSelectRecent,
  onRemoveRecent,
  onClearRecent,
}: {
  draftLength: number;
  recentSearches: readonly { readonly term: string; readonly savedAt: number }[];
  pinnedRecordCount?: number;
  archiveScopeLabel: string;
  onSelectCategory: (kind: string) => void;
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
        <View>
          <LedgerSectionLabel meta={`${archiveScopeLabel} · ${archiveMeta}`}>
            Scale
          </LedgerSectionLabel>
        </View>
      ) : null}

      <View>
        <LedgerSectionLabel ruleAbove={Boolean(archiveMeta)}>By category</LedgerSectionLabel>
        {draftLength > 0 && draftLength < MIN_QUERY_LENGTH ? (
          <Text variant="caption" colorRole="inkMuted" style={styles.hint}>
            Keep typing to search ({MIN_QUERY_LENGTH}+ characters).
          </Text>
        ) : null}
        <BrowseCategoryList categories={BROWSE_CATEGORIES} onSelectCategory={onSelectCategory} />
      </View>

      {recentSearches.length > 0 ? (
        <View>
          <LedgerSectionLabel ruleAbove>Recent searches</LedgerSectionLabel>
          <View>
            {recentSearches.map((entry, index) => (
              <View key={entry.term}>
                <View style={styles.recentRow}>
                  <View style={styles.recentRowMain}>
                    <ListRow
                      density="compact"
                      title={entry.term}
                      leading={<NavIcon name="search" size={18} />}
                      showChevron
                      onPress={() => onSelectRecent(entry.term)}
                      accessibilityLabel={`Search again for ${entry.term}`}
                      showDivider={false}
                    />
                  </View>
                  <Button
                    label="Remove"
                    variant="ghost"
                    density="compact"
                    onPress={() => onRemoveRecent(entry.term)}
                    accessibilityLabel={`Remove ${entry.term} from recent searches`}
                  />
                </View>
                {index < recentSearches.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </View>
          <Button label="Clear all" variant="ghost" density="compact" onPress={onClearRecent} />
        </View>
      ) : (
        <View>
          <LedgerSectionLabel ruleAbove>Start searching</LedgerSectionLabel>
          <EmptyState
            compact
            title="No recent searches yet"
            description="Type a name, place, or event to search the archive."
          />
        </View>
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
  useAnnounceOnChange(loadingMore ? null : loadMoreError);
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
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
    paddingVertical: space['1'],
  },
  chip: {
    gap: 6,
    paddingHorizontal: space['2'],
  },
  hint: {
    marginBottom: space['1'],
  },
  resultsList: {
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  recentRowMain: {
    flex: 1,
  },
  centered: {
    paddingVertical: space['3'],
    alignItems: 'center',
  },
});
