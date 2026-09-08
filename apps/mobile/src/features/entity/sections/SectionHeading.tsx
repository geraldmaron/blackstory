/**
 * Section heading with an explicit, testable heading LEVEL (1 = screen title, 2 = major
 * section, 3 = a nested sub-section within one).
 *
 * Scale: level 1 = 26 title, level 2 = 20 subtitle, level 3 = 13 rowTitle, over a 17 editorial
 * body. It used to be 17 / 13 / 12 over that same 17 body, which put every section heading BELOW
 * its own prose in size — a heading smaller than the paragraph it introduces reads as a stray
 * label, not as structure, and the record's own name read at the same size as its summary.
 *
 * `fieldLabel` is the label-over-value presentation: a beat whose heading names a field
 * (a claim's predicate, a provenance key) sets its heading in the same uppercase caption the
 * anatomy facts use, so one rhythm covers every label on the page.
 *
 * WHY A CUSTOM LEVEL, NOT A NATIVE ONE: this Expo/React Native SDK (56) exposes no
 * cross-platform "heading level" accessibility prop (unlike web's `<h1>`–`<h6>` or ARIA
 * `aria-level`) — `accessibilityRole="header"` (set by `@/ui`'s `Text` via `isHeading`) marks
 * something as a heading to VoiceOver/TalkBack, but neither platform's public API here carries
 * a numeric level through that role. This component still enforces and exposes an explicit
 * level (via `testID`) so the screen's heading STRUCTURE is real and testable — see
 * `__tests__/EntityDetailScreen.accessibility.test.tsx`, which asserts the rendered heading
 * sequence never skips a level. Real per-level VoiceOver "Headings" rotor / TalkBack navigation
 * behavior is a device-level concern deferred to Maestro/manual QA — this test proves the
 * authoring structure is sound, not that iOS/Android surface a level number (they do not, on
 * this SDK).
 */
import { StyleSheet } from 'react-native';

import { Text, type TextRole } from '@/ui';

export type SectionHeadingLevel = 1 | 2 | 3;

export type SectionHeadingProps = {
  readonly level: SectionHeadingLevel;
  /** Set the heading as a field label rather than a section title. */
  readonly fieldLabel?: boolean;
  readonly children: string;
};

const VARIANT_BY_LEVEL: Record<SectionHeadingLevel, TextRole> = {
  1: 'title',
  2: 'subtitle',
  3: 'rowTitle',
};

export function SectionHeading({ level, fieldLabel = false, children }: SectionHeadingProps) {
  if (fieldLabel) {
    return (
      <Text
        variant="caption"
        colorRole="inkSubtle"
        isHeading
        style={styles.fieldLabel}
        testID={`heading-level-${level}`}
      >
        {children}
      </Text>
    );
  }
  return (
    <Text variant={VARIANT_BY_LEVEL[level]} isHeading testID={`heading-level-${level}`}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
