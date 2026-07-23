import { encodeGeohash, haversineMeters } from '@repo/domain/geography/geohash';
import type { HarnessRawSubject } from './connector.js';

export interface SpatialTemporalOverlap {
  readonly subjectA: HarnessRawSubject;
  readonly subjectB: HarnessRawSubject;
  readonly distanceMeters?: number | undefined;
  readonly sharedGeohashPrefix?: string | undefined;
  readonly policyEras: readonly string[];
}

export type PolicyEraConfig = {
  readonly id: string;
  readonly startYear: number;
  readonly endYear: number;
};

export const JUXTAPOSITION_ERAS: readonly PolicyEraConfig[] = [
  { id: 'holc_fha', startYear: 1933, endYear: 1968 },
  { id: 'fair_housing', startYear: 1968, endYear: 1985 },
  { id: 'cra_contemporary', startYear: 1985, endYear: 2026 },
  { id: 'pre_drug_war', startYear: 1800, endYear: 1970 },
  { id: 'drug_war_escalation', startYear: 1971, endYear: 1985 },
  { id: 'crack_cocaine_era', startYear: 1986, endYear: 2010 },
  { id: 'sentencing_reform', startYear: 2010, endYear: 2026 },
];

/** Resolve policy eras for a given year. */
export function resolvePolicyErasForYear(year: number): readonly string[] {
  return JUXTAPOSITION_ERAS.filter((era) => year >= era.startYear && year <= era.endYear).map((era) => era.id);
}

/** Parses a year from text description. */
export function extractYearFromText(text: string): number | undefined {
  const match = text.match(/\b(17\d{2}|18\d{2}|19\d{2}|20\d{2})\b/u);
  return match ? parseInt(match[0], 10) : undefined;
}

/** Computes spatial-temporal co-occurrence overlaps between raw subjects. */
export function findSpatialTemporalOverlaps(
  subjects: readonly HarnessRawSubject[],
  options: { maxDistanceMeters?: number; geohashPrecision?: number } = {},
): readonly SpatialTemporalOverlap[] {
  const maxDist = options.maxDistanceMeters ?? 5000; // default 5km
  const precision = options.geohashPrecision ?? 5; // default ~5km geohash resolution
  const overlaps: SpatialTemporalOverlap[] = [];

  for (let i = 0; i < subjects.length; i++) {
    const a = subjects[i];
    if (!a) continue;
    const yearA = extractYearFromText(a.description) || extractYearFromText(a.title);
    const erasA = yearA !== undefined ? resolvePolicyErasForYear(yearA) : [];

    for (let j = i + 1; j < subjects.length; j++) {
      const b = subjects[j];
      if (!b) continue;
      const yearB = extractYearFromText(b.description) || extractYearFromText(b.title);
      const erasB = yearB !== undefined ? resolvePolicyErasForYear(yearB) : [];

      const sharedEras = erasA.filter((era) => erasB.includes(era));
      if (sharedEras.length === 0) continue;

      if (a.coordinates && b.coordinates) {
        const distance = haversineMeters(
          { lat: a.coordinates.latitude, lng: a.coordinates.longitude },
          { lat: b.coordinates.latitude, lng: b.coordinates.longitude },
        );

        if (distance <= maxDist) {
          const hashA = encodeGeohash(a.coordinates.latitude, a.coordinates.longitude, precision);
          const hashB = encodeGeohash(b.coordinates.latitude, b.coordinates.longitude, precision);
          let sharedPrefix = '';
          for (let p = 0; p < precision; p++) {
            if (hashA[p] === hashB[p]) {
              sharedPrefix += hashA[p];
            } else {
              break;
            }
          }

          overlaps.push({
            subjectA: a,
            subjectB: b,
            distanceMeters: Math.round(distance),
            ...(sharedPrefix ? { sharedGeohashPrefix: sharedPrefix } : {}),
            policyEras: sharedEras,
          });
        }
      }
    }
  }

  return overlaps;
}
