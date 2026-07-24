/**
 * Visual structure for the Census population beat when the warehouse timeline
 * is not on the mobile API yet — decade ticks + honest empty copy, not a
 * blank text ledger.
 */
import { StyleSheet, View } from 'react-native';
import { EmptyState, Text, space, useThemeColors } from '@/ui';
import { MethodCallout } from './MethodCallout';

const DECADE_TICKS = ['1790', '1860', '1900', '1950', '2000', '2020'] as const;

export function CensusModelFrame() {
  const theme = useThemeColors();
  return (
    <View style={styles.block} accessibilityRole="summary">
      <MethodCallout
        label="Model"
        body="National decade series and Black population share charts ship on web when the warehouse snapshot is wired. Mobile shows the frame until that feed lands."
      />
      <View
        style={[styles.frame, { borderColor: theme.border, backgroundColor: theme.surface }]}
        accessibilityLabel="Census decade model frame. Timeline not on this release yet."
      >
        <Text variant="sectionLabel" colorRole="inkMuted" style={styles.frameLabel}>
          Decade axis
        </Text>
        <View style={styles.rail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {DECADE_TICKS.map((tick, index) => {
            const height = 12 + ((index * 7) % 28);
            return (
              <View key={tick} style={styles.tickCol}>
                <View
                  style={[
                    styles.ghostBar,
                    {
                      height,
                      backgroundColor: theme.surfaceRaised,
                      borderColor: theme.border,
                    },
                  ]}
                />
                <Text variant="sectionLabel" colorRole="inkMuted" style={styles.tick}>
                  {tick}
                </Text>
              </View>
            );
          })}
        </View>
        <EmptyState
          compact
          title="Census timeline not on this release yet"
          description="Open Explore for place layers, or read Methodology for juxtaposition rules."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space['2'],
  },
  frame: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: space['2'],
    padding: space['3'],
    gap: space['2'],
  },
  frameLabel: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rail: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space['1'],
    minHeight: 56,
    paddingBottom: space['1'],
  },
  tickCol: {
    flex: 1,
    alignItems: 'center',
    gap: space['1'],
  },
  ghostBar: {
    width: 10,
    borderRadius: 1,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tick: {
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    fontSize: 9,
  },
});
