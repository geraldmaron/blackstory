/**
 * The home tour's records: three to six, chosen by rule from the catalog the home already loads.
 *
 * A record is eligible when the door would show it (door-decade-walk.ts: never quiet, never a
 * rendering, photographed, a claim with a linked source that reads as a sentence), is safe to put
 * a camera on (`cameraSafe`: a person only when the archive records a death), and is drawn as a
 * point at a stored precision finer than a county (`recordMarkFor`). The front door's own records
 * (the opening and the ones "Another record" cycles through) and the lead story's subject stay
 * out, so the tour never repeats them.
 *
 * Choice is greedy and deterministic: candidates sort by a stable hash of the record id, and each
 * pick is the one that adds a new region and sits farthest in time from what is already chosen.
 * Steps then read oldest first. The same catalog always gives the same tour.
 */
import { recordMarkFor, zoomForLocationPrecision } from '../lib/map-experience/geo-precision';
import type { DoorRecord } from './door-decade-walk';

export const TOUR_MIN = 3;
export const TOUR_TARGET = 5;
export const TOUR_MAX = 6;

export type DoorRegion = 'Northeast' | 'Southeast' | 'Midwest' | 'Southwest' | 'West';

const REGION_STATES: Readonly<Record<DoorRegion, readonly string[]>> = {
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

const REGION_BY_STATE: ReadonlyMap<string, DoorRegion> = new Map(
  (Object.entries(REGION_STATES) as [DoorRegion, readonly string[]][]).flatMap(([region, states]) =>
    states.map((state) => [state, region] as const),
  ),
);

export function regionOf(statePostal: string | undefined): DoorRegion | null {
  return statePostal ? (REGION_BY_STATE.get(statePostal.toUpperCase()) ?? null) : null;
}

/** FNV-1a: a stable, dependency-free order that does not follow the catalog's own. */
function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The records the tour may use, before any spread. */
export function isTourEligible(record: DoorRecord): boolean {
  return (
    record.plate !== undefined &&
    record.cameraSafe === true &&
    recordMarkFor(record.precision) !== 'none' &&
    regionOf(record.statePostal) !== null &&
    // A tour step names its place; a record without a locality would print only its precision.
    Boolean(record.locality?.trim()) &&
    // The claim must read as a sentence with a linked source (doorClaimFor's own rule), kept here
    // so a record built elsewhere cannot slip a fragment into the tour.
    typeof record.claim.statement === 'string' &&
    /[.!?]["')\]”]?$/u.test(record.claim.statement.trim()) &&
    Boolean(record.claim.source?.href)
  );
}

export type DoorTourOptions = {
  /** Catalog ids the front door already shows (the opening and its alternates). */
  readonly excludeIds?: ReadonlySet<string>;
  /** Text of the lead story (title and summary); a record named in it is its subject. */
  readonly leadStoryText?: string;
  readonly target?: number;
};

export function pickTourRecords(
  records: readonly DoorRecord[],
  options: DoorTourOptions = {},
): readonly DoorRecord[] {
  const target = Math.min(TOUR_MAX, Math.max(TOUR_MIN, options.target ?? TOUR_TARGET));
  const lead = options.leadStoryText?.toLowerCase() ?? '';
  const pool = records
    .filter(
      (record) =>
        isTourEligible(record) &&
        !options.excludeIds?.has(record.entityId) &&
        !(lead && lead.includes(record.name.trim().toLowerCase())),
    )
    .sort(
      (a, b) =>
        stableHash(a.entityId) - stableHash(b.entityId) || (a.entityId < b.entityId ? -1 : 1),
    );

  const chosen: DoorRecord[] = [];
  const decadesApart = (record: DoorRecord) =>
    chosen.length === 0
      ? 0
      : Math.min(...chosen.map((other) => Math.abs(other.decade - record.decade))) / 10;

  while (chosen.length < target && pool.length > 0) {
    const regions = new Set(chosen.map((record) => regionOf(record.statePostal)));
    const states = new Set(chosen.map((record) => record.statePostal));
    let best = -1;
    let bestScore = -Infinity;
    pool.forEach((record, index) => {
      // A new state outranks a new region only as a floor: distinct places first, then regions,
      // then distance in time (capped, so one very old record does not decide every pick).
      const score =
        (states.has(record.statePostal) ? 0 : 10_000) +
        (regions.has(regionOf(record.statePostal)) ? 0 : 1_000) +
        Math.min(decadesApart(record), 30);
      if (score > bestScore) {
        best = index;
        bestScore = score;
      }
    });
    chosen.push(pool.splice(best, 1)[0]!);
  }

  // At least one record outside the Southeast, when the catalog has one to give.
  if (chosen.length > 0 && chosen.every((record) => regionOf(record.statePostal) === 'Southeast')) {
    const other = pool.find((record) => regionOf(record.statePostal) !== 'Southeast');
    if (other) chosen[chosen.length - 1] = other;
  }

  if (chosen.length < TOUR_MIN) return [];
  return chosen.sort((a, b) => a.decade - b.decade || (a.entityId < b.entityId ? -1 : 1));
}

const COUNT_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'] as const;

/** The tour's visible heading, from what was chosen: "Five records, five places". */
export function tourHeading(records: readonly Pick<DoorRecord, 'statePostal'>[]): string {
  const count = COUNT_WORDS[records.length] ?? String(records.length);
  const places = new Set(records.map((record) => record.statePostal)).size;
  return places === records.length
    ? `${count} records, ${COUNT_WORDS[places]!.toLowerCase()} places`
    : `${count} records across the country`;
}

/** The deepest zoom a tour step may use: the record's own precision, never tighter. */
export const TOUR_MAX_ZOOM = 12;

export function tourZoom(precision: string): number {
  return Math.min(zoomForLocationPrecision(precision), TOUR_MAX_ZOOM);
}
