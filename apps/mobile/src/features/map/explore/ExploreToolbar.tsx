/**
 * Compact Explore toolbar: record count, icon filter/national actions, optional demo hint.
 * Icon-led actions save horizontal space vs text-only ghost buttons.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useShadowStyle, useThemeColors, space } from '@/ui';
import type { FilterState } from '@/app/_lib/route-params';

const MIN_TOUCH = 44;
const ICON_SIZE = 20;

export type ExploreToolbarProps = {
  readonly matchCount: number;
  readonly filters: FilterState;
  readonly showDemoHint?: boolean;
  readonly onOpenFilters: () => void;
  readonly onNationalView: () => void;
};

function formatCount(count: number, filters: FilterState): string {
  const base = count === 1 ? '1 record' : `${count} records`;
  const filtered = filters.kind || filters.era ? `${base} · filtered` : base;
  return filtered;
}

function IconAction({
  icon,
  accessibilityLabel,
  onPress,
  selected,
}: {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly selected?: boolean;
}) {
  const theme = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: Boolean(selected) }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconAction,
        {
          backgroundColor: selected
            ? theme.surfaceRaised
            : pressed
              ? theme.surfaceRaised
              : theme.surface,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={ICON_SIZE}
        color={selected ? theme.accent : theme.inkMuted}
      />
    </Pressable>
  );
}

export function ExploreToolbar({
  matchCount,
  filters,
  showDemoHint = false,
  onOpenFilters,
  onNationalView,
}: ExploreToolbarProps) {
  const theme = useThemeColors();
  const toolbarShadow = useShadowStyle('sm');
  const filtersActive = Boolean(filters.kind || filters.era);

  return (
    <View
      style={[
        styles.bar,
        toolbarShadow,
        { borderBottomColor: theme.border, backgroundColor: theme.canvas },
      ]}
      testID="explore-toolbar"
    >
      <View style={styles.titleBlock}>
        <Text variant="bodyEmphasis" isHeading accessibilityRole="header">
          Explore
        </Text>
        <View style={styles.countBlock} accessible accessibilityRole="text">
          <Text variant="code" colorRole="inkMuted" numberOfLines={1}>
            {formatCount(matchCount, filters)}
          </Text>
          {showDemoHint ? (
            <Text variant="caption" colorRole="inkSubtle" numberOfLines={1}>
              demo fixtures
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <IconAction
          icon="globe-outline"
          accessibilityLabel="Reset to national view"
          onPress={onNationalView}
        />
        <IconAction
          icon="options-outline"
          accessibilityLabel={
            filtersActive ? 'Filters, active. Open filter sheet' : 'Open filters'
          }
          onPress={onOpenFilters}
          selected={filtersActive}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space['3'],
    paddingVertical: space['2'],
    borderBottomWidth: 1,
    gap: space['2'],
    minHeight: MIN_TOUCH,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  countBlock: {
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  iconAction: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
});
