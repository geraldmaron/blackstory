/**
 * Trust off-ramp for the record page: what the record rests on, then a way to read the method.
 *
 * The sentence is one Text node and the link is a control on its own line with a real touch
 * target. One sentence cut across three Text nodes in a wrapping row resolves on a phone to three
 * ragged lines that do not read as a sentence, with the link stranded in the middle of one.
 */
import { StyleSheet, View } from 'react-native';
import { Link, Text, space } from '@/ui';

const METHODOLOGY_URL = 'https://blackstory.app/methodology';

export type HowToReadThisRecordProps = {
  readonly onMethodologyPress?: () => void;
};

export function HowToReadThisRecord({ onMethodologyPress }: HowToReadThisRecordProps) {
  return (
    <View style={styles.wrap}>
      <Text variant="bodySmall" colorRole="inkMuted">
        How this record is built: source hierarchy, confidence, and verification steps.
      </Text>
      <Link
        href={METHODOLOGY_URL}
        textRole="bodySmall"
        accessibilityLabel="Read the methodology"
        {...(onMethodologyPress ? { onPress: onMethodologyPress } : {})}
      >
        Read the methodology
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space['1'],
    paddingHorizontal: space['1'],
  },
});
