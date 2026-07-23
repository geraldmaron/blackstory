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
 * Prefer pixel `bottom` from `attributionBottomAbovePeekSheet` when the sheet
 * uses tab-bar `bottomInset` — percentage-only placement overlaps the rail.
 *
 * Contrast: flat opaque Surface chip + theme `inkMuted` (WCAG AA on light and
 * dark), never ghost rgba over live tiles.
 */
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { duration, radius, space, Text, useThemeColors } from '@/ui';
import {
  MAP_ATTRIBUTION_LINES,
  MAP_ATTRIBUTION_LINES_COMPACT,
} from './mapConfig';

/**
 * Default bottom offset when Explore is not hosting the map (standalone MapScreen).
 * Explore passes a pixel bottom that clears the lifted peek sheet.
 */
export const MAP_ATTRIBUTION_ABOVE_SHEET_BOTTOM: `${number}%` = '18%';

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
  /** Skip the fade in/out when the reader has Reduce Motion enabled. */
  readonly reduceMotion?: boolean;
  /**
   * Tighter chip and shorter license line for full-bleed Explore — still a flat
   * Surface plate with theme muted ink (not ghost typography over tiles).
   */
  readonly compact?: boolean;
};

export function MapAttribution({
  bottom = MAP_ATTRIBUTION_ABOVE_SHEET_BOTTOM,
  style,
  visible = true,
  reduceMotion = false,
  compact = false,
}: MapAttributionProps = {}) {
  const theme = useThemeColors();
  const lines = compact ? MAP_ATTRIBUTION_LINES_COMPACT : MAP_ATTRIBUTION_LINES;

  if (!visible) return null;

  return (
    <Animated.View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Map data ${MAP_ATTRIBUTION_LINES.join(', ')}`}
      pointerEvents="box-none"
      entering={reduceMotion ? undefined : FadeIn.duration(duration.durationFast)}
      exiting={reduceMotion ? undefined : FadeOut.duration(duration.durationFast)}
      style={[
        styles.container,
        compact ? styles.containerCompact : null,
        {
          bottom,
          backgroundColor: theme.surface,
          borderRadius: radius.sm,
        },
        style,
      ]}
      testID="map-attribution"
    >
      <Text
        variant="code"
        style={[styles.label, compact ? styles.labelCompact : null, { color: theme.inkMuted }]}
      >
        {lines.join(' · ')}
      </Text>
    </Animated.View>
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
  containerCompact: {
    paddingHorizontal: space['2'],
    paddingVertical: space['1'],
    maxWidth: '58%',
  },
  label: {
    fontSize: 11,
  },
  labelCompact: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
