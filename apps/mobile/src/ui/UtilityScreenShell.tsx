/**
 * Utility edition shell for trust/discover routes (corrections, status lookup):
 * ScreenCanvas + Ledger masthead + single Surface form plate (Ledger Line allows
 * one Surface panel when essential for utility forms).
 *
 * Forwards an optional ScrollView ref and additive `scrollProps` so callers can set keyboard
 * behavior (`keyboardShouldPersistTaps`, `keyboardDismissMode`) and scroll to in-form targets.
 */
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { ScreenHeader } from './ScreenHeader';
import { LiftedSurface } from './LiftedSurface';
import type { Edge } from 'react-native-safe-area-context';
import { ScreenCanvas, screenScrollInsets } from './ScreenCanvas';
import { space } from './tokens';

export type UtilityScreenShellScrollProps = Omit<
  ScrollViewProps,
  'children' | 'contentContainerStyle' | 'ref' | 'style'
>;

export type UtilityScreenShellProps = {
  readonly kicker: string;
  readonly title: string;
  readonly dek?: string;
  /** @deprecated Ledger Line utility mastheads omit indexed panel chrome. */
  readonly index?: string;
  /**
   * Safe-area edges for the underlying canvas. Defaults to the tab-screen edges;
   * pass e.g. `['left','right','bottom']` on a header-bearing stack screen where
   * the native header already owns the top inset.
   */
  readonly edges?: readonly Edge[];
  /** Additive ScrollView props (keyboard behavior, scroll indicators, etc.). */
  readonly scrollProps?: UtilityScreenShellScrollProps;
  readonly children: ReactNode;
};

export const UtilityScreenShell = forwardRef<ScrollView, UtilityScreenShellProps>(
  function UtilityScreenShell(
    { kicker, title, dek, edges, scrollProps, children },
    ref,
  ) {
    return (
      <ScreenCanvas {...(edges ? { edges } : {})}>
        <ScrollView
          ref={ref}
          testID="utility-screen-shell-scroll"
          contentContainerStyle={styles.content}
          {...scrollProps}
        >
          <ScreenHeader kicker={kicker} title={title} dek={dek} compact dense />
          <LiftedSurface tone="surface" paddingKey="3">
            <View style={styles.body}>{children}</View>
          </LiftedSurface>
        </ScrollView>
      </ScreenCanvas>
    );
  },
);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenScrollInsets.paddingHorizontal,
    paddingTop: screenScrollInsets.paddingTop,
    paddingBottom: screenScrollInsets.paddingBottom,
    gap: screenScrollInsets.gap,
  },
  body: {
    gap: space['3'],
  },
});
