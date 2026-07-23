/**
 * Persistent, visible map attribution (MOB-011 / ADR-024).
 *
 * OpenStreetMap data is ODbL: attribution is a LICENSE OBLIGATION, so this must
 * stay on-screen whenever the basemap is shown — MapLibre's built-in attribution
 * button is disabled on the <Map> so placement is under our control and cannot be
 * silently hidden.
 *
 * Placement: overlays the map canvas only (lower-left, above Explore peek). Keep
 * z-index below the bottom sheet and floating chrome so expanded sheet content
 * fully covers this pill. Explore may hide it when the sheet is half/full.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, space, Text, themeColors, useThemeColors } from '@/ui';
import { MAP_ATTRIBUTION_LINES } from './mapConfig';

/**
 * Default bottom offset that clears the Explore peek snap (~22%) so the license
 * line sits on the map, not under the sheet or in a gap below it.
 */
export const MAP_ATTRIBUTION_ABOVE_SHEET_BOTTOM: `${number}%` = '22%';

/** Stack below Explore sheet (z=2) and floating chrome (z=3). */
export const MAP_ATTRIBUTION_Z_INDEX = 1;

export type MapAttributionProps = {
  /**
   * Distance from the bottom of the map container. Use a percentage to clear
   * the Explore peek sheet, or a number (dp) for flush placement in non-sheet contexts.
   */
  readonly bottom?: number | `${number}%`;
  readonly style?: StyleProp<ViewStyle>;
  /** When false, renders nothing (Explore hides at half/full sheet). */
  readonly visible?: boolean;
};

export function MapAttribution({
  bottom = MAP_ATTRIBUTION_ABOVE_SHEET_BOTTOM,
  style,
  visible = true,
}: MapAttributionProps = {}) {
  const theme = useThemeColors();
  const labelColor = themeColors.dark.inkMuted;

  if (!visible) return null;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Map data ${MAP_ATTRIBUTION_LINES.join(', ')}`}
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          bottom,
          backgroundColor: theme.overlay,
          borderRadius: radius.sm,
        },
        style,
      ]}
      testID="map-attribution"
    >
      <Text variant="caption" style={{ color: labelColor }}>
        {MAP_ATTRIBUTION_LINES.join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: space['4'],
    zIndex: MAP_ATTRIBUTION_Z_INDEX,
    elevation: MAP_ATTRIBUTION_Z_INDEX,
    paddingHorizontal: space['2'],
    paddingVertical: space['1'],
    maxWidth: '72%',
  },
});
