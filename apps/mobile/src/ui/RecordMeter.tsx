/**
 * Evidence meter — the canonical three-segment assessment mark, and the phone's half of the one
 * evidence language the site already speaks.
 *
 * Native surfaces used to print confidence as a fact-strip string ("High confidence") while the
 * site drew a graded meter with a letter. Same record, two assessments, depending on which screen
 * the reader opened. The segment count, the letter and the spoken sentence all come from
 * `@repo/public-contracts/evidence` so that cannot happen again.
 *
 * Colour is never the only cue: the letter rides beside the bars, and the whole mark carries one
 * `accessibilityLabel` sentence. `unrated` draws no filled segment and prints a middot, because a
 * record nobody assessed is not a weak record.
 */
import { StyleSheet, View } from 'react-native';

import {
  EVIDENCE_METER_SEGMENTS,
  evidenceMeterLabel,
  gradeForConfidence,
  gradeLabel,
  meterLevelForTier,
  type ConfidenceTier,
} from '@repo/public-contracts/evidence';

import { Text } from './Text';
import { space, useConfidenceColors, useThemeColors } from './tokens';

export type RecordMeterProps = {
  readonly tier: ConfidenceTier | string;
  /** Source count, when the surface actually knows it. Omitted, the label says nothing about it. */
  readonly sourceCount?: number;
  /** Hide the letter only where a titled Evidence field already carries it. */
  readonly showLetter?: boolean;
  /**
   * True inside a row that already speaks the whole record in one label. Nesting a second
   * accessible element there does not add the sentence, it hides it: the parent's label wins and
   * the meter's is dropped. A decorative meter expects its caller to have used
   * `evidenceMeterLabel` in that parent label.
   */
  readonly decorative?: boolean;
  readonly testID?: string;
};

const FILLED_BORDER_BY_TIER = { high: 'high', medium: 'medium', low: 'low' } as const;

export function RecordMeter({
  tier,
  sourceCount,
  showLetter = true,
  decorative = false,
  testID,
}: RecordMeterProps) {
  const theme = useThemeColors();
  const confidence = useConfidenceColors();
  const level = meterLevelForTier(tier);
  const grade = gradeForConfidence(tier);
  const filledKey = FILLED_BORDER_BY_TIER[tier as keyof typeof FILLED_BORDER_BY_TIER];
  const filled = filledKey ? confidence[filledKey].border : theme.inkMuted;

  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : evidenceMeterLabel(tier, sourceCount)}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : undefined}
      style={styles.mark}
      testID={testID}
    >
      <View style={styles.bars}>
        {Array.from({ length: EVIDENCE_METER_SEGMENTS }, (_, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              { backgroundColor: index < level ? filled : theme.border },
            ]}
          />
        ))}
      </View>
      {showLetter ? (
        <Text variant="code" colorRole="inkMuted" style={styles.letter}>
          {gradeLabel(grade)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space['1'],
  },
  bars: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  segment: {
    // 1dp, below the token scale (which starts at 8dp): this is a hairline on a 3dp bar, not a
    // corner treatment, and it matches the web meter's own 1px.
    borderRadius: 1,
    height: 3,
    width: 7,
  },
  letter: {
    // The letter is the non-colour cue, so it stays legible at the smallest row density.
    minWidth: 8,
    textAlign: 'center',
  },
});
