/**
 * Fixture-backed fetch for Phase 1 CDC EJI county environmental-burden observations.
 * Loads curated tract CSV and rolls RPL_EBM to county means — no full national scrape by default.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FetchLike } from '../census-demographics/fetch-county-populations.js';
import {
  CDC_EJI_DATA_DOWNLOAD_URL,
  CDC_EJI_FIXTURE_FILENAME,
  CDC_EJI_STATE_CSV_URL_TEMPLATE,
  PHASE1_EJI_DEFAULT_COUNTY_FIPS,
  PHASE1_EJI_DEFAULT_REFERENCE_YEAR,
} from './constants.js';
import {
  mapEjiCountyRollupsToObservations,
  parseEjiTractCsv,
  rollupEjiTractsToCounties,
  type Phase1EjiObservationDraft,
} from './phase1-eji-mapper.js';

export type Phase1EjiFetchResult = {
  readonly observations: readonly Phase1EjiObservationDraft[];
  readonly rejected: readonly string[];
  readonly referencePeriod: string;
  readonly countyFips: readonly string[];
  readonly sourceUrl: string;
  readonly fixturePath?: string;
  readonly mode: 'fixture' | 'live';
};

type FetchOptions = {
  readonly fetchImpl?: FetchLike;
  readonly countyFips?: readonly string[];
  readonly referencePeriod?: number;
  readonly fixtureCsvText?: string;
  readonly fixturePath?: string;
  readonly retrievedAt?: string;
  readonly live?: boolean;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_PATH = join(
  __dirname,
  '../../../../firebase/fixtures/reference-indicators',
  CDC_EJI_FIXTURE_FILENAME,
);

function loadFixtureText(options: FetchOptions): { readonly text: string; readonly path: string } {
  if (options.fixtureCsvText !== undefined) {
    return {
      text: options.fixtureCsvText,
      path: options.fixturePath ?? '(inline fixtureCsvText)',
    };
  }
  const fixturePath = options.fixturePath ?? DEFAULT_FIXTURE_PATH;
  return {
    text: readFileSync(fixturePath, 'utf8'),
    path: fixturePath,
  };
}

function assertCountyFipsList(countyFips: readonly string[]): void {
  for (const fips of countyFips) {
    if (!/^\d{5}$/.test(fips)) {
      throw new Error(`countyFips entry must be 5-digit FIPS, got "${fips}"`);
    }
  }
}

async function fetchLiveIllinoisCsv(
  referenceYear: number,
  fetchImpl: FetchLike,
): Promise<string> {
  const url = CDC_EJI_STATE_CSV_URL_TEMPLATE.replace('{year}', String(referenceYear));
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`CDC EJI live fetch failed (${response.status}) from ${url}`);
  }
  return response.text();
}

export async function fetchPhase1EjiCountyObservations(
  options: FetchOptions = {},
): Promise<Phase1EjiFetchResult> {
  const countyFips = options.countyFips ?? [...PHASE1_EJI_DEFAULT_COUNTY_FIPS];
  const referencePeriod = String(options.referencePeriod ?? PHASE1_EJI_DEFAULT_REFERENCE_YEAR);
  assertCountyFipsList(countyFips);

  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const live = options.live === true;

  let csvText: string;
  let fixturePath: string | undefined;
  let mode: 'fixture' | 'live' = 'fixture';

  if (live) {
    csvText = await fetchLiveIllinoisCsv(Number(referencePeriod), fetchImpl);
    mode = 'live';
  } else {
    const loaded = loadFixtureText(options);
    csvText = loaded.text;
    fixturePath = loaded.path;
  }

  const parsed = parseEjiTractCsv(csvText, countyFips);
  const rollups = rollupEjiTractsToCounties(parsed.rows);
  const observations = mapEjiCountyRollupsToObservations(rollups, referencePeriod, retrievedAt);

  return {
    observations,
    rejected: parsed.rejected,
    referencePeriod,
    countyFips,
    sourceUrl: CDC_EJI_DATA_DOWNLOAD_URL,
    ...(fixturePath !== undefined ? { fixturePath } : {}),
    mode,
  };
}

export { DEFAULT_FIXTURE_PATH };
