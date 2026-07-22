/**
 * Live- and fixture-backed fetch for Phase 1 CDC EJI county environmental-burden observations.
 * Rolls tract RPL_EBM to county means. Live path caches Illinois tracts under `.cache/phase1-eji-tri/`
 * and falls back to the Zenodo national CSV when the CDC state endpoint is unavailable.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FetchLike } from '../census-demographics/fetch-county-populations.js';
import {
  ensurePhase1EjiTriCacheDir,
  phase1EjiTriCachePath,
} from '../phase1-eji-tri-shared/cache-paths.js';
import { isIllinoisCountyFips } from '../phase1-eji-tri-shared/il-counties.js';
import {
  CDC_EJI_DATA_DOWNLOAD_URL,
  CDC_EJI_FIXTURE_FILENAME,
  CDC_EJI_IL_TRACT_CACHE_FILENAME,
  CDC_EJI_NATIONAL_CACHE_FILENAME,
  CDC_EJI_STATE_CSV_URL_TEMPLATE,
  CDC_EJI_ZENODO_NATIONAL_CSV_URL,
  PHASE1_EJI_DEFAULT_COUNTY_FIPS,
  PHASE1_EJI_DEFAULT_REFERENCE_YEAR,
} from './constants.js';
import {
  mapEjiCountyRollupsToObservations,
  parseEjiTractCsv,
  rollupEjiTractsToCounties,
  type Phase1EjiObservationDraft,
} from './phase1-eji-mapper.js';

export type Phase1EjiFetchMode = 'fixture' | 'live-cdc' | 'live-zenodo' | 'cache';

export type Phase1EjiFetchResult = {
  readonly observations: readonly Phase1EjiObservationDraft[];
  readonly rejected: readonly string[];
  readonly referencePeriod: string;
  readonly countyFips: readonly string[];
  readonly sourceUrl: string;
  readonly fixturePath?: string;
  readonly cachePath?: string;
  readonly mode: Phase1EjiFetchMode;
  readonly countyCoverageCount: number;
};

type FetchOptions = {
  readonly fetchImpl?: FetchLike;
  readonly countyFips?: readonly string[];
  readonly referencePeriod?: number;
  readonly fixtureCsvText?: string;
  readonly fixturePath?: string;
  readonly retrievedAt?: string;
  readonly live?: boolean;
  readonly allIllinoisCounties?: boolean;
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

function filterIlTractCsvText(nationalCsvText: string): string {
  const parsed = parseEjiTractCsv(nationalCsvText);
  const ilRows = parsed.rows.filter((row) => isIllinoisCountyFips(row.countyFips));
  const lines = ['GEOID,RPL_EBM', ...ilRows.map((row) => `${row.geoid},${row.environmentalBurdenRank}`)];
  return `${lines.join('\n')}\n`;
}

async function fetchText(url: string, fetchImpl: FetchLike): Promise<string> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`CDC EJI fetch failed (${response.status}) from ${url}`);
  }
  return response.text();
}

async function resolveLiveIllinoisTractCsv(
  referenceYear: number,
  fetchImpl: FetchLike,
): Promise<{ readonly text: string; readonly mode: Phase1EjiFetchMode; readonly cachePath?: string }> {
  ensurePhase1EjiTriCacheDir();
  const ilCachePath = phase1EjiTriCachePath(CDC_EJI_IL_TRACT_CACHE_FILENAME);
  if (existsSync(ilCachePath)) {
    return { text: readFileSync(ilCachePath, 'utf8'), mode: 'cache', cachePath: ilCachePath };
  }

  const cdcUrl = CDC_EJI_STATE_CSV_URL_TEMPLATE.replace('{year}', String(referenceYear));
  try {
    const cdcText = await fetchText(cdcUrl, fetchImpl);
    writeFileSync(ilCachePath, cdcText, 'utf8');
    return { text: cdcText, mode: 'live-cdc', cachePath: ilCachePath };
  } catch {
    // CDC state CSV is often unavailable; fall back to Zenodo national mirror.
  }

  const nationalCachePath = phase1EjiTriCachePath(CDC_EJI_NATIONAL_CACHE_FILENAME);
  const nationalText = existsSync(nationalCachePath)
    ? readFileSync(nationalCachePath, 'utf8')
    : await fetchText(CDC_EJI_ZENODO_NATIONAL_CSV_URL, fetchImpl).then((text) => {
        writeFileSync(nationalCachePath, text, 'utf8');
        return text;
      });

  const ilText = filterIlTractCsvText(nationalText);
  writeFileSync(ilCachePath, ilText, 'utf8');
  return { text: ilText, mode: 'live-zenodo', cachePath: ilCachePath };
}

function resolveCountyFilter(
  options: FetchOptions,
): readonly string[] | undefined {
  if (options.allIllinoisCounties === true) {
    return undefined;
  }
  return options.countyFips ?? [...PHASE1_EJI_DEFAULT_COUNTY_FIPS];
}

export async function fetchPhase1EjiCountyObservations(
  options: FetchOptions = {},
): Promise<Phase1EjiFetchResult> {
  const countyFilter = resolveCountyFilter(options);
  if (countyFilter) {
    assertCountyFipsList(countyFilter);
  }
  const referencePeriod = String(options.referencePeriod ?? PHASE1_EJI_DEFAULT_REFERENCE_YEAR);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const live = options.live === true;

  let csvText: string;
  let fixturePath: string | undefined;
  let cachePath: string | undefined;
  let mode: Phase1EjiFetchMode = 'fixture';

  if (live) {
    const liveResult = await resolveLiveIllinoisTractCsv(Number(referencePeriod), fetchImpl);
    csvText = liveResult.text;
    cachePath = liveResult.cachePath;
    mode = liveResult.mode;
  } else {
    const loaded = loadFixtureText(options);
    csvText = loaded.text;
    fixturePath = loaded.path;
  }

  const parsed = parseEjiTractCsv(csvText, countyFilter);
  const ilRows = parsed.rows.filter((row) => isIllinoisCountyFips(row.countyFips));
  const rollups = rollupEjiTractsToCounties(ilRows);
  const observations = mapEjiCountyRollupsToObservations(rollups, referencePeriod, retrievedAt);
  const countyFips = rollups.map((row) => row.countyFips);

  return {
    observations,
    rejected: parsed.rejected,
    referencePeriod,
    countyFips,
    sourceUrl: CDC_EJI_DATA_DOWNLOAD_URL,
    countyCoverageCount: rollups.length,
    ...(fixturePath !== undefined ? { fixturePath } : {}),
    ...(cachePath !== undefined ? { cachePath } : {}),
    mode,
  };
}

export { DEFAULT_FIXTURE_PATH };
