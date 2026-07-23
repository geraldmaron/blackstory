/**
 * Shared elevation helpers for Explore map chrome. Consumes theme elevation
 * tokens (shadow + gradient color stops). Copper accent is a 2px hairline strip
 * from the final `copperAccentEdge` stop — not a full gradient wash.
 *
 * ExploreListChrome is sheet-body chrome only (fill the bottom-sheet content
 * area). It is no longer a permanent flex sibling under the map.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, useGradient, useShadowStyle, useThemeColors, type ShadowLevel } from '@/ui';

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
