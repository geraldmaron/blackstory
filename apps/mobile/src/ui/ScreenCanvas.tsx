/**
 * Standard screen shell: full-bleed Archive Paper / Charcoal canvas behind every route.
 * Use on tab roots and stack screens so nothing renders transparent against the system window.
 */
import type { ReactNode } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { space, useThemeColors } from './tokens';

/** Shared scroll content insets for tab screens — dense but breathable. */
export const screenScrollInsets = {
  paddingHorizontal: space['4'],
  paddingTop: space['2'],
  paddingBottom: space['12'],
  gap: space['3'],
} as const;

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
