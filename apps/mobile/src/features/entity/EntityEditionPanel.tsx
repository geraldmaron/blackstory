/**
 * One section of a record: a 2px ink rule opens it (docs/ui/DESIGN.md section 7.4), a mono label
 * says what it is, then its title and body. Sections are not numbered; only claims are.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, space, useThemeColors } from '@/ui';
import { SectionHeading, type SectionHeadingLevel } from './sections/SectionHeading';

export type EntityEditionPanelProps = {
  readonly kicker: string;
  readonly title: string;
  readonly titleLevel?: SectionHeadingLevel;
  readonly children: ReactNode;
  readonly testID?: string;
};

export function EntityEditionPanel({
  kicker,
  title,
  titleLevel = 2,
  children,
  testID,
}: EntityEditionPanelProps) {
  const theme = useThemeColors();

  return (
    <View testID={testID} style={styles.panel}>
      <View style={[styles.header, { borderTopColor: theme.ink }]}>
        <Text variant="meta" colorRole="inkMuted" style={styles.label}>
          {kicker}
        </Text>
        <SectionHeading level={titleLevel}>{title}</SectionHeading>
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
    gap: space['1'],
    paddingTop: space['3'],
    borderTopWidth: 2,
  },
  label: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  body: {
    gap: space['3'],
  },
});
