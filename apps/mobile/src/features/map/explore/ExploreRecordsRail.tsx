/**
 * Explore records rail — Pin Pulse browse list: kind glyph, title, one caption
 * (where · era). Copper left rule on selection. BottomSheetFlatList owns scroll.
 */
import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import {
  NavIcon,
  navIconForEntityKind,
  Text,
  space,
  radius,
  useThemeColors,
  MIN_TOUCH_TARGET,
} from '@/ui';
import { exploreContentInset } from './explore-chrome';
import type { ExploreFeature } from '@/features/explore/explore-feature';
import type { FilterState } from '@/lib/route-params';
import { exploreStoryMeta } from './explore-story-meta';
import { formatExploreCountLabel } from './explore-count-label';

export type ExploreRecordsRailProps = {
  readonly features: readonly ExploreFeature[];
  readonly selectedId?: string;
  /** "Nearby" once the map reports a region; "All pinned" before that. */
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

const RecordRow = memo(function RecordRow({
  feature,
  selected,
  onSelect,
}: {
  readonly feature: ExploreFeature;
  readonly selected: boolean;
  readonly onSelect: (feature: ExploreFeature) => void;
}) {
  const theme = useThemeColors();
  const story = exploreStoryMeta(feature);
  const a11yMeta = [story.caption, story.evidence].filter(Boolean).join('. ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${feature.label}${a11yMeta ? `. ${a11yMeta}` : ''}${
        selected ? '. Selected' : ''
      }`}
      onPress={() => onSelect(feature)}
      style={({ pressed }) => [
        styles.row,
        {
          borderLeftColor: selected ? theme.accent : 'transparent',
          backgroundColor: pressed ? theme.surfaceRaised : theme.surface,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <View style={[styles.kindGlyph, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
        <NavIcon name={navIconForEntityKind(feature.kind)} size={18} selected={selected} />
      </View>
      <View style={styles.rowText}>
        <Text variant="rowTitle" numberOfLines={1} style={styles.rowTitle}>
          {feature.label}
        </Text>
        {story.caption ? (
          <Text variant="caption" colorRole="inkMuted" numberOfLines={1}>
            {story.caption}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={selected ? theme.accent : theme.inkSubtle}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
});

export function ExploreRecordsRail({
  features,
  selectedId,
  scopeLabel = 'Nearby',
  releaseCount,
  filters = {},
  onSelect,
  onUserScroll,
  emptyTitle = 'No places nearby',
  emptyDescription = 'Pan or zoom the map, or clear a filter, to see pins here.',
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
        onSelect={onSelect}
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
        <View style={styles.inviteRow}>
          <Ionicons
            name="chevron-up"
            size={14}
            color={theme.accent}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Ionicons
            name="location-outline"
            size={14}
            color={theme.inkMuted}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Text variant="code" colorRole="inkMuted">
            Pull up for places
          </Text>
        </View>
      </View>
    ),
    [headerCount.accessibilityLabel, theme.accent, theme.border, theme.inkMuted],
  );

  const listEmpty = useMemo(
    () => (
      <View testID="explore-records-empty" style={styles.emptyWrap}>
        <View
          style={[styles.emptyGlyph, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons name="map-outline" size={22} color={theme.inkMuted} />
        </View>
        <Text variant="subtitle" style={styles.emptyTitle}>
          {emptyTitle}
        </Text>
        <Text variant="body" colorRole="inkMuted" style={styles.emptyDescription}>
          {emptyDescription}
        </Text>
      </View>
    ),
    [emptyDescription, emptyTitle, theme.border, theme.inkMuted, theme.surfaceRaised],
  );

  return (
    <BottomSheetFlatList
      style={styles.root}
      testID={testID}
      accessibilityRole="list"
      accessibilityLabel="Places visible on the map"
      data={features}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      onScrollBeginDrag={onUserScroll}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      windowSize={7}
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
    minHeight: MIN_TOUCH_TARGET,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
  },
  emptyWrap: {
    flexGrow: 1,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: exploreContentInset,
    paddingVertical: space['4'],
    gap: space['2'],
  },
  emptyGlyph: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space['1'],
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyDescription: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
    borderLeftWidth: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: exploreContentInset,
    paddingVertical: space['2'],
    minHeight: MIN_TOUCH_TARGET,
  },
  kindGlyph: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowTitle: {
    flexShrink: 1,
  },
});
