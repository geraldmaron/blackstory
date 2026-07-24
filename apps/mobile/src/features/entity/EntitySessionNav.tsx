/**
 * Accessible Previous / Next / Random controls for entity detail browsing.
 * Presentational only — parents own stack state and navigation side effects.
 * Random stays secondary so copper never fills body-size label text.
 */
import { StyleSheet, View } from 'react-native';
import { Button, Text, space, radius, useThemeColors, MIN_TOUCH_TARGET } from '@/ui';

export type EntitySessionNavProps = {
  readonly canPrevious: boolean;
  readonly canNext: boolean;
  readonly randomEnabled: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onRandomToggle: () => void;
  readonly testID?: string;
};

export function EntitySessionNav({
  canPrevious,
  canNext,
  randomEnabled,
  onPrevious,
  onNext,
  onRandomToggle,
  testID = 'entity-session-nav',
}: EntitySessionNavProps) {
  const theme = useThemeColors();

  return (
    <View
      style={[styles.root, { borderTopColor: theme.border }]}
      accessibilityRole="summary"
      accessibilityLabel="Record navigation"
      testID={testID}
    >
      <Text variant="code" colorRole="inkMuted" style={styles.kicker}>
        Browse records
      </Text>
      <View style={styles.row}>
        <View style={styles.control}>
          <Button
            label="Previous"
            variant="secondary"
            density="compact"
            disabled={!canPrevious}
            onPress={onPrevious}
            accessibilityLabel="Previous record"
          />
        </View>
        <View style={styles.control}>
          <Button
            label={randomEnabled ? 'Random: on' : 'Random: off'}
            variant="secondary"
            density="compact"
            onPress={onRandomToggle}
            accessibilityLabel={randomEnabled ? 'Random order: on' : 'Random order: off'}
            accessibilityState={{ selected: randomEnabled }}
          />
        </View>
        <View style={styles.control}>
          <Button
            label="Next"
            variant="secondary"
            density="compact"
            disabled={!canNext}
            onPress={onNext}
            accessibilityLabel={randomEnabled ? 'Next random record' : 'Next record in list'}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: space['2'],
    paddingTop: space['3'],
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: MIN_TOUCH_TARGET * 2,
  },
  kicker: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  row: {
    flexDirection: 'row',
    gap: space['2'],
    alignItems: 'stretch',
  },
  control: {
    flex: 1,
    borderRadius: radius.sm,
  },
});
