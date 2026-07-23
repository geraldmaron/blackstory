/**
 * Shared Illinois EPA TRI live Envirofacts join helpers — facility registry to county FIPS,
 * reporting-form dedupe by facility/year. Used by fetch and fixture build scripts.
 */
import { isIllinoisCountyFips } from '../phase1-eji-tri-shared/il-counties.js';
import type { TriFacilityRow } from './phase1-tri-mapper.js';

export function buildTriFacilityCountyMap(
  payload: readonly Record<string, unknown>[],
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const row of payload) {
    const facilityId = String(row.tri_facility_id ?? row.TRI_FACILITY_ID ?? '').trim();
    const countyFips = String(row.state_county_fips_code ?? row.STATE_COUNTY_FIPS_CODE ?? '').trim();
    if (!facilityId || !/^\d{5}$/.test(countyFips)) continue;
    map.set(facilityId, countyFips);
  }
  return map;
}

export function triRowsFromReportingForms(
  payload: readonly Record<string, unknown>[],
  reportingYear: number,
  facilityCountyMap: ReadonlyMap<string, string>,
  expectedCountyFips?: readonly string[],
): { readonly rows: readonly TriFacilityRow[]; readonly rejected: readonly string[] } {
  const rejected: string[] = [];
  const seen = new Set<string>();
  const rows: TriFacilityRow[] = [];
  const expected = expectedCountyFips ? new Set(expectedCountyFips) : undefined;

  for (let index = 0; index < payload.length; index += 1) {
    const row = payload[index]!;
    const facilityId = String(row.tri_facility_id ?? row.TRI_FACILITY_ID ?? '').trim();
    if (!facilityId) {
      rejected.push(`json index=${index} missing facility id`);
      continue;
    }
    if (seen.has(facilityId)) continue;
    seen.add(facilityId);

    const countyFips = facilityCountyMap.get(facilityId);
    if (!countyFips || !isIllinoisCountyFips(countyFips)) {
      rejected.push(`json index=${index} missing county for facility=${facilityId}`);
      continue;
    }
    if (expected && !expected.has(countyFips)) {
      continue;
    }

    rows.push({ countyFips, reportingYear, facilityId });
  }

  return { rows, rejected };
}

export function triFixtureCsvFromRows(rows: readonly TriFacilityRow[]): string {
  const lines = ['county_fips,reporting_year,tri_facility_id'];
  for (const row of rows) {
    lines.push(`${row.countyFips},${row.reportingYear},${row.facilityId}`);
  }
  return `${lines.join('\n')}\n`;
}
