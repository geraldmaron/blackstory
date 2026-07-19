/**
 * Persistent, visible map attribution (MOB-011 / ADR-024).
 *
 * OpenStreetMap data is ODbL: attribution is a LICENSE OBLIGATION, so this must
 * stay on-screen whenever the basemap is shown — MapLibre's built-in attribution
 * button is disabled on the <Map> so placement is under our control and cannot be
 * silently hidden. It sits at the bottom-left over the map; the Explore narrative
 * sheet (MOB-012) must not fully occlude it (adversarial case "attribution hidden
 * by sheet") — a follow-up device screenshot check is deferred to MOB-012.
 */
import { StyleSheet, View } from 'react-native';
import { Text } from '@/ui';
import { MAP_ATTRIBUTION_LINES } from './mapConfig';

export function MapAttribution() {
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Map data ${MAP_ATTRIBUTION_LINES.join(', ')}`}
      style={styles.container}
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
    bottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(17, 17, 17, 0.6)',
  },
  text: {
    // Legible over the dark canvas; caption scale keeps it unobtrusive but present.
  },
});
