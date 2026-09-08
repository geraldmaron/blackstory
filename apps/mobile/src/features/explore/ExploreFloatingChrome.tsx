/**
 * v7 Explore floating chrome over the full-bleed map: Pin Pulse mast (copper count
 * chip + ghost icon affordances). Map dominates first glance — no opaque Surface slab.
 * Copper accent on the count chip and active filters (~10–15% copper budget).
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text, space, radius, MIN_TOUCH_TARGET, Z_LAYER } from '@/ui';
import { hasActiveFilters, type FilterState } from '@/lib/route-params';
import {
  exploreContentInset,
  useExploreChromeColors,
  MAP_GHOST_PRESSED,
} from './explore-chrome';
import { formatExploreCountLabel } from './explore-count-label';
import { activeFilterCount } from './active-filter-chips';
import {
  shouldShowSparseViewportCoach,
  SPARSE_VIEWPORT_COACH_COPY,
} from './sparse-viewport-coach';

const ICON_SIZE = 18;
const GHOST_SIZE = MIN_TOUCH_TARGET;

export type ExploreFloatingChromeProps = {
  /** Viewport-scoped visible count — same source as the records rail list. */
  readonly inViewCount: number;
  /** Full loaded release total (geo-anchored features in the active source). */
  readonly releaseCount: number;
  /** "Nearby" once the map reports a region; "All pinned" before that. */
  readonly scopeLabel: string;
  readonly filters: FilterState;
  readonly showDemoHint?: boolean;
  readonly instrumentsOpen?: boolean;
  readonly recordsExpanded?: boolean;
  readonly onToggleInstruments: () => void;
  readonly onToggleRecords?: () => void;
  readonly onNationalView: () => void;
  readonly onOpenSearch?: () => void;
  /** Reports the mast's laid-out height so the host can offset overlays below it. */
  readonly onLayout?: (event: LayoutChangeEvent) => void;
  /** @deprecated Modal route fallback — prefer in-map instruments panel. */
  readonly onOpenFilters?: () => void;
  /** @deprecated Modal route fallback — prefer in-map instruments panel. */
  readonly onOpenColorKey?: () => void;
};

function GhostIconButton({
  icon,
  accessibilityLabel,
  onPress,
  selected,
  badgeCount,
  testID,
  chrome,
}: {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly selected?: boolean;
  readonly badgeCount?: number;
  readonly testID?: string;
  readonly chrome: ReturnType<typeof useExploreChromeColors>;
}) {
  const showBadge = typeof badgeCount === 'number' && badgeCount > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.ghostBtn,
        {
          backgroundColor: selected
            ? chrome.mapGhostActive
            : pressed
              ? MAP_GHOST_PRESSED
              : chrome.mapGhostBg,
          borderColor: selected ? chrome.mapAccent : chrome.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={ICON_SIZE}
        color={selected ? chrome.mapAccent : chrome.mapInkMuted}
      />
      {showBadge ? (
        <View
          style={[styles.filterBadge, { backgroundColor: chrome.mapAccent }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID={`${testID ?? 'ghost'}-badge`}
        >
          <Text variant="code" style={[styles.filterBadgeText, { color: chrome.mapInk }]}>
            {badgeCount > 9 ? '9+' : String(badgeCount)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ExploreFloatingChrome({
  inViewCount,
  releaseCount,
  scopeLabel,
  filters,
  showDemoHint = false,
  instrumentsOpen = false,
  recordsExpanded = false,
  onToggleInstruments,
  onToggleRecords,
  onNationalView,
  onOpenSearch,
  onLayout,
}: ExploreFloatingChromeProps) {
  const chrome = useExploreChromeColors();
  const filtersActive = hasActiveFilters(filters);
  const filterCount = activeFilterCount(filters);
  const countLabel = formatExploreCountLabel({
    inViewCount,
    releaseCount,
    scopeLabel,
    filters,
    showDemoHint,
  });
  const showSparseCoach = shouldShowSparseViewportCoach({ inViewCount, releaseCount });

  return (
    <View
      style={styles.overlay}
      pointerEvents="box-none"
      testID="explore-floating-chrome"
      onLayout={onLayout}
    >
      <View style={styles.mastRow} pointerEvents="box-none">
        <View
          style={[
            styles.countChip,
            {
              backgroundColor: 'transparent',
              borderColor: chrome.mapAccent,
            },
          ]}
          accessible
          accessibilityRole="text"
          accessibilityLabel={countLabel.accessibilityLabel}
          testID="explore-mast-count"
        >
          <Ionicons
            name="location"
            size={ICON_SIZE}
            color={chrome.mapAccent}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Text
            variant="caption"
            numberOfLines={1}
            style={[styles.countInline, { color: chrome.mapAccent }]}
          >
            {countLabel.railInline}
          </Text>
        </View>

        <View style={styles.actions}>
          <GhostIconButton
            icon="search-outline"
            accessibilityLabel="Open search"
            onPress={() => onOpenSearch?.()}
            testID="explore-chip-search"
            chrome={chrome}
          />
          <GhostIconButton
            icon="options-outline"
            accessibilityLabel={
              instrumentsOpen
                ? 'Hide map instruments'
                : filtersActive
                  ? `Map instruments, ${filterCount} filter${filterCount === 1 ? '' : 's'} active`
                  : 'Open map filters'
            }
            onPress={onToggleInstruments}
            selected={instrumentsOpen || filtersActive}
            badgeCount={filtersActive && !instrumentsOpen ? filterCount : undefined}
            testID="explore-chip-instruments"
            chrome={chrome}
          />
          <GhostIconButton
            icon="list-outline"
            accessibilityLabel={
              recordsExpanded ? 'Collapse records rail' : 'Expand records rail'
            }
            onPress={() => onToggleRecords?.()}
            selected={recordsExpanded}
            testID="explore-chip-records"
            chrome={chrome}
          />
          <GhostIconButton
            icon="globe-outline"
            accessibilityLabel="Reset to national view"
            onPress={onNationalView}
            testID="explore-chip-national"
            chrome={chrome}
          />
        </View>
      </View>

      {showSparseCoach ? (
        <View
          style={[
            styles.sparseCoach,
            {
              borderColor: chrome.border,
              backgroundColor: chrome.mapGhostBg,
            },
          ]}
          accessible
          accessibilityRole="text"
          accessibilityLabel={SPARSE_VIEWPORT_COACH_COPY}
          testID="explore-sparse-viewport-coach"
        >
          <Text
            variant="caption"
            numberOfLines={2}
            style={[styles.sparseCoachText, { color: chrome.mapInkMuted }]}
          >
            {SPARSE_VIEWPORT_COACH_COPY}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: space['1'],
    left: 0,
    right: 0,
    zIndex: Z_LAYER.overlay,
    paddingHorizontal: exploreContentInset,
  },
  mastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['2'],
    minHeight: MIN_TOUCH_TARGET,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
    flexShrink: 1,
    paddingHorizontal: space['2'],
    paddingVertical: space['1'],
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  countInline: {
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  sparseCoach: {
    marginTop: space['2'],
    alignSelf: 'flex-start',
    maxWidth: '88%',
    paddingHorizontal: space['2'],
    paddingVertical: space['1'],
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sparseCoachText: {
    letterSpacing: 0.2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  ghostBtn: {
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0,
  },
});
