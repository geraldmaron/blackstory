/**
 * A view switch (docs/ui/DESIGN.md section 7.6 `Segmented`): Map and List on the Archive, Plain
 * and Numbers on a figure. A control, so radius 8; the selected segment is ink on paper.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { MIN_TOUCH_TARGET, radius, space, useThemeColors } from './tokens';

export type SegmentedOption<T extends string> = {
  readonly id: T;
  readonly label: string;
};

export type SegmentedProps<T extends string> = {
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (next: T) => void;
  /** What the switch changes: "View", "Figure view". */
  readonly accessibilityLabel: string;
  readonly testID?: string;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: SegmentedProps<T>) {
  const theme = useThemeColors();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { borderColor: theme.borderControl, backgroundColor: theme.surface }]}
      testID={testID}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={[styles.segment, selected ? { backgroundColor: theme.ink } : undefined]}
            testID={testID ? `${testID}-${option.id}` : undefined}
          >
            <Text variant="bodyEmphasis" colorRole={selected ? 'inverseInk' : 'ink'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  segment: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET * 1.5,
    paddingHorizontal: space['4'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
