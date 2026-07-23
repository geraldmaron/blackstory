/**
 * Edition panel header: optional mono index, copper kicker, Ledger masthead title.
 * Prefer ScreenHeader + LedgerSectionLabel on browse tabs (no indexed panels).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, type TextRole } from './Text';
import { space, useThemeColors } from './tokens';

export type EditionPanelHeaderProps = {
  /** Panel index (00, 01…). Hidden when omitted. Omit on Ledger Line browse tabs. */
  readonly index?: string;
  readonly kicker?: string;
  readonly title: string;
  readonly dek?: string;
  readonly titleNode?: ReactNode;
  readonly compact?: boolean;
  /** Ledger Line density — 16 Inter Medium masthead (default). */
  readonly dense?: boolean;
  readonly trailing?: ReactNode;
};

function resolveTitleVariant(compact: boolean, dense: boolean): TextRole {
  if (dense) return 'masthead';
  if (compact) return 'title';
  return 'display';
}

export function EditionPanelHeader({
  index,
  kicker,
  title,
  dek,
  titleNode,
  compact = true,
  dense = true,
  trailing,
}: EditionPanelHeaderProps) {
  const theme = useThemeColors();
  const titleVariant = resolveTitleVariant(compact, dense);
  const tight = compact || dense;

  return (
    <View
      style={[styles.header, tight ? styles.compact : undefined]}
      accessibilityRole="header"
    >
      {index ? (
        <Text
          variant="code"
          colorRole="inkSubtle"
          style={styles.index}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {index}
        </Text>
      ) : null}
      <View style={styles.textColumn}>
        {kicker ? (
          <View style={styles.kickerRow}>
            <View
              style={[styles.tick, { backgroundColor: theme.accentGraphic }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <Text variant="code" colorRole="accent" style={styles.kicker}>
              {kicker}
            </Text>
          </View>
        ) : null}
        {titleNode ? (
          titleNode
        ) : (
          <View style={[styles.titleRow, tight ? styles.titleRowDense : undefined]}>
            <Text variant={titleVariant} isHeading style={styles.title}>
              {title}
            </Text>
            {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
          </View>
        )}
        {dek ? (
          <Text variant="bodySmall" colorRole="inkMuted" style={styles.dek}>
            {dek}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space['3'],
  },
  compact: {
    gap: space['2'],
  },
  index: {
    minWidth: 28,
    paddingTop: 2,
    letterSpacing: 0.5,
  },
  textColumn: {
    flex: 1,
    gap: space['1'],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['2'],
    minHeight: 36,
  },
  titleRowDense: {
    minHeight: 28,
  },
  title: {
    flex: 1,
  },
  trailing: {
    flexShrink: 0,
  },
  dek: {
    marginTop: space['1'],
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  tick: {
    width: 3,
    height: 12,
    borderRadius: 1,
  },
  kicker: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
