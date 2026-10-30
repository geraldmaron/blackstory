/**
 * Which state a published record counts toward, for the Footprint view and the catalog's state
 * filter. Both call this one function, so a Footprint cell and the catalog list it links to can
 * never disagree about which records they mean.
 *
 * The source is the release's curated `jurisdictionState` label ("Alsip, Illinois", "Selma, AL",
 * "Indiana"), resolved by the domain's own `findUsStateFromJurisdictionLabel`. Coordinates are
 * deliberately not a fallback: the point path is bounding-box first and can place a record in the
 * wrong state, and on 2026-10-29 the label alone resolved all but a handful of the 4,210 published
 * records. Those few (territories, a foreign country, a malformed label) land in an explicit
 * Unassigned bucket so totals still add up.
 *
 * Scope is the domain's: 50 states plus D.C.
 */
import {
  US_STATES,
  findUsStateByPostalCode,
  findUsStateFromJurisdictionLabel,
  isDisplayableJurisdictionLabel,
  type UsStateInfo,
} from '@repo/domain/map/geography';

/** The filter value for published records no state could be attributed to. */
export const UNASSIGNED_STATE = 'unassigned';

export function attributeState(label: string | null | undefined): UsStateInfo | undefined {
  if (!label || !isDisplayableJurisdictionLabel(label)) return undefined;
  return findUsStateFromJurisdictionLabel(label);
}

/** The state filter's value for a label: a postal code, or `unassigned`. */
export function stateFilterValueFor(label: string | null | undefined): string {
  return attributeState(label)?.postalCode ?? UNASSIGNED_STATE;
}

/** Accepts a postal code in any case, or `unassigned`; anything else is not a filter. */
export function normalizeStateFilterValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase() === UNASSIGNED_STATE) return UNASSIGNED_STATE;
  return findUsStateByPostalCode(trimmed)?.postalCode;
}

export function stateFilterLabel(value: string): string {
  if (value === UNASSIGNED_STATE) return 'No state assigned';
  return findUsStateByPostalCode(value)?.name ?? value;
}

/** Every state in the domain's scope, for a view that must show empty states, not omit them. */
export const FOOTPRINT_STATES: readonly UsStateInfo[] = US_STATES;
