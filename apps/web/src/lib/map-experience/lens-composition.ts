/**
 * Dignity gate on lens-level composition (design-direction-v9-surfaces.md, "composition dignity
 * gate": "Under a violence-constrained lens, area fills and choropleths refuse to paint, records
 * stay discrete points, unselected spotlight and trace are refused, and every refusal states its
 * reason in visible text.").
 *
 * `camera-dignity.ts` already answers "is this one record violence-adjacent" for a selected
 * record. This module answers the sibling question the lens itself can ask before anything is
 * selected: is the reader's ACTIVE CONSTRAINT (today, the one topic filter the lens exposes)
 * itself about racial violence — so that a density/choropleth fill, or a spotlight/trace move
 * with nothing selected, cannot dramatise a whole filtered set of records at once.
 *
 * Deliberately not a second rule set: `isSubjectViolenceConstrained` builds the same `RecordLike`
 * shape `isViolenceAdjacent` already scores and delegates to it, so a topic and a record are
 * judged by one vocabulary (repo-92n2.33's own factoring requirement — the predicate must be
 * askable of an arbitrary subject, not hand-written twice for "a record" and "a lens").
 */

import { isViolenceAdjacent, type RecordLike } from './camera-dignity';
import type { CameraMove } from './camera-moves';

/** The part of the lens this module needs: its one active topic constraint, if any. */
export type LensSubject = {
  readonly topicId?: string | null | undefined;
  readonly topicLabel?: string | null | undefined;
};

function subjectFor(lens: LensSubject): RecordLike {
  const ids = lens.topicId ? [lens.topicId] : [];
  const tags = lens.topicLabel ? [lens.topicLabel] : [];
  return { topicIds: ids, topicTags: tags };
}

/** Whether the lens's active constraint is itself about racial violence. */
export function isSubjectViolenceConstrained(lens: LensSubject): boolean {
  if (!lens.topicId && !lens.topicLabel) return false;
  return isViolenceAdjacent(subjectFor(lens));
}

/**
 * Whether density/choropleth area fills may paint under the current lens.
 *
 * `false` under a violence-constrained lens: an area fill reads the harm itself as density (a
 * taller fill where more people were killed), which is exactly the dramatisation §4.3 forbids —
 * records must stay discrete points instead.
 */
export function lensPermitsAreaFill(lens: LensSubject): boolean {
  return !isSubjectViolenceConstrained(lens);
}

/** Moves the composition gate refuses with nothing selected, under a violence-constrained lens. */
const LENS_REFUSED_UNSELECTED_MOVES: readonly CameraMove[] = ['spotlight', 'trace'];

/**
 * Whether `move` is permitted with no record selected, under the current lens.
 *
 * `camera-dignity.ts`'s `isMoveAllowed` returns `true` for every move when nothing is selected —
 * correct for a lens that isn't itself about violence, since an ordinary move with no record in
 * frame is about geography. Under a violence-constrained lens, spotlight and trace still isolate
 * or draw a route across the very set of records the constraint names, which the same rule bans
 * whether or not one of them happens to be selected.
 */
export function lensPermitsUnselectedMove(move: CameraMove, lens: LensSubject): boolean {
  if (!LENS_REFUSED_UNSELECTED_MOVES.includes(move)) return true;
  return !isSubjectViolenceConstrained(lens);
}

/** Plain-language reason, matching `camera-dignity.ts`'s REFUSAL_NOTE register: no bead ids. */
export const AREA_FILL_REFUSAL_NOTE =
  'Not available while a topic about racial violence is selected. An area fill would read the harm itself as density; this archive keeps those records as individual points instead.';
