/**
 * Vertical Surface edition stack for browse screens: consistent gap between panels.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { screenScrollInsets } from './ScreenCanvas';
import { space } from './tokens';

export type EditionSurfaceStackProps = {
  readonly children: ReactNode;
  /** Tighter vertical gap between browse panels (History, More). */
  readonly dense?: boolean;
};

export function EditionSurfaceStack({ children, dense = true }: EditionSurfaceStackProps) {
  return <View style={[styles.stack, dense ? styles.dense : undefined]}>{children}</View>;
}

const styles = StyleSheet.create({
  stack: {
    gap: screenScrollInsets.gap,
  },
  dense: {
    gap: space['3'],
  },
});
