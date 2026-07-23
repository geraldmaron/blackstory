/**
 * The synchronized result list (MOB-012) — accessible alternative to the map,
 * kept secondary under the metrics dashboard (expandable “Show records”).
 *
 * This is a real, interactive list of exactly what the map viewport currently
 * shows (VoiceOver/TalkBack users get "an actual list of what's visible", not a
 * "map not accessible" dead end). It is a passive follower of the map: it renders
 * `visibleFeatures` and reports scrolls via `onScroll` (which the controller
 * treats as a no-op), and it NEVER writes back to the camera on scroll — the
 * mechanism that prevents focus theft.
 *
 * Uses FlatList for virtualization so a large viewport population does not mount
 * thousands of rows at once (the 100k-point stress is device/Maestro evidence,
 * but the list is windowed here so it does not itself become the bottleneck).
 * Sheet-embedding chrome: compact "In view" header + count above the list/empty.
 */
import { useCallback } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { EmptyState, ListRow, NavIcon, navIconForEntityKind, Text, space, useThemeColors } from '@/ui';
import { featureSubtitle, type ExploreFeature } from './explore-feature';

export type ExploreListProps = {
  readonly features: readonly ExploreFeature[];
  readonly selectedId?: string;
  readonly onSelect: (feature: ExploreFeature) => void;
  /** Fired on user scroll. The controller treats this as a no-op (no camera move). */
  readonly onUserScroll?: () => void;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
};

function countLabel(count: number): string {
  if (count === 0) return 'None';
  if (count === 1) return '1 record';
  return `${count} records`;
}

export function ExploreList({
  features,
  selectedId,
  onSelect,
  onUserScroll,
  emptyTitle = 'No records in view',
  emptyDescription = 'Pan or zoom the map, or clear a filter, to see records here.',
}: ExploreListProps) {
  const theme = useThemeColors();

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ExploreFeature>) => {
      const isSelected = item.entityId === selectedId;
      return (
        <View
          style={[
            styles.rowWrap,
            isSelected ? { borderLeftColor: theme.accent, backgroundColor: theme.surfaceRaised } : undefined,
          ]}
        >
          <ListRow
            density="compact"
            title={item.label}
            subtitle={featureSubtitle(item)}
            leading={<NavIcon name={navIconForEntityKind(item.kind)} size={20} selected={isSelected} />}
            showChevron
            showDivider={index < features.length - 1}
            onPress={() => onSelect(item)}
            accessibilityLabel={`${item.label}. ${featureSubtitle(item)}${
              isSelected ? '. Selected' : ''
            }`}
          />
        </View>
      );
    },
    [features.length, onSelect, selectedId, theme.accent, theme.surfaceRaised],
  );

  return (
    <View style={styles.listRoot}>
      <View
        style={[styles.listHeader, { borderBottomColor: theme.border }]}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`In view, ${countLabel(features.length)}`}
      >
        <Text variant="code" colorRole="inkMuted">
          In view
        </Text>
        <Text variant="code" colorRole="accent">
          {countLabel(features.length)}
        </Text>
      </View>

      {features.length === 0 ? (
        <View testID="explore-list-empty" style={styles.emptyWrap}>
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </View>
      ) : (
        <FlatList
          testID="explore-list"
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
  listRoot: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space['3'],
    paddingVertical: space['2'],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptyWrap: {
    flex: 1,
  },
  rowWrap: {
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
});
