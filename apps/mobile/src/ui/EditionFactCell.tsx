/**
 * Label-over-value fact cell for v6 edition browse surfaces (mobile counterpart of web
 * `ds-record-anatomy__fact` / `ds-history-edition__rip-fact`).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { space } from './tokens';

export type EditionFactCellProps = {
  readonly label: string;
  readonly value: string;
  readonly leading?: ReactNode;
  readonly valueNode?: ReactNode;
};

export function EditionFactCell({ label, value, leading, valueNode }: EditionFactCellProps) {
  return (
    <View style={styles.cell} accessibilityRole="text">
      <View style={styles.labelRow}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <Text variant="code" colorRole="inkMuted" style={styles.label}>
          {label.toUpperCase()}
        </Text>
      </View>
      {valueNode ?? (
        <Text variant="editorial" numberOfLines={2}>
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    minWidth: '46%',
    flexGrow: 1,
    gap: space['1'],
    minHeight: 44,
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
  },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    letterSpacing: 0.4,
  },
});
