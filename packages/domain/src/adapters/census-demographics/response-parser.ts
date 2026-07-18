/**
 * Parsers for the Census data API's array-of-arrays response shape:
 *   [["NAME","P1_001N","P1_003N","state","county"], ["Autauga County, Alabama","58805","11496","01","001"], ...]
 * Pure functions — fetch lives in `./fetch-county-populations.ts`.
 */
import type { CensusDecennialVintage, CountyDecadePopulation } from './types.js';

/** Raised when a vintage's variables.json does not label our expected ids as expected —
 * fail closed rather than ingest a column that silently measures something else. */
export class CensusVariableMismatchError extends Error {}

const BLACK_ALONE_LABEL_PATTERN = /black or african american alone/i;
const TOTAL_LABEL_PATTERN = /^\s*total/i;

/** Asserts the vintage's expected variable ids carry the expected labels in the dataset's own
 * dictionary. Returns void on success; throws `CensusVariableMismatchError` otherwise. */
export function assertVariableLabels(
  vintage: CensusDecennialVintage,
  variablesJson: { readonly variables?: Record<string, { readonly label?: string }> },
): void {
  const variables = variablesJson.variables ?? {};
  const total = variables[vintage.totalVariable]?.label ?? '';
  const black = variables[vintage.blackAloneVariable]?.label ?? '';
  if (!TOTAL_LABEL_PATTERN.test(total.replace(/!!/g, ' '))) {
    throw new CensusVariableMismatchError(
      `${vintage.dataset}: expected ${vintage.totalVariable} to be a total-population variable, got label "${total}"`,
    );
  }
  if (!BLACK_ALONE_LABEL_PATTERN.test(black.replace(/!!/g, ' '))) {
    throw new CensusVariableMismatchError(
      `${vintage.dataset}: expected ${vintage.blackAloneVariable} to be "Black or African American alone", got label "${black}"`,
    );
  }
}

/** Parses one vintage's data response into county rows. Rows with unparseable counts or FIPS
 * are collected as rejections, never silently dropped. */
export function parseCountyPopulationResponse(
  vintage: CensusDecennialVintage,
  payload: readonly (readonly string[])[],
): { readonly rows: readonly CountyDecadePopulation[]; readonly rejected: readonly string[] } {
  if (payload.length < 2) return { rows: [], rejected: ['response has no data rows'] };
  const header = payload[0]!;
  const nameIdx = header.indexOf('NAME');
  const totalIdx = header.indexOf(vintage.totalVariable);
  const blackIdx = header.indexOf(vintage.blackAloneVariable);
  const stateIdx = header.indexOf('state');
  const countyIdx = header.indexOf('county');
  if ([nameIdx, totalIdx, blackIdx, stateIdx, countyIdx].some((idx) => idx < 0)) {
    throw new CensusVariableMismatchError(
      `${vintage.dataset}: response header ${JSON.stringify(header)} is missing expected columns`,
    );
  }

  const rows: CountyDecadePopulation[] = [];
  const rejected: string[] = [];
  for (const row of payload.slice(1)) {
    const stateFips = row[stateIdx] ?? '';
    const countyFips = row[countyIdx] ?? '';
    const totalPopulation = Number(row[totalIdx]);
    const blackPopulation = Number(row[blackIdx]);
    if (!/^\d{2}$/.test(stateFips) || !/^\d{3}$/.test(countyFips)) {
      rejected.push(`bad FIPS: ${JSON.stringify(row)}`);
      continue;
    }
    if (!Number.isFinite(totalPopulation) || !Number.isFinite(blackPopulation)) {
      rejected.push(`bad counts: ${JSON.stringify(row)}`);
      continue;
    }
    rows.push({
      fips5: `${stateFips}${countyFips}`,
      stateFips,
      countyFips,
      countyName: row[nameIdx] ?? '',
      decade: vintage.decade,
      totalPopulation,
      blackPopulation,
    });
  }
  return { rows, rejected };
}
