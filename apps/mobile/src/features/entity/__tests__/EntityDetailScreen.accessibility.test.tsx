/**
 * Heading-order accessibility check.
 *
 * PLATFORM CAVEAT (read before extending this test): this Expo/React Native SDK (56) exposes no
 * cross-platform "heading level" accessibility prop — `accessibilityRole="header"` marks
 * something a heading to VoiceOver/TalkBack, but neither platform surfaces a NUMERIC level
 * through that public API here (unlike web's `<h1>`–`<h6>`/`aria-level`). `SectionHeading.tsx`
 * therefore encodes an explicit, author-side level via `testID="heading-level-N"`, and this
 * test verifies THAT authored structure is sequential and non-skipping. It is a real assertion
 * about this screen's heading hierarchy, but it does NOT prove VoiceOver's "Headings" rotor or
 * TalkBack's heading navigation will read the levels back distinctly — that would require an
 * on-device VoiceOver/TalkBack pass (deferred to Maestro/manual QA per this bead's final
 * report), because the OS-level surfaces here don't currently carry a level at all.
 */
import { render } from '@testing-library/react-native';
import { EntityDetailScreen } from '../EntityDetailScreen';
import { normalizeEntity } from '../normalize';
import type { EntityDetailState } from '../useEntityDetail';
import { fullEntityFixture } from '../testFixtures';

function readyState(): EntityDetailState {
  const entity = normalizeEntity(fullEntityFixture('place'))!;
  return {
    kind: 'ready',
    result: { status: 'ready', entity, freshness: { source: 'network', fetchedAt: 0, degraded: false } },
  };
}

/**
 * Extracts, in render order, the level of every heading THIS SCREEN authored via
 * `SectionHeading` (`testID="heading-level-N"`). `@/ui`'s `EmptyState`/`ErrorState` primitives
 * (MOB-007, out of this bead's ownership) also mark their own title as
 * `accessibilityRole="header"` via `Text`'s `isHeading` default for the `subtitle` variant —
 * those are real, correctly-nested headings too (a gap notice's title genuinely is a heading
 * for its section), but they carry no `heading-level-N` marker for this test to key off, so
 * they are deliberately excluded from the STRICT sequential-level assertion below rather than
 * given a guessed level. They are still real headers a screen reader will announce; this test's
 * scope is the numbered hierarchy this bead's own code controls.
 */
function headingLevelsInOrder(root: ReturnType<typeof render>): number[] {
  const headers = root.getAllByRole('header');
  const levels: number[] = [];
  for (const node of headers) {
    const testID = node.props.testID as string | undefined;
    const match = /^heading-level-(\d)$/.exec(testID ?? '');
    if (match) levels.push(Number(match[1]));
  }
  return levels;
}

describe('EntityDetailScreen — heading order', () => {
  it('opens with exactly one level-1 heading (the record title) before any level-2', async () => {
    const root = await render(<EntityDetailScreen state={readyState()} />);
    const levels = headingLevelsInOrder(root);
    expect(levels[0]).toBe(1);
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
  });

  it('never skips a level — each heading is at most one level deeper than the deepest seen so far', async () => {
    const root = await render(<EntityDetailScreen state={readyState()} />);
    const levels = headingLevelsInOrder(root);
    let deepestSeen = 0;
    for (const level of levels) {
      expect(level).toBeLessThanOrEqual(deepestSeen + 1);
      deepestSeen = Math.max(deepestSeen, level);
    }
  });

  it('renders at least one level-2 section heading and level-3 claim headings', async () => {
    const root = await render(<EntityDetailScreen state={readyState()} />);
    const levels = headingLevelsInOrder(root);
    expect(levels).toContain(2);
    expect(levels).toContain(3);
  });
});
