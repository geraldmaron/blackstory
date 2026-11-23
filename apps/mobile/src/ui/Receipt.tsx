/**
 * The receipt line under an exhibit or a claim (docs/ui/DESIGN.md section 7.3): the credit or
 * source, an optional detail (license, publisher), the evidence grade in words with its glyph,
 * and an action. Mirrors the web kit's `Receipt`. A grade is never a letter.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { evidenceLabel } from '@/lib/evidence-words';

import { Link } from './Link';
import { RecordMeter } from './RecordMeter';
import { Text } from './Text';
import { space } from './tokens';

export type ReceiptProps = {
  /** The credit for an image, or the source for a claim. */
  readonly source: string;
  readonly href?: string;
  readonly detail?: string;
  readonly grade?: ReactNode;
  readonly action?: ReactNode;
  readonly testID?: string;
};

export function Receipt({ source, href, detail, grade, action, testID }: ReceiptProps) {
  return (
    <View style={styles.receipt} testID={testID}>
      <View style={styles.text}>
        {href ? (
          <Link href={href} textRole="bodySmall" accessibilityLabel={`Source: ${source}`}>
            {source}
          </Link>
        ) : (
          <Text variant="bodySmall" colorRole="inkMuted">
            {source}
          </Text>
        )}
        {detail ? (
          <Text variant="caption" colorRole="inkMuted">
            {detail}
          </Text>
        ) : null}
        {grade}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

/** The grade as its glyph (the three-step meter) and its words, read as one phrase. */
export function EvidenceGrade({
  tier,
  sourceCount,
}: {
  readonly tier: string;
  readonly sourceCount?: number;
}) {
  const words = evidenceLabel(tier, sourceCount);
  return (
    <View
      style={styles.grade}
      accessible
      accessibilityLabel={`Evidence: ${words}`}
      testID="evidence-grade"
    >
      <RecordMeter tier={tier} decorative />
      <Text variant="bodySmall" colorRole="inkMuted" style={styles.gradeWords}>
        {words}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  receipt: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space['2'],
  },
  text: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 200,
    gap: space['1'],
  },
  action: {
    flexShrink: 0,
  },
  grade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  gradeWords: {
    flexShrink: 1,
  },
});
