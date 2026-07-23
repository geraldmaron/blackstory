/**
 * Compact floating Explore instruments over the full-bleed map: count pill,
 * icon-led Search / Filters / US chips. Dense enough to leave the map canvas
 * readable under one-handed reach.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, space, radius } from '@/ui';
import type { FilterState } from '@/app/_lib/route-params';
import { getExploreCockpitColors } from './explore-chrome';

const MIN_TOUCH = 44;
const ICON_SIZE = 18;

export type ExploreFloatingChromeProps = {
  readonly matchCount: number;
  readonly filters: FilterState;
  readonly showDemoHint?: boolean;
  readonly onOpenFilters: () => void;
  readonly onNationalView: () => void;
  readonly onOpenSearch?: () => void;
};

function formatCount(count: number, filters: FilterState): string {
  const base = count === 1 ? '1' : String(count);
  return filters.kind || filters.era ? `${base} · filtered` : base;
}

function IconChip({
  icon,
  accessibilityLabel,
  onPress,
  selected,
  testID,
  cockpit,
}: {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly selected?: boolean;
  readonly testID?: string;
  readonly cockpit: ReturnType<typeof getExploreCockpitColors>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: Boolean(selected) }}
      hitSlop={4}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected || pressed ? cockpit.surfaceRaised : cockpit.surface,
          borderColor: selected ? cockpit.accent : cockpit.border,
        },
      ]}
    >
      <Ionicons name={icon} size={ICON_SIZE} color={selected ? cockpit.accent : cockpit.inkMuted} />
    </Pressable>
  );
}

export function ExploreFloatingChrome({
  matchCount,
  filters,
  showDemoHint = false,
  onOpenFilters,
  onNationalView,
  onOpenSearch,
}: ExploreFloatingChromeProps) {
  const cockpit = getExploreCockpitColors();
  const filtersActive = Boolean(filters.kind || filters.era);

  return (
    <View
      style={styles.overlay}
      pointerEvents="box-none"
      testID="explore-floating-chrome"
    >
      <View style={styles.row} pointerEvents="box-none">
        <View
          style={[
            styles.countPill,
            { backgroundColor: cockpit.surface, borderColor: cockpit.border },
          ]}
          accessible
          accessibilityRole="text"
          accessibilityLabel={
            showDemoHint
              ? `${formatCount(matchCount, filters)} records, demo fixtures`
              : `${formatCount(matchCount, filters)} records`
          }
        >
          <Text variant="code" numberOfLines={1} style={{ color: cockpit.inkMuted }}>
            {formatCount(matchCount, filters)}
          </Text>
          {showDemoHint ? (
            <Text variant="caption" numberOfLines={1} style={{ color: cockpit.inkMuted }}>
              demo
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <IconChip
            icon="search-outline"
            accessibilityLabel="Open search"
            onPress={() => onOpenSearch?.()}
            testID="explore-chip-search"
            cockpit={cockpit}
          />
          <IconChip
            icon="options-outline"
            accessibilityLabel={
              filtersActive ? 'Filters, active. Open filter sheet' : 'Open filters'
            }
            onPress={onOpenFilters}
            selected={filtersActive}
            testID="explore-chip-filters"
            cockpit={cockpit}
          />
          <IconChip
            icon="globe-outline"
            accessibilityLabel="Reset to national view"
            onPress={onNationalView}
            testID="explore-chip-national"
            cockpit={cockpit}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: space['2'],
    left: space['2'],
    right: space['2'],
    zIndex: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['2'],
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
    paddingHorizontal: space['2'],
    paddingVertical: space['1'],
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: MIN_TOUCH,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
  },
  chip: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
  },
});
