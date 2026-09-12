/**
 * Maps Census Gazetteer county rows into bb_reference.jurisdictions seed rows
 * (Postgres id hierarchy: county:{stateFips}{countyFips3}, parent state:{stateFips}).
 */
import { US_STATES } from '@repo/domain';
import {
  approximateCountyBBox,
  type GazetteerCountyRow,
} from '../../src/jurisdictions/tiger-gazetteer.js';

const IN_SCOPE_STATE_FIPS = new Set(US_STATES.map((state) => state.fips));

export type ReferenceCountySeed = {
  readonly id: string;
  readonly kind: 'county';
  readonly name: string;
  readonly stateFips: string;
  readonly countyFips: string;
  readonly parentId: string;
  /**
   * [west, south, east, north] approximate bbox centered on the Gazetteer centroid, sized to
   * the county's land+water area (see tiger-gazetteer.ts's approximateCountyBBox). Feeds
   * bb_reference.jurisdictions.location, a geography(Polygon, 4326) column — this is the
   * envelope upsertCountyBatch turns into that polygon.
   */
  readonly bbox: readonly [number, number, number, number];
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
      bbox: approximateCountyBBox(row),
    });
  }

  return { seeds, outOfScope };
}
