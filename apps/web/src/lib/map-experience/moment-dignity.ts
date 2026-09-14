/**
 * Whether a map moment renders as PLATE · STILL rather than PLATE · LIVE (design-direction-v9-
 * atlas.md §4.3, SP-26 / repo-92n2.33).
 *
 * THE HARD PART this bead names is that plainness must not be a judgement each author makes per
 * page: a moment about violence marked "not plain" by a forgetful call site is a dignity
 * regression. So a moment's plainness is derived from its subject's violence-adjacency — the same
 * predicate `camera-dignity.ts` already computes for a selected record and `lens-composition.ts`
 * for a lens's active constraint — reused here rather than a third rule set, so a record, a lens
 * and a moment all agree about what counts as violence-adjacent from the one place that decides
 * it.
 *
 * `override` is the escape hatch, not a second way to compute the default: it is an author's
 * explicit, call-site decision (MapMoment.tsx's own `plain` prop), for the cases derivation cannot
 * reach — a moment with no single subject (a region-wide establishing shot), or a documented
 * exception. When present it always wins, in both directions.
 */

import { isViolenceAdjacent, type RecordLike } from './camera-dignity';

/** The record or era a moment frames. Reuses `camera-dignity.ts`'s vocabulary rather than a moment-specific shape. */
export type MomentSubject = RecordLike;

export function resolveMomentPlain(
  subject: MomentSubject | null | undefined,
  override?: boolean,
): boolean {
  if (override !== undefined) return override;
  if (!subject) return false;
  return isViolenceAdjacent(subject);
}
