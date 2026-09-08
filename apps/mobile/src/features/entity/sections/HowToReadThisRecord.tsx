/**
 * Trust off-ramp for the record page: what the record rests on, then a way to read the method.
 *
 * The copy used to be one sentence cut across three Text nodes — "How this record is built" /
 * "read the methodology" / "for source hierarchy, confidence, and verification steps." — laid out
 * in a wrapping row. On a phone that resolves to three ragged lines that do not read as a
 * sentence, with the link stranded in the middle of one. The sentence is now a sentence, and the
 * link is a control on its own line with a real touch target.
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
