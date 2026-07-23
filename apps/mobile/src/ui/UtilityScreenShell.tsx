/**
 * Utility edition shell for trust/discover routes (corrections, status lookup): ScreenCanvas
 * + indexed EditionPanelHeader + Surface body panel. Mobile counterpart of web UtilityEditionShell.
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { EditionPanelHeader } from './EditionPanelHeader';
import { LiftedSurface } from './LiftedSurface';
import { ScreenCanvas, screenScrollInsets } from './ScreenCanvas';
import { space } from './tokens';

export type UtilityScreenShellProps = {
  readonly kicker: string;
  readonly title: string;
  readonly dek?: string;
  readonly index?: string;
  readonly children: ReactNode;
};

export function UtilityScreenShell({
  kicker,
  title,
  dek,
  index = '00',
  children,
}: UtilityScreenShellProps) {
  return (
    <ScreenCanvas>
      <ScrollView contentContainerStyle={styles.content}>
        <EditionPanelHeader index={index} kicker={kicker} title={title} dek={dek} compact dense />
        <LiftedSurface tone="surface" paddingKey="3">
          <View style={styles.body}>{children}</View>
        </LiftedSurface>
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
  body: {
    gap: space['3'],
  },
});
