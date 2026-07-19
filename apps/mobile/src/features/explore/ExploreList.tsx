/**
 * The synchronized result list (MOB-012) — and the accessible, non-visual
 * alternative to the map.
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
 */
import { useCallback } from 'react';
import { FlatList, type ListRenderItemInfo, View } from 'react-native';
import { EmptyState, ListRow } from '@/ui';
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

export function ExploreList({
  features,
  selectedId,
  onSelect,
  onUserScroll,
  emptyTitle = 'No records in view',
  emptyDescription = 'Pan or zoom the map, or clear a filter, to see records here.',
}: ExploreListProps) {
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ExploreFeature>) => (
      <ListRow
        title={item.label}
        subtitle={featureSubtitle(item)}
        showDivider={index < features.length - 1}
        onPress={() => onSelect(item)}
        accessibilityLabel={`${item.label}. ${featureSubtitle(item)}${
          item.entityId === selectedId ? '. Selected' : ''
        }`}
      />
    ),
    [features.length, onSelect, selectedId],
  );

  if (features.length === 0) {
    return (
      <View testID="explore-list-empty" style={{ flex: 1 }}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </View>
    );
  }

  return (
    <FlatList
      testID="explore-list"
      accessibilityRole="list"
      accessibilityLabel="Records visible on the map"
      data={features}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      // Scroll is user-owned; report it but never translate it into a camera move.
      onScrollBeginDrag={onUserScroll}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews
    />
  );
}
