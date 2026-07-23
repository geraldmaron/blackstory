/**
 * Compact section header for browse/settings/detail screens: optional mono meta line,
 * a display-scale title, and an optional trailing action. Keeps hierarchy scannable
 * without the vertical weight of a full screen title block.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { space } from './tokens';

export type SectionHeaderProps = {
  /** Primary section label. */
  title: string;
  /** Optional mono meta line rendered above the title (dates, counts, labels). */
  meta?: string;
  /** Optional trailing control (link button, clear action, etc.). */
  action?: ReactNode;
  /** Heading level for accessibility; defaults to subtitle scale. */
  headingScale?: 'subtitle' | 'bodyEmphasis';
};

export function SectionHeader({ title, meta, action, headingScale = 'subtitle' }: SectionHeaderProps) {
  return (
    <View style={styles.row} accessibilityRole="header">
      <View style={styles.textColumn}>
        {meta ? (
          <Text variant="code" colorRole="inkMuted">
            {meta}
          </Text>
        ) : null}
        <Text variant={headingScale} isHeading>
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
  action: {
    flexShrink: 0,
  },
});
