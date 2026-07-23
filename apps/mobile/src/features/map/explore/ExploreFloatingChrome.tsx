/**
 * v7 Explore floating chrome over the full-bleed map: minimal mast (compact count +
 * ghost icon affordances). Map dominates first glance — no opaque Surface slab.
 * Copper accent only on active filters and selected controls (~10–15% copper budget).
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, space, radius } from '@/ui';
import type { FilterState } from '@/lib/route-params';
import { exploreContentInset, useExploreChromeColors } from './explore-chrome';
import { formatExploreCountLabel } from './explore-count-label';

const MIN_TOUCH = 44;
const ICON_SIZE = 18;
const GHOST_SIZE = 44;

export type ExploreFloatingChromeProps = {
  /** Viewport-scoped visible count — same source as the records rail list. */
  readonly inViewCount: number;
  /** Full loaded release total (geo-anchored features in the active source). */
  readonly releaseCount: number;
  /** "In view" once the map reports a region; "All records" before that. */
  readonly scopeLabel: string;
  readonly filters: FilterState;
  readonly showDemoHint?: boolean;
  readonly instrumentsOpen?: boolean;
  readonly recordsExpanded?: boolean;
  readonly onToggleInstruments: () => void;
  readonly onToggleRecords?: () => void;
  readonly onNationalView: () => void;
  readonly onOpenSearch?: () => void;
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
  testID,
  chrome,
}: {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly selected?: boolean;
  readonly testID?: string;
  readonly chrome: ReturnType<typeof useExploreChromeColors>;
}) {
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
              ? 'rgba(244, 239, 229, 0.14)'
              : chrome.mapGhostBg,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={ICON_SIZE}
        color={selected ? chrome.mapInk : chrome.mapInkMuted}
      />
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
}: ExploreFloatingChromeProps) {
  const chrome = useExploreChromeColors();
  const filtersActive = Boolean(filters.kind || filters.era);
  const countLabel = formatExploreCountLabel({
    inViewCount,
    releaseCount,
    scopeLabel,
    filters,
    showDemoHint,
  });

  return (
    <View
      style={styles.overlay}
      pointerEvents="box-none"
      testID="explore-floating-chrome"
    >
      <View style={styles.mastRow} pointerEvents="box-none">
        <Text
          variant="code"
          numberOfLines={1}
          style={[styles.countInline, { color: chrome.mapInkMuted }]}
          accessible
          accessibilityRole="text"
          accessibilityLabel={countLabel.accessibilityLabel}
          testID="explore-mast-count"
        >
          <Text variant="code" style={{ color: chrome.mapAccent }}>
            {countLabel.inline}
          </Text>
        </Text>

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
                  ? 'Map instruments, filters active'
                  : 'Open map instruments'
            }
            onPress={onToggleInstruments}
            selected={instrumentsOpen || filtersActive}
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
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: space['1'],
    left: 0,
    right: 0,
    zIndex: 3,
    paddingHorizontal: exploreContentInset,
  },
  mastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['2'],
    minHeight: MIN_TOUCH,
  },
  countInline: {
    flex: 1,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ghostBtn: {
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
});
