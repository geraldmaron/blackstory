/**
 * Persistent, visible map attribution (MOB-011 / ADR-024).
 *
 * OpenStreetMap data is ODbL: attribution is a LICENSE OBLIGATION, so this must
 * stay on-screen whenever the basemap is shown — MapLibre's built-in attribution
 * button is disabled on the <Map> so placement is under our control and cannot be
 * silently hidden.
 *
 * Placement: overlays the map above the Explore bottom-sheet peek (default
 * `bottom` clearance), never as a solid bar sandwiched between the sheet and the
 * tab bar. The sheet itself uses `bottomInset={0}` so list content is not eaten.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/ui';
import { MAP_ATTRIBUTION_LINES } from './mapConfig';

/**
 * Default bottom offset that clears the Explore peek snap (~18%) so the license
 * line sits on the map, not under the sheet or in a gap below it.
 */
export const MAP_ATTRIBUTION_ABOVE_SHEET_BOTTOM: `${number}%` = '20%';

export type MapAttributionProps = {
  /**
   * Distance from the bottom of the map container. Use a percentage to clear
   * the Explore peek sheet, or a number (dp) for flush placement in non-sheet contexts.
   */
  readonly bottom?: number | `${number}%`;
  readonly style?: StyleProp<ViewStyle>;
};

export function MapAttribution({
  bottom = MAP_ATTRIBUTION_ABOVE_SHEET_BOTTOM,
  style,
}: MapAttributionProps = {}) {
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Map data ${MAP_ATTRIBUTION_LINES.join(', ')}`}
      style={[styles.container, { bottom }, style]}
      testID="map-attribution"
    >
      <Text variant="caption" colorRole="inkMuted" style={styles.text}>
        {MAP_ATTRIBUTION_LINES.join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    zIndex: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    // Compact pill over the map — not a full-width bar.
    backgroundColor: 'rgba(17, 17, 17, 0.6)',
    maxWidth: '72%',
  },
  text: {
    // Legible over the dark canvas; caption scale keeps it unobtrusive but present.
  },
});
