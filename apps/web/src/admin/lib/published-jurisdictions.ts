/**
 * One row per record in the active release with what the footprint needs: its location label,
 * kind, record maturity and coordinates. Read from `published.search_index` (label, kind,
 * maturity) and `published.release_entities` (lat/lng), both keyed by the active release.
 *
 * The whole release is about four thousand short rows, so callers aggregate in TypeScript rather
 * than restate the state attribution in SQL; see footprint-attribution.ts for why that matters.
 */
import { queryPostgres } from './canonical-postgres-client.js';
import { UNASSIGNED_STATE, stateFilterValueFor } from './footprint-attribution.js';

export type PublishedJurisdictionRow = {
  readonly entityId: string;
  readonly jurisdictionLabel: string | null;
  readonly kind: string;
  readonly recordMaturity: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
};

export type PublishedJurisdictions = {
  readonly releaseId: string;
  readonly rows: readonly PublishedJurisdictionRow[];
};

type Row = {
  readonly entity_id: string;
  readonly label: unknown;
  readonly kind: string | null;
  readonly maturity: unknown;
  readonly lat: number | null;
  readonly lng: number | null;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export async function readPublishedJurisdictions(): Promise<PublishedJurisdictions> {
  const releases = await queryPostgres<{ readonly release_id: string }>(
    `SELECT release_id FROM published.v_active_release_id`,
  );
  const releaseId = releases[0]?.release_id ?? '';
  const rows = await queryPostgres<Row>(
    `SELECT s.entity_id,
            s.facets->>'jurisdictionState' AS label,
            s.kind,
            s.facets->>'recordMaturity' AS maturity,
            re.lat, re.lng
       FROM published.search_index s
       LEFT JOIN published.release_entities re
         ON re.release_id = s.release_id AND re.entity_id = s.entity_id
      WHERE s.release_id = $1`,
    [releaseId],
  );
  return {
    releaseId,
    rows: rows.map((row) => ({
      entityId: row.entity_id,
      jurisdictionLabel: asNonEmptyString(row.label),
      kind: row.kind ?? 'unknown',
      recordMaturity: asNonEmptyString(row.maturity),
      lat: typeof row.lat === 'number' ? row.lat : null,
      lng: typeof row.lng === 'number' ? row.lng : null,
    })),
  };
}

/** Entity ids a state filter value selects: a postal code, or `unassigned`. */
export function entityIdsForStateFilter(
  rows: readonly PublishedJurisdictionRow[],
  value: string,
): readonly string[] {
  const wanted = value === UNASSIGNED_STATE ? UNASSIGNED_STATE : value.toUpperCase();
  return rows
    .filter((row) => stateFilterValueFor(row.jurisdictionLabel) === wanted)
    .map((row) => row.entityId);
}
