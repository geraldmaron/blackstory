/**
 * Evidence meter: the three-segment glyph of an evidence grade. The grade itself is said in
 * words beside it (`EvidenceGrade` in Receipt.tsx, or the row's meta line) and never as a letter
 * (docs/ui/PROTECTED-EXPERIENCES.md; DESIGN.md section 7.3). How many segments are filled is the
 * cue, so color is never the only one. `unrated` fills none: a record nobody assessed is not a
 * weak record.
 */
import { StyleSheet, View } from 'react-native';

import {
  EVIDENCE_METER_SEGMENTS,
  meterLevelForCoverage,
  meterLevelForTier,
  type ConfidenceTier,
} from '@repo/public-contracts/evidence';
import { evidenceMeterLabel } from '@/lib/evidence-words';

import { space, useConfidenceColors, useThemeColors } from './tokens';

export type ResearchCoverageLevel = 'minimal' | 'partial' | 'substantial';

type RecordMeterSubject =
  | {
      readonly tier: ConfidenceTier | string;
      /** Source count, when the surface knows it. Omitted, the label says nothing about it. */
      readonly sourceCount?: number;
      readonly coverage?: never;
    }
  /*
   * Research coverage is how much of a record has been worked, not how well its claims are
   * supported. Same three bars, deliberately not the confidence palette: reading a full coverage
   * meter as "grade A" would turn "we have looked at all of this" into "all of this is proven".
   */
  | {
      readonly coverage: ResearchCoverageLevel;
      readonly tier?: never;
      readonly sourceCount?: never;
    };

export type RecordMeterProps = RecordMeterSubject & {
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
  coverage,
  decorative = false,
  testID,
}: RecordMeterProps) {
  const theme = useThemeColors();
  const confidence = useConfidenceColors();
  const isCoverage = coverage !== undefined;
  const level = isCoverage ? meterLevelForCoverage(coverage) : meterLevelForTier(tier ?? 'unrated');
  const filledKey = FILLED_BORDER_BY_TIER[tier as keyof typeof FILLED_BORDER_BY_TIER];
  const filled = isCoverage
    ? theme.accentGraphic
    : filledKey
      ? confidence[filledKey].border
      : theme.inkMuted;
  const label = isCoverage
    ? `Research coverage: ${coverage}`
    : evidenceMeterLabel(tier ?? 'unrated', sourceCount);

  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : undefined}
      style={styles.mark}
      testID={testID}
    >
      <View style={styles.bars}>
        {Array.from({ length: EVIDENCE_METER_SEGMENTS }, (_, index) => (
          <View
            key={index}
            style={[styles.segment, { backgroundColor: index < level ? filled : theme.border }]}
          />
        ))}
      </View>
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
    height: 3,
    width: 7,
  },
});
