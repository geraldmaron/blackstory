/**
 * Compact section header for browse/settings/detail screens. Ledger Line default
 * is mono uppercase sectionLabel; pass headingScale for denser row titles.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, type TextRole } from './Text';
import { space } from './tokens';

export type SectionHeaderProps = {
  /** Primary section label. */
  title: string;
  /** Optional mono meta line rendered above the title (dates, counts, labels). */
  meta?: string;
  /** Optional trailing control (link button, clear action, etc.). */
  action?: ReactNode;
  /** Type role for the title; Ledger Line defaults to sectionLabel. */
  headingScale?: TextRole;
};

export function SectionHeader({
  title,
  meta,
  action,
  headingScale = 'sectionLabel',
}: SectionHeaderProps) {
  const isSectionLabel = headingScale === 'sectionLabel';

  return (
    <View style={styles.row} accessibilityRole="header">
      <View style={styles.textColumn}>
        {meta ? (
          <Text variant="sectionLabel" colorRole="inkMuted" style={styles.meta}>
            {meta}
          </Text>
        ) : null}
        <Text
          variant={headingScale}
          isHeading
          colorRole={isSectionLabel ? 'inkMuted' : 'ink'}
          style={isSectionLabel ? styles.sectionTitle : undefined}
        >
          {title}
        </Text>
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['3'],
    minHeight: 44,
  },
  textColumn: {
    flex: 1,
    gap: space['1'],
  },
  meta: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  action: {
    flexShrink: 0,
  },
});
