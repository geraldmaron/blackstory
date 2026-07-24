/**
 * History / find-in-time screen (MOB-013). Tab route at `(tabs)/history`; legacy `/search`
 * redirects here. Ledger Line: dense masthead, search + chips + results on canvas
 * with hairline section labels — no nested LiftedSurface / indexed panels.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { ApiStatusBanner } from '@/ui/ApiStatusBanner';
import { Button } from '@/ui/Button';
import { DevMenuHeaderButton } from '@/ui/DevMenuHeaderButton';
import { Divider } from '@/ui/Divider';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { LedgerSectionLabel } from '@/ui/LedgerSectionLabel';
import { ListRow } from '@/ui/ListRow';
import { NavIcon } from '@/ui/NavIcon';
import { Notice } from '@/ui/Notice';
import { ScreenCanvas } from '@/ui/ScreenCanvas';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';
import { MIN_TOUCH_TARGET, radius, space, typeScale, useScreenScrollInsets, useThemeColors } from '@/ui';
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
  const insets = useScreenScrollInsets();
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

  // Reflect the SETTLED query/filter back into the route params so the deep link stays shareable
  // — but only when they actually change. The controller cycles loading→results→loading per
  // keystroke burst; writing the same params on every one of those transitions is wasted work.
  const settledQuery = 'query' in state ? state.query : undefined;
  const settledKind = 'filterKind' in state ? state.filterKind : undefined;
  const lastParamsRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.kind === 'browse') return;
    const key = `${settledQuery ?? ''}${settledKind ?? ''}`;
    if (lastParamsRef.current === key) return;
    lastParamsRef.current = key;
    router.setParams({ q: settledQuery, ...(settledKind ? { kind: settledKind } : {}) });
  }, [state.kind, settledQuery, settledKind]);

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
        <ScreenHeader
          kicker="Find in time"
          title="History"
          dek="Search names, places, and events. Filter by kind, then open a record or show it on the map."
          compact
          dense
          trailing={typeof __DEV__ !== 'undefined' && __DEV__ ? <DevMenuHeaderButton /> : undefined}
        />

        <View
          style={[
            styles.searchField,
            { borderColor: theme.border, backgroundColor: theme.surface },
          ]}
        >
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={18} color={theme.inkMuted} accessibilityElementsHidden />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              placeholder="Search names, places, events..."
              placeholderTextColor={theme.inkMuted}
              accessibilityLabel="Search"
              accessibilityRole="search"
              maxLength={MAX_RAW_INPUT_LENGTH}
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              clearButtonMode="while-editing"
              style={[styles.input, { color: theme.ink, flex: 1 }]}
            />
            {draft.length > 0 && Platform.OS !== 'ios' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setDraft('')}
                style={({ pressed }) => [
                  styles.clearButton,
                  { backgroundColor: pressed ? theme.surfacePressed : 'transparent' },
                ]}
              >
                <Ionicons name="close-circle" size={20} color={theme.inkMuted} accessibilityElementsHidden />
              </Pressable>
            ) : null}
          </View>
        </View>

        {!showBrowse ? (
          <View>
            <LedgerSectionLabel>Kind</LedgerSectionLabel>
            <FilterChipsRow filterKind={filterKind} onChangeFilterKind={setFilterKind} />
          </View>
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
            description={state.message || 'Something went wrong. Try again, or open Explore to browse by place.'}
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
            {state.freshness.degraded ? (
              <Notice
                tone="info"
                compact
                title="Showing saved results"
                description={`Last updated ${formatRelativeTime(state.freshness.fetchedAt, now)}. You are offline or the server is unreachable. This is not a live search.`}
              />
            ) : null}
            <View style={styles.resultsList}>
              {cardData.map((item, index) => (
                <SearchResultCard
                  key={item.id}
                  {...item}
                  indexLabel={String(index + 1).padStart(2, '0')}
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
        <View>
          <LedgerSectionLabel meta={`${archiveScopeLabel} · ${archiveMeta}`}>Scale</LedgerSectionLabel>
        </View>
      ) : null}

      <View>
        <LedgerSectionLabel ruleAbove={Boolean(archiveMeta)}>By category</LedgerSectionLabel>
        {draftLength > 0 && draftLength < MIN_QUERY_LENGTH ? (
          <Text variant="caption" colorRole="inkMuted" style={styles.hint}>
            Keep typing to search ({MIN_QUERY_LENGTH}+ characters).
          </Text>
        ) : null}
        <BrowseCategoryList categories={BROWSE_CATEGORIES} />
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
  searchField: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: space['2'],
    paddingVertical: space['1'],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  input: {
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.lineHeight,
    padding: 0,
  },
  clearButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MIN_TOUCH_TARGET / 2,
    marginRight: -space['2'],
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
