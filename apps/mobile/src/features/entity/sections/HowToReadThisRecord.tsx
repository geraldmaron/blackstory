/**
 * Compact trust off-ramp for entity detail — methodology link without preceding
 * the record story. Mirrors web `HowToReadThisRecord` compact variant.
 */
import { StyleSheet, View } from 'react-native';
import { Link, Text, space } from '@/ui';

export type HowToReadThisRecordProps = {
  readonly onMethodologyPress?: () => void;
};

export function HowToReadThisRecord({ onMethodologyPress }: HowToReadThisRecordProps) {
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text variant="bodySmall" colorRole="inkMuted">
        How this record is built
      </Text>
      <View style={styles.linkRow}>
        <Link
          href="https://blackbook.app/methodology"
          textRole="bodySmall"
          {...(onMethodologyPress ? { onPress: onMethodologyPress } : {})}
        >
          read the methodology
        </Link>
        <Text variant="bodySmall" colorRole="inkMuted">
          for source hierarchy, confidence, and verification steps.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space['1'],
    paddingHorizontal: space['1'],
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space['1'],
  },
});
