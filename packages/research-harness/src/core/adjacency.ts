import { encodeGeohash, haversineMeters } from '@repo/domain/geography/geohash';
import type { HarnessRawSubject } from './connector.js';

export interface SpatialTemporalOverlap {
  readonly subjectA: HarnessRawSubject;
  readonly subjectB: HarnessRawSubject;
  readonly distanceMeters?: number | undefined;
  readonly sharedGeohashPrefix?: string | undefined;
  readonly temporalWindows: readonly string[];
}

export type PolicyEraConfig = {
  readonly id: string;
  readonly startYear: number;
  readonly endYear: number;
};

export const GENERIC_TEMPORAL_WINDOWS: readonly PolicyEraConfig[] = [
  { id: '18th_century', startYear: 1700, endYear: 1799 },
  { id: '19th_century_early', startYear: 1800, endYear: 1849 },
  { id: '19th_century_late', startYear: 1850, endYear: 1899 },
  { id: '20th_century_early', startYear: 1900, endYear: 1949 },
  { id: '20th_century_late', startYear: 1950, endYear: 1999 },
  { id: '21st_century_early', startYear: 2000, endYear: 2049 },
];

/** Resolve generic temporal windows for a given year. */
export function resolveTemporalWindowsForYear(year: number): readonly string[] {
  return GENERIC_TEMPORAL_WINDOWS.filter((era) => year >= era.startYear && year <= era.endYear).map((era) => era.id);
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
    const erasA = yearA !== undefined ? resolveTemporalWindowsForYear(yearA) : [];

    for (let j = i + 1; j < subjects.length; j++) {
      const b = subjects[j];
      if (!b) continue;
      const yearB = extractYearFromText(b.description) || extractYearFromText(b.title);
      const erasB = yearB !== undefined ? resolveTemporalWindowsForYear(yearB) : [];

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
            temporalWindows: sharedEras,
          });
        }
      }
    }
  }

  return overlaps;
}
