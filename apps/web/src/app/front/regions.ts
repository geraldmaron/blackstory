/**
 * Which records the front page may put a camera on, and the region each one is in.
 *
 * A record is eligible when the front page would show it (shown-records.ts: never quiet, never a
 * rendering, photographed, a claim with a linked source that reads as a sentence), is safe to put
 * a camera on (`cameraSafe`: a person only when the archive records a death), and is drawn as a
 * point at a stored precision finer than a county (`recordMarkFor`).
 */
import { recordMarkFor } from '../../lib/map-experience/geo-precision';
import type { ShownRecord } from './shown-records';

export type Region = 'Northeast' | 'Southeast' | 'Midwest' | 'Southwest' | 'West';

const REGION_STATES: Readonly<Record<Region, readonly string[]>> = {
  Northeast: ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'],
  Southeast: [
    'DE',
    'MD',
    'DC',
    'VA',
    'WV',
    'KY',
    'TN',
    'NC',
    'SC',
    'GA',
    'FL',
    'AL',
    'MS',
    'AR',
    'LA',
  ],
  Midwest: ['IL', 'IN', 'MI', 'OH', 'WI', 'IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD'],
  Southwest: ['TX', 'OK', 'NM', 'AZ'],
  West: ['CO', 'UT', 'NV', 'WY', 'ID', 'MT', 'CA', 'OR', 'WA', 'AK', 'HI'],
};

const REGION_BY_STATE: ReadonlyMap<string, Region> = new Map(
  (Object.entries(REGION_STATES) as [Region, readonly string[]][]).flatMap(([region, states]) =>
    states.map((state) => [state, region] as const),
  ),
);

export function regionOf(statePostal: string | undefined): Region | null {
  return statePostal ? (REGION_BY_STATE.get(statePostal.toUpperCase()) ?? null) : null;
}

/** The records a scene may use. */
export function isTourEligible(record: ShownRecord): boolean {
  return (
    record.plate !== undefined &&
    record.cameraSafe === true &&
    recordMarkFor(record.precision) !== 'none' &&
    regionOf(record.statePostal) !== null &&
    // A tour step names its place; a record without a locality would print only its precision.
    Boolean(record.locality?.trim()) &&
    // The claim must read as a sentence with a linked source (claimFor's own rule), kept here
    // so a record built elsewhere cannot slip a fragment into the tour.
    typeof record.claim.statement === 'string' &&
    /[.!?]["')\]”]?$/u.test(record.claim.statement.trim()) &&
    Boolean(record.claim.source?.href)
  );
}
