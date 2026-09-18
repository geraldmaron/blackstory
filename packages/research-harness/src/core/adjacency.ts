import { encodeGeohash, haversineMeters } from '@repo/domain/geography/geohash';
import type { HarnessRawSubject } from './connector.js';

export interface RelationshipCandidatePair {
  readonly subjectA: HarnessRawSubject;
  readonly subjectB: HarnessRawSubject;
  readonly signals: readonly ('cross_reference' | 'shared_source' | 'spatiotemporal')[];
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
  return GENERIC_TEMPORAL_WINDOWS.filter((era) => year >= era.startYear && year <= era.endYear).map(
    (era) => era.id,
  );
}

/** Parses a year from text description. */
export function extractYearFromText(text: string): number | undefined {
  const match = text.match(/\b(17\d{2}|18\d{2}|19\d{2}|20\d{2})\b/u);
  return match ? parseInt(match[0], 10) : undefined;
}

/** Finds bounded review leads from explicit mentions, shared citations and time/place overlap.
 * Signals improve recall; none establishes identity or an edge.
 */
export function findRelationshipCandidates(
  subjects: readonly HarnessRawSubject[],
  options: { maxDistanceMeters?: number; geohashPrecision?: number } = {},
): readonly RelationshipCandidatePair[] {
  const maxDist = options.maxDistanceMeters ?? 5000;
  const precision = options.geohashPrecision ?? 5;
  if (
    !Number.isFinite(maxDist) ||
    maxDist < 0 ||
    !Number.isInteger(precision) ||
    precision < 1 ||
    precision > 12
  )
    throw new Error('Invalid relationship candidate distance or precision');
  const overlaps: RelationshipCandidatePair[] = [];

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
      if (a.id === b.id) continue;
      const signals: RelationshipCandidatePair['signals'][number][] = [];
      const mentions = (text: string, name: string): boolean => {
        const normalizedName = name.normalize('NFKC').toLowerCase().trim();
        if (normalizedName.length < 3) return false;
        const normalizedText = text.normalize('NFKC').toLowerCase();
        let offset = normalizedText.indexOf(normalizedName);
        while (offset >= 0) {
          const before = normalizedText.slice(0, offset).at(-1) ?? '';
          const after = normalizedText.slice(offset + normalizedName.length)[0] ?? '';
          if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) return true;
          offset = normalizedText.indexOf(normalizedName, offset + 1);
        }
        return false;
      };
      if (mentions(a.description, b.title) || mentions(b.description, a.title))
        signals.push('cross_reference');
      if (a.cites.some((url) => b.cites.includes(url))) signals.push('shared_source');
      let spatial: Pick<RelationshipCandidatePair, 'distanceMeters' | 'sharedGeohashPrefix'> = {};

      if (sharedEras.length > 0 && a.coordinates && b.coordinates) {
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

          signals.push('spatiotemporal');
          spatial = {
            distanceMeters: Math.round(distance),
            ...(sharedPrefix ? { sharedGeohashPrefix: sharedPrefix } : {}),
          };
        }
      }
      if (signals.length)
        overlaps.push({
          subjectA: a,
          subjectB: b,
          signals,
          temporalWindows: sharedEras,
          ...spatial,
        });
    }
  }

  // Explicit references are examined before the broader co-occurrence signals.
  return overlaps.sort(
    (a, b) =>
      Number(b.signals.includes('cross_reference')) - Number(a.signals.includes('cross_reference')),
  );
}
