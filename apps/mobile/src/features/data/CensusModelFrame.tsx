/**
 * The national census series is not in this release. This says so in words. It used to draw a
 * row of placeholder bars with invented heights under a "Decade axis" label; a figure with no
 * data is a sentence, not a drawing (docs/ui/DESIGN.md section 9.5: missing data is never drawn
 * as a value).
 */
import { StyleSheet, View } from 'react-native';
import { EmptyState, space } from '@/ui';
import { MethodCallout } from './MethodCallout';

export function CensusModelFrame() {
  return (
    <View style={styles.block} accessibilityRole="summary">
      <MethodCallout
        label="Model"
        body="National decade series and Black population share charts ship on web when the warehouse snapshot is wired. Mobile shows the frame until that feed lands."
      />
      <EmptyState
        compact
        title="Census timeline not on this release yet"
        description="Open the Archive map for place layers, or read Methodology for juxtaposition rules."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space['2'],
  },
});
