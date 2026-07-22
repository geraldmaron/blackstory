/**
 * Maps Census Gazetteer county rows into bb_reference.jurisdictions seed rows
 * (Postgres id hierarchy: county:{stateFips}{countyFips3}, parent state:{stateFips}).
 */
import { US_STATES } from '@repo/domain';
import type { GazetteerCountyRow } from '../../src/jurisdictions/tiger-gazetteer.js';

const IN_SCOPE_STATE_FIPS = new Set(US_STATES.map((state) => state.fips));

export type ReferenceCountySeed = {
  readonly id: string;
  readonly kind: 'county';
  readonly name: string;
  readonly stateFips: string;
  readonly countyFips: string;
  readonly parentId: string;
};

export type BuildReferenceCountySeedsResult = {
  readonly seeds: readonly ReferenceCountySeed[];
  readonly outOfScope: readonly { readonly geoid: string; readonly usps: string }[];
};

export function buildReferenceCountySeeds(
  rows: readonly GazetteerCountyRow[],
): BuildReferenceCountySeedsResult {
  const seeds: ReferenceCountySeed[] = [];
  const outOfScope: { geoid: string; usps: string }[] = [];

  for (const row of rows) {
    if (!IN_SCOPE_STATE_FIPS.has(row.stateFips)) {
      outOfScope.push({ geoid: row.geoid, usps: row.usps });
      continue;
    }
    seeds.push({
      id: `county:${row.geoid}`,
      kind: 'county',
      name: row.name,
      stateFips: row.stateFips,
      countyFips: row.countyFips3,
      parentId: `state:${row.stateFips}`,
    });
  }

  return { seeds, outOfScope };
}
