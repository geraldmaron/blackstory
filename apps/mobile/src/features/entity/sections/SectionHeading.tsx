/**
 * Section heading with an explicit, testable heading LEVEL (1 = screen title, 2 = major
 * section, 3 = a nested sub-section within one).
 *
 * Ledger Line scale: level 1 = 17 Inter Medium entityTitle; level 2 = 13 rowTitle;
 * level 3 = caption.
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
import { Text, type TextRole } from '@/ui';

export type SectionHeadingLevel = 1 | 2 | 3;

export type SectionHeadingProps = {
  readonly level: SectionHeadingLevel;
  readonly children: string;
};

const VARIANT_BY_LEVEL: Record<SectionHeadingLevel, TextRole> = {
  1: 'entityTitle',
  2: 'rowTitle',
  3: 'caption',
};

export function SectionHeading({ level, children }: SectionHeadingProps) {
  return (
    <Text variant={VARIANT_BY_LEVEL[level]} isHeading testID={`heading-level-${level}`}>
      {children}
    </Text>
  );
}
