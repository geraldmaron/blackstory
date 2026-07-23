/**
 * v6 Explore records rail — primary bottom-sheet browse surface with hairline rows,
 * copper left rule on selection, and EditionFactCell meta strips (web result list).
 *
 * Uses BottomSheetFlatList (not RN FlatList) so the list is the sheet's scroll
 * owner: half/full browse avoids nested-scroll clipping and gesture fights with
 * the gorhom sheet. Header rides as ListHeaderComponent.
 */
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { EmptyState, RecordFactStrip, Text, space, useThemeColors } from '@/ui';
import { exploreContentInset } from './explore-chrome';
import type { ExploreFeature } from '@/features/explore/explore-feature';
import type { FilterState } from '@/lib/route-params';
import { exploreRecordFacts } from './explore-preview-facts';
import { formatExploreCountLabel } from './explore-count-label';

export type ExploreRecordsRailProps = {
  readonly features: readonly ExploreFeature[];
  readonly selectedId?: string;
  readonly scopeLabel?: string;
  /** Full loaded release total for dual count copy when viewport-scoped. */
  readonly releaseCount?: number;
  readonly filters?: FilterState;
  readonly onSelect: (feature: ExploreFeature) => void;
  readonly onUserScroll?: () => void;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly testID?: string;
};

function RecordRow({
  feature,
  selected,
  onPress,
}: {
  readonly feature: ExploreFeature;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const theme = useThemeColors();
  const facts = exploreRecordFacts(feature);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${feature.label}. ${facts.map((f) => `${f.label}: ${f.value}`).join('. ')}${
        selected ? '. Selected' : ''
      }`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderLeftColor: selected ? theme.accent : 'transparent',
          backgroundColor: pressed ? theme.surfaceRaised : theme.surface,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Text variant="bodyEmphasis" numberOfLines={2} style={styles.rowTitle}>
        {feature.label}
      </Text>
      <RecordFactStrip facts={facts} />
    </Pressable>
  );
}

export function ExploreRecordsRail({
  features,
  selectedId,
  scopeLabel = 'In view',
  releaseCount,
  filters = {},
  onSelect,
  onUserScroll,
  emptyTitle = 'No records in view',
  emptyDescription = 'Pan or zoom the map, or clear a filter, to see records here.',
  testID = 'explore-records-rail',
}: ExploreRecordsRailProps) {
  const theme = useThemeColors();
  const headerCount = formatExploreCountLabel({
    inViewCount: features.length,
    releaseCount: releaseCount ?? features.length,
    scopeLabel,
    filters,
  });

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ExploreFeature>) => (
      <RecordRow
        feature={item}
        selected={item.entityId === selectedId}
        onPress={() => onSelect(item)}
      />
    ),
    [onSelect, selectedId],
  );

  const listHeader = useMemo(
    () => (
      <View
        style={[styles.header, { borderBottomColor: theme.border }]}
        accessible
        accessibilityRole="header"
        accessibilityLabel={headerCount.accessibilityLabel}
      >
        <Text variant="code" colorRole="inkMuted">
          {scopeLabel}
        </Text>
        <Text variant="code" colorRole="accent" numberOfLines={1} style={styles.headerCount}>
          {headerCount.railInline}
        </Text>
      </View>
    ),
    [headerCount.accessibilityLabel, headerCount.railInline, scopeLabel, theme.border],
  );

  const listEmpty = useMemo(
    () => (
      <View testID="explore-records-empty" style={styles.emptyWrap}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </View>
    ),
    [emptyDescription, emptyTitle],
  );

  return (
    <BottomSheetFlatList
      style={styles.root}
      testID={testID}
      accessibilityRole="list"
      accessibilityLabel="Records visible on the map"
      data={features}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      onScrollBeginDrag={onUserScroll}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['2'],
    paddingHorizontal: exploreContentInset,
    paddingVertical: space['2'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  headerCount: {
    flexShrink: 1,
    textAlign: 'right',
  },
  emptyWrap: {
    flexGrow: 1,
    minHeight: 120,
  },
  row: {
    borderLeftWidth: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: exploreContentInset,
    paddingVertical: space['3'],
    gap: space['2'],
    minHeight: 44,
  },
  rowTitle: {
    flexShrink: 1,
  },
});
