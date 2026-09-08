/**
 * Shared chrome helpers for Explore map instruments. v7 explore uses a minimal map
 * mast (ghost controls over the fixed dark plate) and continuous Surface fields
 * for instruments/sheet bodies — not stacked bordered cards.
 *
 * ExploreListChrome is sheet-body chrome only. Map plate stays dark-archive
 * per ADR-013; floating controls use fixed map-overlay ink on the dark plate.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { screenScrollInsets } from '@/ui/ScreenCanvas';
import { useThemeColors } from '@/ui';
import {
  MAP_INK,
  MAP_INK_MUTED,
  MAP_GHOST_BG,
  MAP_GHOST_ACTIVE,
  MAP_ACCENT,
} from '@/features/map/map-plate-ink';

const ACCENT_WIDTH = 3;

/** Horizontal inset for Explore chrome and sheet bodies — matches tab screen gutters. */
export const exploreContentInset = screenScrollInsets.paddingHorizontal;

/*
 * Plate ink/ghost fills now live in `features/map/map-plate-ink.ts` so that map-layer modules
 * (MapAttribution, the zoom controls) can reach them without importing upward from
 * `features/explore/`. Re-exported here so existing Explore imports keep working.
 */
export {
  withAlpha,
  MAP_GHOST_PRESSED,
  MAP_GHOST_BORDER,
} from '@/features/map/map-plate-ink';

export type ExploreChromeColors = ReturnType<typeof useExploreChromeColors>;

/** Map-overlay + theme-aware Surface palette for Explore chrome. */
export function useExploreChromeColors() {
  const theme = useThemeColors();
  return {
    mapInk: MAP_INK,
    mapInkMuted: MAP_INK_MUTED,
    mapGhostBg: MAP_GHOST_BG,
    mapGhostActive: MAP_GHOST_ACTIVE,
    mapAccent: MAP_ACCENT,
    surface: theme.surface,
    surfaceRaised: theme.surfaceRaised,
    border: theme.border,
    ink: theme.ink,
    inkMuted: theme.inkMuted,
    accent: theme.accent,
  } as const;
}

export type ExploreChromeFrameProps = {
  readonly children: ReactNode;
  readonly accentEdge?: boolean;
  readonly style?: StyleProp<ViewStyle>;
};

/** Wraps preview content with optional copper left rule — no card frame. */
export function ExploreChromeFrame({
  children,
  accentEdge = false,
  style,
}: ExploreChromeFrameProps) {
  const theme = useThemeColors();

  return (
    <View style={[styles.frame, style]}>
      {accentEdge ? (
        <View
          style={[styles.accentStrip, { backgroundColor: theme.accentGraphic }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      {children}
    </View>
  );
}

export type ExploreListChromeProps = {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
};

/** Sheet-body chrome — fills the bottom-sheet content area (metrics or list). */
export function ExploreListChrome({
  children,
  style,
  testID = 'explore-list-chrome',
}: ExploreListChromeProps) {
  const theme = useThemeColors();

  return (
    <View
      style={[styles.listChrome, { backgroundColor: theme.surface }, style]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
    paddingLeft: ACCENT_WIDTH + 12,
  },
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: ACCENT_WIDTH,
    zIndex: 1,
  },
  listChrome: {
    flex: 1,
  },
});
