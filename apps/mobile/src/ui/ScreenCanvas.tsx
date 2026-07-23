/**
 * Standard screen shell: full-bleed Archive Paper / Charcoal canvas behind every route.
 * Use on tab roots and stack screens so nothing renders transparent against the system window.
 */
import type { ReactNode } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useEditionTabBarInset } from '@/shell/edition-chrome';

import { space, useThemeColors } from './tokens';

/**
 * Shared scroll content insets for tab screens — dense but breathable.
 *
 * The static `paddingBottom` is a guess (48) that under-clears the real tab bar
 * (~83dp on a notched phone). Prefer `useScreenScrollInsets()` in any screen that
 * scrolls under the tab bar; this constant stays for callers not yet migrated.
 */
export const screenScrollInsets = {
  paddingHorizontal: space['4'],
  paddingTop: space['2'],
  paddingBottom: space['12'],
  gap: space['3'],
} as const;

export type ScreenScrollInsets = {
  readonly paddingHorizontal: number;
  readonly paddingTop: number;
  readonly paddingBottom: number;
  readonly gap: number;
};

/**
 * Same rhythm as `screenScrollInsets`, but with a bottom pad measured from the
 * live tab bar height so the last row clears it on every device.
 */
export function useScreenScrollInsets(): ScreenScrollInsets {
  const tabBarInset = useEditionTabBarInset();

  return {
    paddingHorizontal: screenScrollInsets.paddingHorizontal,
    paddingTop: screenScrollInsets.paddingTop,
    paddingBottom: tabBarInset + space['4'],
    gap: screenScrollInsets.gap,
  };
}

export type ScreenCanvasProps = {
  readonly children: ReactNode;
  readonly edges?: readonly Edge[];
  readonly style?: ViewStyle;
};

export function ScreenCanvas({
  children,
  edges = ['top', 'left', 'right'],
  style,
}: ScreenCanvasProps) {
  const theme = useThemeColors();

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.canvas }, style]}
      edges={edges}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
