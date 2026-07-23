/**
 * Ledger Line section label: IBM Plex Mono, stone, uppercase tracked.
 * Splits browse indexes with type + hairline rhythm instead of bordered panels.
 */
import { StyleSheet, View } from 'react-native';

import { Divider } from './Divider';
import { Text } from './Text';
import { space } from './tokens';

export type LedgerSectionLabelProps = {
  readonly children: string;
  /** Optional meta (counts) rendered after an en-space separator. */
  readonly meta?: string;
  /** Draw a full-width hairline above the label. */
  readonly ruleAbove?: boolean;
};

export function LedgerSectionLabel({
  children,
  meta,
  ruleAbove = false,
}: LedgerSectionLabelProps) {
  return (
    <View
      style={styles.wrap}
      accessibilityRole="header"
      accessibilityLabel={meta ? `${children}, ${meta}` : children}
    >
      {ruleAbove ? <Divider /> : null}
      <View style={styles.row}>
        <Text variant="sectionLabel" colorRole="inkMuted" style={styles.label}>
          {children}
        </Text>
        {meta ? (
          <Text variant="sectionLabel" colorRole="inkSubtle" style={styles.label}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space['2'],
    paddingTop: space['1'],
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: space['2'],
  },
  label: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
