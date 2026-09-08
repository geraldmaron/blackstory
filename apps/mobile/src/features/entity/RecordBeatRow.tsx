/**
 * One labelled row of a record beat: label column, value, optional trailing mark.
 *
 * The record page had three different rhythms for what is the same thing — a field and its value.
 * Anatomy used an icon plus an uppercase caption over a 92dp column; provenance wrote its fields
 * into a sentence; a claim set its predicate as a heading two sizes below its own value. This is
 * the one rhythm, so a reader learns to scan the page once.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text, space } from '@/ui';

/** Exported for layout contract tests — inline icon + label + value on one row. */
export const recordBeatRowStyle = {
  flexDirection: 'row',
  flexWrap: 'nowrap',
  alignItems: 'baseline',
} as const;

/** Fixed label column so values align vertically (matches web's max-content grid column). */
export const recordBeatLabelColumnWidth = 92;

export type RecordBeatRowProps = {
  readonly label: string;
  /** Icon or mark that rides with the label, never in a plate of its own. */
  readonly leading?: ReactNode;
  /** Plain value. Ignored when `valueNode` is given. */
  readonly value?: string;
  readonly valueNode?: ReactNode;
  /** Meter, grade or count that sits after the value. */
  readonly trailing?: ReactNode;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly labelTestID?: string;
};

export function RecordBeatRow({
  label,
  leading,
  value,
  valueNode,
  trailing,
  onPress,
  accessibilityLabel,
  testID,
  labelTestID,
}: RecordBeatRowProps) {
  // A trailing mark belongs to the value it qualifies. Letting the value keep growing pushes the
  // mark out to the right margin, where it reads as a separate column of its own.
  const valueStyle = trailing ? styles.valueWithTrailing : styles.value;
  const body = valueNode ?? (
    <Text variant="editorial" colorRole="ink" style={valueStyle}>
      {value}
    </Text>
  );

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.labelCluster} testID={labelTestID}>
        {leading}
        <Text variant="caption" colorRole="inkSubtle" style={styles.labelText}>
          {label}
        </Text>
      </View>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          {...(accessibilityLabel ? { accessibilityLabel } : {})}
          hitSlop={8}
          onPress={onPress}
          style={({ pressed }) => [valueStyle, styles.pressableValue, pressed ? styles.pressed : null]}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    ...recordBeatRowStyle,
    gap: space['3'],
    width: '100%',
    minWidth: 0,
  },
  labelCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    width: recordBeatLabelColumnWidth,
    gap: space['2'],
  },
  labelText: {
    flexShrink: 0,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
  },
  valueWithTrailing: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
  },
  pressableValue: {
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  trailing: {
    flexShrink: 0,
  },
});
