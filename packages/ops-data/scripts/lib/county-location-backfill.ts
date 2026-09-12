/**
 * Backfill logic for `bb_reference.jurisdictions.location` on county rows that were loaded
 * before load-reference-counties.ts started writing that column (see that file's
 * upsertCountyBatch, and repo-kb5a: location was NULL for all 3,144 existing county rows).
 *
 * Re-derives each row's bbox envelope from the same Census Gazetteer source the loader itself
 * uses, matched purely by the row's own GEOID (state_fips || county_fips) — no new data source,
 * no invented coordinates. Split into plan (read-only) and apply (write) halves, each taking an
 * injected client, so both are unit-testable against a fake client with no live database (see
 * county-location-backfill.test.ts). The CLI wrapper (backfill-county-jurisdiction-locations.ts)
 * owns the real Pool/transaction and the DRY_RUN/APPLY gate.
 */
import type { PoolClient } from 'pg';
import type { JurisdictionBBoxDoc } from '../../src/jurisdictions/schema.js';
import {
  approximateCountyBBox,
  type GazetteerCountyRow,
} from '../../src/jurisdictions/tiger-gazetteer.js';

export type CountyLocationBackfillClient = Pick<PoolClient, 'query'>;

export type CountyLocationMatch = {
  readonly id: string;
  readonly geoid: string;
  readonly bbox: JurisdictionBBoxDoc;
};

export type CountyLocationPlan = {
  readonly matched: readonly CountyLocationMatch[];
  readonly unmatched: readonly { readonly id: string; readonly geoid: string }[];
};

/** Pure — GEOID -> approximate bbox, from a parsed Gazetteer file (same function the loader uses). */
export function buildGazetteerBBoxIndex(
  rows: readonly GazetteerCountyRow[],
): Map<string, JurisdictionBBoxDoc> {
  const index = new Map<string, JurisdictionBBoxDoc>();
  for (const row of rows) {
    index.set(row.geoid, approximateCountyBBox(row));
  }
  return index;
}

/**
 * Reads existing county rows with no location and matches each to a bbox by GEOID. Read-only —
 * never writes (see applyCountyLocationBackfill for the write half).
 */
export async function planCountyLocationBackfill(
  client: CountyLocationBackfillClient,
  bboxIndex: ReadonlyMap<string, JurisdictionBBoxDoc>,
): Promise<CountyLocationPlan> {
  const result = await client.query(
    `SELECT id, state_fips, county_fips
       FROM bb_reference.jurisdictions
      WHERE kind = 'county' AND location IS NULL
      ORDER BY id`,
  );
  const rows = result.rows as readonly {
    readonly id: string;
    readonly state_fips: string;
    readonly county_fips: string;
  }[];

  const matched: CountyLocationMatch[] = [];
  const unmatched: { id: string; geoid: string }[] = [];
  for (const row of rows) {
    const geoid = `${row.state_fips}${row.county_fips}`;
    const bbox = bboxIndex.get(geoid);
    const isUsableBBox = bbox !== undefined && bbox[0] < bbox[2] && bbox[1] < bbox[3];
    if (isUsableBBox) {
      matched.push({ id: row.id, geoid, bbox: bbox! });
    } else {
      unmatched.push({ id: row.id, geoid });
    }
  }
  return { matched, unmatched };
}

/** Writes `location` for each matched row. Caller owns the transaction and the apply gate. */
export async function applyCountyLocationBackfill(
  client: CountyLocationBackfillClient,
  matched: readonly CountyLocationMatch[],
): Promise<number> {
  let applied = 0;
  for (const row of matched) {
    const [west, south, east, north] = row.bbox;
    await client.query(
      `UPDATE bb_reference.jurisdictions
          SET location = ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography,
              updated_at = now()
        WHERE id = $5 AND kind = 'county'`,
      [west, south, east, north, row.id],
    );
    applied += 1;
  }
  return applied;
}
