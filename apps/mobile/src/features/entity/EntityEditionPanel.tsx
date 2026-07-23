/**
 * v6 entity edition Surface panel: mono copper index, uppercase kicker, and
 * section title in a flat matte card — mobile counterpart of web
 * `ds-entity-edition__panel` + header rhythm.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LiftedSurface, Text, space, useThemeColors } from '@/ui';
import { SectionHeading, type SectionHeadingLevel } from './sections/SectionHeading';

export type EntityEditionPanelProps = {
  readonly index: string;
  readonly kicker: string;
  readonly title: string;
  readonly titleLevel?: SectionHeadingLevel;
  readonly headerExtra?: ReactNode;
  readonly children: ReactNode;
  readonly testID?: string;
};

export function EntityEditionPanel({
  index,
  kicker,
  title,
  titleLevel = 2,
  headerExtra,
  children,
  testID,
}: EntityEditionPanelProps) {
  const theme = useThemeColors();

  return (
    <LiftedSurface
      tone="surface"
      shadow="none"
      paddingKey="3"
      testID={testID}
      contentStyle={styles.panel}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text
          variant="title"
          style={[styles.index, { color: theme.accentGraphic }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {index}
        </Text>
        <View style={styles.headerBody}>
          <Text variant="code" colorRole="accent" style={styles.kicker}>
            {kicker.toUpperCase()}
          </Text>
          {headerExtra}
          <SectionHeading level={titleLevel}>{title}</SectionHeading>
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </LiftedSurface>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space['4'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space['4'],
    paddingBottom: space['4'],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  index: {
    minWidth: 28,
    letterSpacing: -0.5,
  },
  headerBody: {
    flex: 1,
    gap: space['2'],
    minWidth: 0,
  },
  kicker: {
    letterSpacing: 1.2,
  },
  body: {
    gap: space['3'],
  },
});
