/**
 * The records the retelling shows in scenes 2, 3 and 5 (docs/ui/DESIGN.md section 9.7).
 *
 * The catalog has no gender field, so these are editorial picks from a reviewed shortlist
 * (docs/ui/v13/retelling-picks.md), fixed per release and never rotated: the opening is the same
 * for a whole class and can be cited. A pick is a record id and nothing else. Its name, place,
 * photograph and claim are read from the published record at render time.
 *
 * `provisional: true` means the owner has not chosen this record. All three are provisional.
 */
import { isJourneyEligible } from '../home/home-journey';
import type { DoorRecord } from '../door-decade-walk';
import type { RecordSceneId } from './retelling-scenes';

export type RetellingPick = {
  readonly recordId: string;
  /** True until the owner picks the record from the shortlist. */
  readonly provisional: boolean;
};

export const RETELLING_PICKS: Readonly<Record<RecordSceneId, RetellingPick>> = {
  // John Gilmore Riley House, Tallahassee, Florida.
  'his-story': { recordId: 'nrhp-black-heritage-78000950', provisional: true },
  // Harriet Tubman Home for the Aged, Auburn, New York.
  'her-story': { recordId: 'nrhp-black-heritage-74001222', provisional: true },
  // Ridgley Methodist Episcopal Church, Landover, Maryland.
  'their-story': { recordId: 'nrhp-black-heritage-05000149', provisional: true },
};

/**
 * The picked record as the page may show it, or nothing. A pick is re-checked against the live
 * record on every render: if it has since lost its photograph, been marked sensitive or quiet, or
 * fallen to "thinly evidenced", the scene shows its word and sentence with no exhibit instead of
 * a record the rules no longer allow.
 */
export function pickedRecord(
  records: readonly DoorRecord[],
  pick: RetellingPick,
): DoorRecord | null {
  const record = records.find((candidate) => candidate.entityId === pick.recordId);
  return record && isJourneyEligible(record) ? record : null;
}
