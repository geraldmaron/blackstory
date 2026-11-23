/**
 * The home page's journey: which records it visits, and what is said on the way between two.
 *
 * Eligibility is the tour's own (`isTourEligible`: never quiet, never a living person,
 * photographed, a whole sourced sentence, a locality), narrowed twice for a front door: a claim
 * graded "thinly evidenced" stays off, and the picks differ in kind before they differ in
 * anything else, so the journey is never three churches. Oldest first.
 *
 * These are examples from the archive, not a narrative: nothing here says one record led to the
 * next. The only connective facts are computed from the two records (distance and direction).
 */
import { isTourEligible, regionOf } from './regions';
import type { ShownRecord } from './shown-records';

export const JOURNEY_TARGET = 5;
export const JOURNEY_MIN = 3;

/** FNV-1a: a stable order that does not follow the catalog's own. */
function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

const byHash = (a: ShownRecord, b: ShownRecord) =>
  stableHash(a.entityId) - stableHash(b.entityId) || (a.entityId < b.entityId ? -1 : 1);

export function isJourneyEligible(record: ShownRecord): boolean {
  return isTourEligible(record) && record.claim.level !== 'low';
}

export function pickJourney(
  records: readonly ShownRecord[],
  excludeIds: ReadonlySet<string> = new Set(),
  target = JOURNEY_TARGET,
): readonly ShownRecord[] {
  const pool = records
    .filter((record) => isJourneyEligible(record) && !excludeIds.has(record.entityId))
    .sort(byHash);
  const chosen: ShownRecord[] = [];
  while (chosen.length < target && pool.length > 0) {
    const kinds = new Set(chosen.map((record) => record.kind));
    const states = new Set(chosen.map((record) => record.statePostal));
    const regions = new Set(chosen.map((record) => regionOf(record.statePostal)));
    const apart = (record: ShownRecord) =>
      chosen.length === 0
        ? 0
        : Math.min(...chosen.map((other) => Math.abs(other.decade - record.decade))) / 10;
    let best = 0;
    let bestScore = -Infinity;
    pool.forEach((record, index) => {
      const score =
        (states.has(record.statePostal) ? 0 : 10_000) +
        (kinds.has(record.kind) ? 0 : 4_000) +
        (regions.has(regionOf(record.statePostal)) ? 0 : 1_000) +
        Math.min(apart(record), 30);
      if (score > bestScore) {
        best = index;
        bestScore = score;
      }
    });
    chosen.push(pool.splice(best, 1)[0]!);
  }
  if (chosen.length < JOURNEY_MIN) return [];
  return chosen.sort((a, b) => a.decade - b.decade || (a.entityId < b.entityId ? -1 : 1));
}

/** Photographs for the title: one per state, never a journey record. */
export function pickTitlePlates(
  records: readonly ShownRecord[],
  excludeIds: ReadonlySet<string>,
  count: number,
): readonly ShownRecord[] {
  const states = new Set<string | undefined>();
  const picked: ShownRecord[] = [];
  for (const record of records.filter(isTourEligible).sort(byHash).reverse()) {
    if (picked.length >= count) break;
    if (excludeIds.has(record.entityId) || states.has(record.statePostal)) continue;
    // A landscape frame holds its slot; a scan known to be tall would be cropped to a strip.
    const { width, height } = record.plate ?? {};
    if (width && height && width < height) continue;
    states.add(record.statePostal);
    picked.push(record);
  }
  return picked;
}

const WINDS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
] as const;

const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle miles and the compass direction of travel from `a` to `b` ([lng, lat]). */
export function legBetween(
  a: readonly [number, number],
  b: readonly [number, number],
): { readonly miles: number; readonly heading: (typeof WINDS)[number] } {
  const [lng1, lat1, lng2, lat2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const h =
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2;
  const miles = 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return { miles, heading: WINDS[Math.round(bearing / 45) % 8]! };
}

/** "About 330 miles southwest", rounded to what a reader would say. */
export function legText(a: readonly [number, number], b: readonly [number, number]): string {
  const { miles, heading } = legBetween(a, b);
  if (miles < 5) return 'A few miles away';
  const step = miles < 100 ? 5 : miles < 1000 ? 10 : 50;
  const rounded = Math.round(miles / step) * step;
  return `About ${rounded.toLocaleString('en-US')} miles ${heading}`;
}

/** "Washington, D.C." from a long locality: its last two parts, the town and the state. */
export function shortPlace(locality: string): string {
  return locality
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(-2)
    .join(', ');
}
