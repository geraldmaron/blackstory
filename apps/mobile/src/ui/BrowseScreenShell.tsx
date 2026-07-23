/**
 * Browse edition shell — ScreenCanvas + scroll insets + indexed ScreenHeader.
 * Use for tab-root browse surfaces (History, Stories home, More). Body content
 * sits below the header; wrap sections in LiftedSurface panels as needed.
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ScreenCanvas, screenScrollInsets } from './ScreenCanvas';
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
  return (
    <ScreenCanvas>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader kicker={kicker} title={title} dek={dek} compact={compact} dense={dense} />
        {children}
      </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenScrollInsets.paddingHorizontal,
    paddingTop: screenScrollInsets.paddingTop,
    paddingBottom: screenScrollInsets.paddingBottom,
    gap: screenScrollInsets.gap,
  },
});
