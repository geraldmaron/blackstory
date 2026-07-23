/**
 * Census PEP fetch for non-Hispanic state race populations used as BJS rate denominators.
 */
import type { FetchLike } from '../census-demographics/fetch-county-populations.js';
import type { StateRacePopulation } from './phase1-bjs-nps-mapper.js';

type PepRow = readonly [name: string, pop: string, ...rest: string[]];

/** Vintage 2023 charv: White alone, not Hispanic or Latino. */
const BJS_WHITE_ALONE_NH_POPGROUP = '451';
/** Vintage 2023 charv: Black or African American alone, not Hispanic or Latino. */
const BJS_BLACK_ALONE_NH_POPGROUP = '453';

type PepFetchAttempt = {
  readonly month: number;
  readonly year: number;
};

function parsePepRows(payload: unknown): Map<string, number> {
  if (!Array.isArray(payload) || payload.length < 2) {
    throw new Error('Unexpected Census PEP response shape');
  }
  const [header, ...rows] = payload as [string[], ...PepRow[]];
  const stateIdx = header.indexOf('state');
  const popIdx = header.indexOf('POP');
  if (stateIdx < 0 || popIdx < 0) {
    throw new Error('Census PEP response missing state or POP columns');
  }

  const out = new Map<string, number>();
  for (const row of rows) {
    const stateCode = row[stateIdx]?.padStart(2, '0');
    const pop = Number(row[popIdx]);
    if (!stateCode || !Number.isFinite(pop) || pop <= 0) continue;
    out.set(stateCode, pop);
  }
  return out;
}

function buildCharvUrl(input: {
  readonly datasetVintage: number;
  readonly month: number;
  readonly estimateYear: number;
  readonly popGroup: string;
  readonly apiKey: string;
}): string {
  const params = new URLSearchParams({
    get: 'NAME,POP',
    POPGROUP: input.popGroup,
    MONTH: String(input.month),
    YEAR: String(input.estimateYear),
    UNIVERSE: 'R',
    for: 'state:*',
    key: input.apiKey,
  });
  return `https://api.census.gov/data/${input.datasetVintage}/pep/charv?${params.toString()}`;
}

/** BJS uses Census resident population for January 1 of the year after referencePeriod. */
export function censusPepEstimateYearForBjsReferenceYear(referenceYear: number): number {
  return referenceYear + 1;
}

/** PEP vintage aligned with the BJS NPS report reference year (e.g. Prisoners in 2023 → 2023). */
export function censusPepDatasetVintageForBjsReferenceYear(referenceYear: number): number {
  return referenceYear;
}

export function censusPepFetchAttemptsForBjsReferenceYear(referenceYear: number): readonly PepFetchAttempt[] {
  const januaryYear = censusPepEstimateYearForBjsReferenceYear(referenceYear);
  return [
    { month: 1, year: januaryYear },
    { month: 7, year: referenceYear },
  ];
}

async function readPepPayload(response: Response): Promise<unknown | undefined> {
  if (response.status === 204 || response.status === 400 || response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`Census PEP fetch failed (${response.status})`);
  }
  const text = await response.text();
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('Census PEP response was not valid JSON');
  }
}

async function fetchPopGroupByState(input: {
  readonly datasetVintage: number;
  readonly referenceYear: number;
  readonly popGroup: string;
  readonly apiKey: string;
  readonly fetchImpl: FetchLike;
  readonly raceLabel: string;
}): Promise<Map<string, number>> {
  const attempts = censusPepFetchAttemptsForBjsReferenceYear(input.referenceYear);
  for (const attempt of attempts) {
    const response = await input.fetchImpl(
      buildCharvUrl({
        datasetVintage: input.datasetVintage,
        month: attempt.month,
        estimateYear: attempt.year,
        popGroup: input.popGroup,
        apiKey: input.apiKey,
      }),
    );
    const payload = await readPepPayload(response as Response);
    if (payload === undefined) continue;
    const parsed = parsePepRows(payload);
    if (parsed.size > 0) return parsed;
  }
  throw new Error(
    `Census PEP ${input.raceLabel} population unavailable for BJS reference year ${input.referenceYear}`,
  );
}

/**
 * ACS B03002 (Hispanic or Latino Origin by Race):
 * - B03002_003E = White alone, not Hispanic or Latino
 * - B03002_004E = Black or African American alone, not Hispanic or Latino
 *
 * Do NOT use B03002_005E (AIAN NH) or B03002_014E (Hispanic Black) — a prior bug
 * used those codes and produced ~30k IL denominators → absurd 50k+/100k "rates".
 */
export const ACS_WHITE_ALONE_NH_VARIABLE = 'B03002_003E';
export const ACS_BLACK_ALONE_NH_VARIABLE = 'B03002_004E';

/** Reject denominators that cannot support plausible state imprisonment rates. */
export function assertPlausibleStateRacePopulations(
  populations: ReadonlyMap<string, StateRacePopulation>,
): void {
  for (const row of populations.values()) {
    if (row.whitePopulation < 10_000 || row.blackPopulation < 1_000) {
      throw new Error(
        `Implausible ACS/PEP race denominators for state ${row.stateFips}: ` +
          `white=${row.whitePopulation}, black=${row.blackPopulation}`,
      );
    }
  }
}

async function fetchAcsStateRacePopulationsFallback(input: {
  readonly referenceYear: number;
  readonly apiKey: string;
  readonly fetchImpl: FetchLike;
}): Promise<Map<string, StateRacePopulation>> {
  const params = new URLSearchParams({
    get: `NAME,${ACS_WHITE_ALONE_NH_VARIABLE},${ACS_BLACK_ALONE_NH_VARIABLE}`,
    for: 'state:*',
    key: input.apiKey,
  });
  // ACS 5-year for calendar year Y is published as dataset Y; BJS 2023 → prefer 2023 ACS5.
  const url = `https://api.census.gov/data/${input.referenceYear}/acs/acs5?${params.toString()}`;
  const response = await input.fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Census ACS fetch failed (${response.status})`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload) || payload.length < 2) {
    throw new Error('Unexpected Census ACS response shape');
  }
  const [header, ...rows] = payload as [string[], ...PepRow[]];
  const stateIdx = header.indexOf('state');
  const whiteIdx = header.indexOf(ACS_WHITE_ALONE_NH_VARIABLE);
  const blackIdx = header.indexOf(ACS_BLACK_ALONE_NH_VARIABLE);
  if (stateIdx < 0 || whiteIdx < 0 || blackIdx < 0) {
    throw new Error('Census ACS response missing state or B03002 race columns');
  }
  const merged = new Map<string, StateRacePopulation>();
  for (const row of rows) {
    const stateFips = row[stateIdx]?.padStart(2, '0');
    const whitePopulation = Number(row[whiteIdx]);
    const blackPopulation = Number(row[blackIdx]);
    if (!stateFips || !Number.isFinite(whitePopulation) || !Number.isFinite(blackPopulation)) {
      continue;
    }
    if (whitePopulation <= 0 || blackPopulation <= 0) continue;
    merged.set(stateFips, { stateFips, whitePopulation, blackPopulation });
  }
  if (merged.size === 0) {
    throw new Error(
      `Census ACS state race populations empty for reference year ${input.referenceYear}`,
    );
  }
  assertPlausibleStateRacePopulations(merged);
  return merged;
}

export async function fetchCensusStateRacePopulations(input: {
  readonly referenceYear: number;
  readonly apiKey: string;
  readonly fetchImpl?: FetchLike;
}): Promise<Map<string, StateRacePopulation>> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const datasetVintage = censusPepDatasetVintageForBjsReferenceYear(input.referenceYear);

  try {
    const [whiteByState, blackByState] = await Promise.all([
      fetchPopGroupByState({
        datasetVintage,
        referenceYear: input.referenceYear,
        popGroup: BJS_WHITE_ALONE_NH_POPGROUP,
        apiKey: input.apiKey,
        fetchImpl,
        raceLabel: 'white',
      }),
      fetchPopGroupByState({
        datasetVintage,
        referenceYear: input.referenceYear,
        popGroup: BJS_BLACK_ALONE_NH_POPGROUP,
        apiKey: input.apiKey,
        fetchImpl,
        raceLabel: 'black',
      }),
    ]);

    const merged = new Map<string, StateRacePopulation>();
    for (const [stateFips, whitePopulation] of whiteByState) {
      const blackPopulation = blackByState.get(stateFips);
      if (blackPopulation === undefined) continue;
      merged.set(stateFips, { stateFips, whitePopulation, blackPopulation });
    }
    assertPlausibleStateRacePopulations(merged);
    return merged;
  } catch {
    return fetchAcsStateRacePopulationsFallback({
      referenceYear: input.referenceYear,
      apiKey: input.apiKey,
      fetchImpl,
    });
  }
}
