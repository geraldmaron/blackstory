/**
 * Ledger Line entity section stack: mono index · kicker section label, optional
 * title, hairline rule — flat on canvas, not a nested Surface card shell.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, space, useThemeColors } from '@/ui';
import { SectionHeading, type SectionHeadingLevel } from './sections/SectionHeading';

export type EntityEditionPanelProps = {
  readonly index: string;
  readonly kicker: string;
  readonly title: string;
  readonly titleLevel?: SectionHeadingLevel;
  readonly headerExtra?: ReactNode;
  readonly children: ReactNode;
  readonly testID?: string;
  /** When false, omit the section title (label-only beat). Default true. */
  readonly showTitle?: boolean;
};

export function EntityEditionPanel({
  index,
  kicker,
  title,
  titleLevel = 2,
  headerExtra,
  children,
  testID,
  showTitle = true,
}: EntityEditionPanelProps) {
  const theme = useThemeColors();
  const sectionLabel = `${index} · ${kicker}`;

  return (
    <View testID={testID} style={styles.panel}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text variant="sectionLabel" colorRole="inkMuted" style={styles.label}>
          {sectionLabel}
        </Text>
        {headerExtra}
        {showTitle ? <SectionHeading level={titleLevel}>{title}</SectionHeading> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space['3'],
  },
  header: {
    gap: space['2'],
    paddingBottom: space['2'],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  body: {
    gap: space['3'],
  },
});
