/**
 * Shared elevation helpers for Explore map chrome. Consumes theme elevation
 * tokens (shadow + gradient color stops). Copper accent is a 2px hairline strip
 * from the final `copperAccentEdge` stop — not a full gradient wash.
 *
 * ExploreListChrome is sheet-body chrome only (fill the bottom-sheet content
 * area). It is no longer a permanent flex sibling under the map.
 *
 * `getExploreCockpitColors` pins floating map instruments to brand-fixed dark
 * ink-glass in both reader themes (design-direction-v5 cockpit law).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, themeColors, useGradient, useShadowStyle, useThemeColors, type ShadowLevel } from '@/ui';

/** Brand charcoal — explore cockpit glass base (flat matte, no reader-theme paper). */
const BRAND_CHARCOAL = '#161616';

const COCKPIT_GLASS_OPACITY = 0.92;

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Fixed dark ink-glass palette for floating Explore instruments (both reader themes). */
export function getExploreCockpitColors() {
  const dark = themeColors.dark;
  return {
    surface: hexToRgba(BRAND_CHARCOAL, COCKPIT_GLASS_OPACITY),
    surfaceRaised: hexToRgba(dark.surfaceRaised, COCKPIT_GLASS_OPACITY),
    border: dark.border,
    ink: dark.ink,
    inkMuted: dark.inkMuted,
    accent: dark.accent,
  } as const;
}

export type ExploreCockpitColors = ReturnType<typeof getExploreCockpitColors>;

const ACCENT_WIDTH = 2;

export type ExploreChromeFrameProps = {
  readonly children: ReactNode;
  readonly shadow?: ShadowLevel;
  readonly accentEdge?: boolean;
  readonly style?: StyleProp<ViewStyle>;
};

/** Wraps floating Explore panels with brand shadow and optional copper edge accent. */
export function ExploreChromeFrame({
  children,
  shadow = 'md',
  accentEdge = false,
  style,
}: ExploreChromeFrameProps) {
  const shadowStyle = useShadowStyle(shadow);
  const copperEdge = useGradient('copperAccentEdge');
  const accentColor = copperEdge.colors[copperEdge.colors.length - 1]!;

  return (
    <View style={[shadowStyle, styles.frame, style]}>
      {accentEdge ? (
        <View
          style={[styles.accentStrip, { backgroundColor: accentColor }]}
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
    overflow: 'hidden',
    borderRadius: radius.md,
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
