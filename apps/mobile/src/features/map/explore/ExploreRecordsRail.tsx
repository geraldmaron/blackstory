/**
 * v6 Explore records rail — primary bottom-sheet browse surface with hairline rows,
 * copper left rule on selection, and EditionFactCell meta strips (web result list).
 */
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { EmptyState, RecordFactStrip, Text, space, useThemeColors } from '@/ui';
import { exploreContentInset } from './explore-chrome';
import type { ExploreFeature } from '@/features/explore/explore-feature';
import { exploreRecordFacts } from './explore-preview-facts';

export type ExploreRecordsRailProps = {
  readonly features: readonly ExploreFeature[];
  readonly selectedId?: string;
  readonly scopeLabel?: string;
  readonly onSelect: (feature: ExploreFeature) => void;
  readonly onUserScroll?: () => void;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly testID?: string;
};

function countLabel(count: number): string {
  if (count === 0) return 'None';
  if (count === 1) return '1 record';
  return `${count} records`;
}

function RecordRow({
  feature,
  selected,
  onPress,
  showDivider,
}: {
  readonly feature: ExploreFeature;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly showDivider: boolean;
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
      {showDivider ? null : null}
    </Pressable>
  );
}

export function ExploreRecordsRail({
  features,
  selectedId,
  scopeLabel = 'In view',
  onSelect,
  onUserScroll,
  emptyTitle = 'No records in view',
  emptyDescription = 'Pan or zoom the map, or clear a filter, to see records here.',
  testID = 'explore-records-rail',
}: ExploreRecordsRailProps) {
  const theme = useThemeColors();

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ExploreFeature>) => (
      <RecordRow
        feature={item}
        selected={item.entityId === selectedId}
        onPress={() => onSelect(item)}
        showDivider={index < features.length - 1}
      />
    ),
    [features.length, onSelect, selectedId],
  );

  return (
    <View style={styles.root} testID={testID}>
      <View
        style={[styles.header, { borderBottomColor: theme.border }]}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${scopeLabel}, ${countLabel(features.length)}`}
      >
        <Text variant="code" colorRole="inkMuted">
          {scopeLabel}
        </Text>
        <Text variant="code" colorRole="accent">
          {countLabel(features.length)}
        </Text>
      </View>

      {features.length === 0 ? (
        <View testID="explore-records-empty" style={styles.emptyWrap}>
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </View>
      ) : (
        <FlatList
          testID="explore-records-list"
          accessibilityRole="list"
          accessibilityLabel="Records visible on the map"
          data={features}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onScrollBeginDrag={onUserScroll}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </View>
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
    paddingHorizontal: exploreContentInset,
    paddingVertical: space['2'],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptyWrap: {
    flex: 1,
  },
  row: {
    borderLeftWidth: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: exploreContentInset,
    paddingVertical: space['2'],
    gap: space['2'],
  },
  rowTitle: {
    flexShrink: 1,
  },
});
