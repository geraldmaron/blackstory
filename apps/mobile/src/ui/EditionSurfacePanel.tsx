/**
 * Single Surface card in a v6 edition stack: optional indexed header + body slot.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { EditionPanelHeader, type EditionPanelHeaderProps } from './EditionPanelHeader';
import { LiftedSurface } from './LiftedSurface';
import { Text } from './Text';
import { space } from './tokens';

export type EditionSurfacePanelProps = Omit<EditionPanelHeaderProps, 'titleNode'> & {
  readonly title: string;
  /** Mono panel label above the heading (e.g. "Catalog"). */
  readonly panelLabel?: string;
  /** Count or meta line under the panel heading. */
  readonly panelMeta?: string;
  readonly children?: ReactNode;
  readonly paddingKey?: '2' | '3' | '4' | '5';
};

export function EditionSurfacePanel({
  index,
  kicker,
  title,
  dek,
  panelLabel,
  panelMeta,
  children,
  compact,
  dense,
  trailing,
  paddingKey,
}: EditionSurfacePanelProps) {
  const resolvedPadding = paddingKey ?? (compact || dense ? '2' : '3');

  return (
    <LiftedSurface tone="surface" paddingKey={resolvedPadding}>
      <View style={[styles.inner, compact || dense ? styles.compactInner : undefined]}>
        <EditionPanelHeader
          index={index}
          kicker={kicker}
          title={title}
          dek={dek}
          compact={compact}
          dense={dense}
          trailing={trailing}
        />
        {panelLabel ? (
          <Text variant="code" colorRole="inkMuted">
            {panelLabel}
          </Text>
        ) : null}
        {panelMeta ? (
          <Text variant="code" colorRole="inkSubtle">
            {panelMeta}
          </Text>
        ) : null}
        {children ? (
          <View style={[styles.body, compact || dense ? styles.compactBody : undefined]}>{children}</View>
        ) : null}
      </View>
    </LiftedSurface>
  );
}

const styles = StyleSheet.create({
  inner: {
    gap: space['3'],
  },
  compactInner: {
    gap: space['2'],
  },
  body: {
    gap: space['3'],
  },
  compactBody: {
    gap: space['2'],
  },
});
