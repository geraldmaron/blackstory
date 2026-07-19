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
import { ActivityIndicator, FlatList, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState, ErrorState, ListRow, Notice, Text, useThemeColors } from '@/ui';
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

  // Deep-link round trip: once the controller settles on a real query (any non-browse state
  // carries `query`), reflect it back into the route's own `q`/`kind` params so the current
  // search is shareable/restorable, without thrashing the URL on every keystroke (this only fires
  // after the debounce settles into a controller state change, not per keystroke).
  useEffect(() => {
    if (state.kind === 'browse') return;
    router.setParams({ q: state.query, ...(state.filterKind ? { kind: state.filterKind } : {}) });
  }, [state]);

  // `Date.now()` must never be called during render (React purity rule). `useState`'s lazy
  // initializer is the sanctioned exception -- it runs exactly once, at mount, which is enough
  // for an honest (if not second-by-second live) "last updated" label: the authoritative value
  // is always `state.freshness.fetchedAt` itself, this is only the "ago" wording relative to it.
  const [now] = useState(() => Date.now());

  function handlePressResult(id: string) {
    const safeId = parseEntityId(id);
    if (!safeId) return; // malformed id from an unexpected response shape -- no-op, never navigate raw.
    router.push(`/entity/${safeId}`);
  }

  const cardData = useMemo(
    () => (state.kind === 'results' ? state.results.map((r: SearchResultV1) => toSearchResultCardProps(r, handlePressResult)) : []),
    [state],
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <View style={{ padding: 16, gap: 12, flex: 1 }}>
        <Text variant="title" isHeading>
          Search
        </Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          returnKeyType="search"
          placeholder="Search names, places, events..."
          placeholderTextColor={theme.inkMuted}
          accessibilityLabel="Search"
          maxLength={MAX_RAW_INPUT_LENGTH}
          autoCorrect={false}
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: theme.ink,
          }}
        />

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
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator accessibilityLabel="Searching" />
          </View>
        ) : null}

        {state.kind === 'empty' ? (
          <EmptyState
            title="No results"
            description={
              state.degraded
                ? 'No saved results match this search while offline.'
                : 'Try a different name, place, or event.'
            }
          />
        ) : null}

        {state.kind === 'error' ? (
          <ErrorState
            title="Search failed"
            description={state.message}
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
          <View style={{ flex: 1, gap: 8 }}>
            {state.freshness.degraded ? (
              <Notice
                tone="info"
                title="Showing saved results"
                description={`Last updated ${formatRelativeTime(state.freshness.fetchedAt, now)} -- you're offline or the server is unreachable. This is not a live search.`}
              />
            ) : null}
            <FlatList
              testID="search-results-list"
              data={cardData}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <SearchResultCard {...item} />}
              ListFooterComponent={
                <SearchListFooter
                  hasMore={state.hasMore}
                  loadingMore={state.loadingMore}
                  loadMoreError={state.loadMoreError}
                  onLoadMore={loadMore}
                />
              }
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button
        label="All kinds"
        variant={filterKind === undefined ? 'primary' : 'secondary'}
        onPress={() => onChangeFilterKind(undefined)}
      />
      {BROWSE_CATEGORIES.map((category) => (
        <Button
          key={category.kind}
          label={category.label}
          variant={filterKind === category.kind ? 'primary' : 'secondary'}
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
  return (
    <View style={{ gap: 16 }}>
      {draftLength > 0 && draftLength < MIN_QUERY_LENGTH ? (
        <Text variant="bodySmall" colorRole="inkMuted">
          Keep typing to search ({MIN_QUERY_LENGTH}+ characters).
        </Text>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text variant="subtitle" isHeading>
          Browse by category
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {BROWSE_CATEGORIES.map((category) => (
            <Button
              key={category.kind}
              label={category.label}
              variant="secondary"
              onPress={() => router.push({ pathname: '/explore', params: { kind: category.kind } })}
            />
          ))}
        </View>
      </View>

      {recentSearches.length > 0 ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="subtitle" isHeading>
              Recent searches
            </Text>
            <Button label="Clear all" variant="ghost" onPress={onClearRecent} />
          </View>
          {recentSearches.map((entry) => (
            <ListRow
              key={entry.term}
              title={entry.term}
              onPress={() => onSelectRecent(entry.term)}
              trailing={<Button label="Remove" variant="ghost" onPress={() => onRemoveRecent(entry.term)} />}
              accessibilityLabel={`Search again for ${entry.term}`}
            />
          ))}
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
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <ActivityIndicator accessibilityLabel="Loading more results" />
      </View>
    );
  }
  if (loadMoreError) {
    return (
      <View style={{ paddingVertical: 16, alignItems: 'center', gap: 8 }}>
        <Text variant="bodySmall" colorRole="inkMuted">
          {loadMoreError}
        </Text>
        <Button label="Try again" variant="secondary" onPress={onLoadMore} />
      </View>
    );
  }
  if (hasMore) {
    return (
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <Button label="Load more" variant="secondary" onPress={onLoadMore} />
      </View>
    );
  }
  return null;
}
