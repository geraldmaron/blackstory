/**
 * Compact tab-screen masthead (Ledger Line): copper-tick mono kicker,
 * 16 Inter Medium title, optional muted dek. Hierarchy from type, not cards.
 * Optional leading back control for stack-pushed surfaces that share this
 * masthead (tab roots must omit `onBack`).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackControl } from './BackControl';
import { Text, type TextRole } from './Text';
import { space, useThemeColors } from './tokens';

export type ScreenHeaderProps = {
  /** Small copper navigational label above the title (e.g. "Longform", "Records"). */
  readonly kicker?: string;
  readonly title: string;
  readonly dek?: string;
  /** Tighter vertical rhythm for map-led screens that share chrome with a toolbar. */
  readonly compact?: boolean;
  /** Ledger Line browse density — 16 Inter Medium masthead (default). */
  readonly dense?: boolean;
  /** Trailing control (dev menu, map link) aligned to the title row. */
  readonly trailing?: ReactNode;
  /**
   * Leading back affordance. When set, renders a copper chevron before the
   * title row. Do not pass on tab roots (Explore / History / Stories / More).
   */
  readonly onBack?: () => void;
  readonly backAccessibilityLabel?: string;
  readonly backAccessibilityHint?: string;
};

function resolveTitleVariant(compact: boolean, dense: boolean): TextRole {
  if (dense) return 'masthead';
  if (compact) return 'title';
  return 'display';
}

export function ScreenHeader({
  kicker,
  title,
  dek,
  compact = true,
  dense = true,
  trailing,
  onBack,
  backAccessibilityLabel,
  backAccessibilityHint,
}: ScreenHeaderProps) {
  const theme = useThemeColors();
  const titleVariant = resolveTitleVariant(compact, dense);
  const tight = compact || dense;

  return (
    <View
      style={[styles.block, tight ? styles.compact : undefined]}
      accessibilityRole="header"
    >
      {kicker ? (
        <View style={styles.kickerRow}>
          <View
            style={[styles.tick, { backgroundColor: theme.accentGraphic }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Text variant="code" colorRole="accent" numberOfLines={1} style={styles.kicker}>
            {kicker}
          </Text>
        </View>
      ) : null}
      <View style={[styles.titleRow, tight ? styles.titleRowDense : undefined]}>
        {onBack ? (
          <BackControl
            onPress={onBack}
            {...(backAccessibilityLabel ? { accessibilityLabel: backAccessibilityLabel } : {})}
            {...(backAccessibilityHint ? { accessibilityHint: backAccessibilityHint } : {})}
          />
        ) : null}
        <Text variant={titleVariant} isHeading style={styles.title}>
          {title}
        </Text>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {dek ? (
        <Text variant="bodySmall" colorRole="inkMuted" style={styles.dek}>
          {dek}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space['2'],
  },
  compact: {
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
