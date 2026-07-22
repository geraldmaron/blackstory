/**
 * Census PEP fetch for non-Hispanic state race populations used as BJS rate denominators.
 */
import type { FetchLike } from '../census-demographics/fetch-county-populations.js';
import type { StateRacePopulation } from './phase1-bjs-nps-mapper.js';

type PepRow = readonly [name: string, pop: string, ...rest: string[]];

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
  readonly estimateYear: number;
  readonly popGroup: 'WA' | 'BA';
  readonly apiKey: string;
}): string {
  const params = new URLSearchParams({
    get: 'NAME,POP',
    HISP: '2',
    POPGROUP: input.popGroup,
    YEAR: String(input.estimateYear),
    for: 'state:*',
    key: input.apiKey,
  });
  return `https://api.census.gov/data/${input.datasetVintage}/pep/charv?${params.toString()}`;
}

/** BJS uses Census resident population for January 1 of the year after referencePeriod. */
export function censusPepEstimateYearForBjsReferenceYear(referenceYear: number): number {
  return referenceYear;
}

export function censusPepDatasetVintageForBjsReferenceYear(referenceYear: number): number {
  return referenceYear;
}

export async function fetchCensusStateRacePopulations(input: {
  readonly referenceYear: number;
  readonly apiKey: string;
  readonly fetchImpl?: FetchLike;
}): Promise<Map<string, StateRacePopulation>> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const estimateYear = censusPepEstimateYearForBjsReferenceYear(input.referenceYear);
  const datasetVintage = censusPepDatasetVintageForBjsReferenceYear(input.referenceYear);

  const [whiteResponse, blackResponse] = await Promise.all([
    fetchImpl(
      buildCharvUrl({
        datasetVintage,
        estimateYear,
        popGroup: 'WA',
        apiKey: input.apiKey,
      }),
    ),
    fetchImpl(
      buildCharvUrl({
        datasetVintage,
        estimateYear,
        popGroup: 'BA',
        apiKey: input.apiKey,
      }),
    ),
  ]);

  if (!whiteResponse.ok) {
    throw new Error(`Census PEP white population fetch failed (${whiteResponse.status})`);
  }
  if (!blackResponse.ok) {
    throw new Error(`Census PEP black population fetch failed (${blackResponse.status})`);
  }

  const whiteByState = parsePepRows(await whiteResponse.json());
  const blackByState = parsePepRows(await blackResponse.json());
  const merged = new Map<string, StateRacePopulation>();

  for (const [stateFips, whitePopulation] of whiteByState) {
    const blackPopulation = blackByState.get(stateFips);
    if (blackPopulation === undefined) continue;
    merged.set(stateFips, { stateFips, whitePopulation, blackPopulation });
  }

  return merged;
}
