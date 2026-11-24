/**
 * The membership sentence every Archive view prints: how many of the filtered records this view
 * can show and why the rest are absent, so a record missing from the map reads as unmapped, not
 * deleted, and the mapped set is never mistaken for the whole (`docs/ui/DESIGN.md` 9.2).
 *
 * A sentence in body type, never a numeral on its own. Leaf module: Records and the Explore
 * client both call it.
 */

export type MembershipInput = {
  readonly view: 'map' | 'list' | 'timeline';
  /** Records the filters keep, mapped or not. */
  readonly matched: number;
  /** Of those, how many have a public point. */
  readonly mapped: number;
  /** Of those, how many have no documented decade (the timeline's Undated band). */
  readonly undated?: number;
  /** Records a decade range leaves out only because they have no decade. */
  readonly undatedExcluded?: number;
  /** A place is selected on the map; the list does not narrow to it. */
  readonly placeCarried?: boolean;
};

const n = (value: number) => value.toLocaleString('en-US');
const records = (value: number) => (value === 1 ? 'record' : 'records');

export function membershipSentence({
  view,
  matched,
  mapped,
  undated = 0,
  undatedExcluded = 0,
  placeCarried = false,
}: MembershipInput): string {
  if (matched <= 0 && undatedExcluded <= 0) return 'No records match these filters.';
  const unmapped = Math.max(0, matched - mapped);
  const parts: string[] = [];
  if (matched <= 0) {
    parts.push('No records match these filters.');
  } else if (view === 'map') {
    parts.push(
      unmapped === 0
        ? `${matched === 1 ? 'The 1 record here has' : `All ${n(matched)} records here have`} a point on the map.`
        : `${n(mapped)} of ${n(matched)} ${records(matched)} ${mapped === 1 ? 'has' : 'have'} a point on the map. The other ${n(unmapped)} ${unmapped === 1 ? 'has' : 'have'} no public point and ${unmapped === 1 ? 'is' : 'are'} in the list only.`,
    );
  } else {
    parts.push(
      unmapped === 0
        ? `${matched === 1 ? 'It has' : `All ${n(matched)} have`} a point on the map.`
        : `${n(mapped)} of ${n(matched)} ${mapped === 1 ? 'has' : 'have'} a point on the map.`,
    );
  }
  if (view === 'timeline' && undated > 0) {
    parts.push(
      `${n(undated)} ${undated === 1 ? 'has' : 'have'} no recorded decade and ${undated === 1 ? 'sits' : 'sit'} under Undated.`,
    );
  }
  if (undatedExcluded > 0) {
    parts.push(
      `${n(undatedExcluded)} more ${undatedExcluded === 1 ? 'has' : 'have'} no recorded decade and ${undatedExcluded === 1 ? 'is' : 'are'} left out of this decade range.`,
    );
  }
  if (placeCarried && view !== 'map') {
    parts.push('This list is not narrowed to the place selected on the map.');
  }
  return parts.join(' ');
}
