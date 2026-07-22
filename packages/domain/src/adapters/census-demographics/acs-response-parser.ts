/**
 * Parsers for ACS 5-year array-of-arrays responses. Pure functions — fetch lives in
 * `./fetch-acs-profiles.ts`.
 *
 * ACS-specific hazard the decennial parser doesn't have: suppressed/uncomputable estimates
 * are published as negative sentinel values (-666666666 "median cannot be computed",
 * -888888888, -999999999, and jam values in that family). No legitimate estimate in our
 * starter set (counts, medians in dollars) can be negative, so ANY negative value is treated
 * as a suppression marker: the field is omitted from `values` and recorded in `suppressed`.
 */
import { buildAcsVariableUrl, buildAcsVariablesUrl } from './acs-url-builder.js';
import type { FetchLike } from './fetch-county-populations.js';
import { CensusVariableMismatchError } from './response-parser.js';
import type { AcsProfileRow, AcsVintage } from './acs-types.js';

export type VariablesJson = {
  readonly variables?: Record<string, { readonly label?: string; readonly concept?: string }>;
};

type SingleVariableJson = {
  readonly label?: string;
  readonly concept?: string;
};

/** Bulk variables.json plus per-id fallback when Census omits MOE entries. */
export async function loadAcsVariablesDictionary(
  vintage: AcsVintage,
  fetchImpl: FetchLike,
): Promise<VariablesJson> {
  const response = await fetchImpl(buildAcsVariablesUrl(vintage));
  if (!response.ok) {
    throw new Error(`${vintage.dataset}: variables.json fetch failed (${response.status})`);
  }
  const bulk = (await response.json()) as VariablesJson;
  const variables: Record<string, { label?: string; concept?: string }> = {
    ...(bulk.variables ?? {}),
  };

  for (const spec of vintage.variables) {
    const entry = variables[spec.id];
    const label = (entry?.label ?? '').replace(/!!/g, ' ');
    if (label) continue;

    const varResponse = await fetchImpl(buildAcsVariableUrl(vintage, spec.id));
    if (!varResponse.ok) {
      throw new Error(
        `${vintage.dataset}: variable ${spec.id} metadata fetch failed (${varResponse.status})`,
      );
    }
    const varJson = (await varResponse.json()) as SingleVariableJson;
    variables[spec.id] = {
      ...(varJson.label !== undefined ? { label: varJson.label } : {}),
      ...(varJson.concept !== undefined ? { concept: varJson.concept } : {}),
    };
  }

  return { variables };
}

/** Asserts every expected variable id carries the expected label (and concept, when the
 * spec demands one) in the dataset's own dictionary. Fail closed on any mismatch. */
export function assertAcsVariableLabels(vintage: AcsVintage, variablesJson: VariablesJson): void {
  const variables = variablesJson.variables ?? {};
  for (const spec of vintage.variables) {
    const entry = variables[spec.id];
    const label = (entry?.label ?? '').replace(/!!/g, ' ');
    if (!spec.labelPattern.test(label)) {
      throw new CensusVariableMismatchError(
        `${vintage.dataset}: expected ${spec.id} (${spec.field}) label to match ` +
          `${spec.labelPattern}, got "${label}"`,
      );
    }
    if (spec.conceptPattern) {
      const concept = entry?.concept ?? '';
      if (!spec.conceptPattern.test(concept)) {
        throw new CensusVariableMismatchError(
          `${vintage.dataset}: expected ${spec.id} (${spec.field}) concept to match ` +
            `${spec.conceptPattern}, got "${concept}"`,
        );
      }
    }
  }
}

/** Parses one response into profile rows. Geography columns decide the geoid shape:
 * county rows need `state`+`county`; tract rows additionally need `tract`. Rows with
 * unparseable FIPS are rejections, never silently dropped. */
export function parseAcsResponse(
  vintage: AcsVintage,
  payload: readonly (readonly (string | null)[])[],
  geography: 'county' | 'tract',
): { readonly rows: readonly AcsProfileRow[]; readonly rejected: readonly string[] } {
  if (payload.length < 2) return { rows: [], rejected: ['response has no data rows'] };
  const header = payload[0]!;
  const nameIdx = header.indexOf('NAME');
  const stateIdx = header.indexOf('state');
  const countyIdx = header.indexOf('county');
  const tractIdx = header.indexOf('tract');
  const variableIdx = vintage.variables.map((spec) => ({ spec, idx: header.indexOf(spec.id) }));

  const missing = [
    ...(nameIdx < 0 ? ['NAME'] : []),
    ...(stateIdx < 0 ? ['state'] : []),
    ...(countyIdx < 0 ? ['county'] : []),
    ...(geography === 'tract' && tractIdx < 0 ? ['tract'] : []),
    ...variableIdx.filter(({ idx }) => idx < 0).map(({ spec }) => spec.id),
  ];
  if (missing.length > 0) {
    throw new CensusVariableMismatchError(
      `${vintage.dataset}: response header is missing expected columns: ${missing.join(', ')}`,
    );
  }

  const rows: AcsProfileRow[] = [];
  const rejected: string[] = [];
  for (const row of payload.slice(1)) {
    const stateFips = row[stateIdx] ?? '';
    const countyFips = row[countyIdx] ?? '';
    const tractCode = geography === 'tract' ? (row[tractIdx] ?? '') : undefined;
    if (!/^\d{2}$/.test(stateFips) || !/^\d{3}$/.test(countyFips)) {
      rejected.push(`bad FIPS: ${JSON.stringify(row)}`);
      continue;
    }
    if (geography === 'tract' && !/^\d{6}$/.test(tractCode ?? '')) {
      rejected.push(`bad tract code: ${JSON.stringify(row)}`);
      continue;
    }

    const values: Record<string, number> = {};
    const suppressed: string[] = [];
    let malformed: string | undefined;
    for (const { spec, idx } of variableIdx) {
      const raw = row[idx];
      // The API publishes null (or an annotation string) for some suppressed cells and
      // negative sentinels for others — both land in `suppressed`, never in `values`.
      if (raw === null || raw === undefined || raw === '') {
        suppressed.push(spec.field);
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        malformed = `bad estimate for ${spec.id}: ${JSON.stringify(row)}`;
        break;
      }
      if (value < 0) {
        suppressed.push(spec.field);
        continue;
      }
      values[spec.field] = value;
    }
    if (malformed) {
      rejected.push(malformed);
      continue;
    }

    rows.push({
      geoid:
        geography === 'tract'
          ? `${stateFips}${countyFips}${tractCode}`
          : `${stateFips}${countyFips}`,
      stateFips,
      countyFips,
      ...(geography === 'tract' ? { tractCode: tractCode! } : {}),
      name: row[nameIdx] ?? '',
      values,
      suppressed,
    });
  }
  return { rows, rejected };
}
