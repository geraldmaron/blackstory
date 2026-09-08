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
import { brandCore, themeColors } from '@/ui/tokens';
import { useThemeColors } from '@/ui';

const ACCENT_WIDTH = 3;

/** Horizontal inset for Explore chrome and sheet bodies — matches tab screen gutters. */
export const exploreContentInset = screenScrollInsets.paddingHorizontal;

/**
 * Small hex → `rgba()` helper so ghost fills read as "brand token at alpha"
 * instead of hand-copied rgba triples that silently drift from the palette.
 */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Fixed ink on the dark archive map plate (ADR-013). The plate stays on the
 * dark register regardless of device theme, so these are token references at
 * fixed alpha — Archive Paper for ink, the dark accent-graphic for copper.
 */
const MAP_INK = brandCore.archivePaper;
const MAP_INK_MUTED = withAlpha(brandCore.archivePaper, 0.68);
const MAP_GHOST_BG = withAlpha(brandCore.archivePaper, 0.08);
const MAP_ACCENT = themeColors.dark.accentGraphic;
const MAP_GHOST_ACTIVE = withAlpha(MAP_ACCENT, 0.28);
/** Pressed feedback fill for ghost controls on the dark plate. */
export const MAP_GHOST_PRESSED = withAlpha(brandCore.archivePaper, 0.14);

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
