/**
 * Browse edition shell (Ledger Line) — ScreenCanvas + live tab-bar scroll insets
 * + compact ScreenHeader. Tab-root indexes sit on Archive Paper with hairline
 * section labels; avoid nested LiftedSurface / indexed EditionSurfacePanel cards.
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ScreenCanvas, useScreenScrollInsets } from './ScreenCanvas';
import { ScreenHeader } from './ScreenHeader';

export type BrowseScreenShellProps = {
  readonly kicker?: string;
  readonly title: string;
  readonly dek?: string;
  readonly compact?: boolean;
  readonly dense?: boolean;
  readonly children: ReactNode;
};

export function BrowseScreenShell({
  kicker,
  title,
  dek,
  compact = true,
  dense = true,
  children,
}: BrowseScreenShellProps) {
  const insets = useScreenScrollInsets();

  return (
    <ScreenCanvas>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: insets.paddingHorizontal,
            paddingTop: insets.paddingTop,
            paddingBottom: insets.paddingBottom,
            gap: insets.gap,
          },
        ]}
      >
        <ScreenHeader kicker={kicker} title={title} dek={dek} compact={compact} dense={dense} />
        {children}
      </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
});
