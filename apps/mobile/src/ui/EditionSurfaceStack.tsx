/**
 * Vertical Surface edition stack for browse screens: consistent gap between panels.
 * Panel insert/remove is smoothed with a layout transition, gated on reduce motion.
 */
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { useReduceMotion } from '@/features/explore/useReduceMotion';

import { duration, space } from './tokens';

export type EditionSurfaceStackProps = {
  readonly children: ReactNode;
  /** Tighter vertical gap between browse panels (History, More). */
  readonly dense?: boolean;
};

export function EditionSurfaceStack({ children, dense = false }: EditionSurfaceStackProps) {
  const reduceMotion = useReduceMotion();

  return (
    <Animated.View
      style={[styles.stack, dense ? styles.dense : undefined]}
      layout={reduceMotion ? undefined : LinearTransition.duration(duration.durationBase)}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: space['4'],
  },
  dense: {
    gap: space['2'],
  },
});
