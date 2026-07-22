/**
 * Fixture-backed fetch for Phase 1 SCF national median wealth observations.
 * Loads curated published-table cells — no SCF microdata scrape.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCF_HOMEPAGE_URL, SCF_MEDIAN_WEALTH_FIXTURE_FILENAME } from './constants.js';
import {
  mapScfWealthRowsToObservations,
  parseScfMedianWealthFixtureCsv,
  type Phase1ScfWealthObservationDraft,
} from './phase1-scf-wealth-mapper.js';

export type Phase1ScfWealthFetchResult = {
  readonly observations: readonly Phase1ScfWealthObservationDraft[];
  readonly rejected: readonly string[];
  readonly surveyYears: readonly number[];
  readonly sourceUrl: string;
  readonly fixturePath: string;
};

type FetchOptions = {
  readonly fixtureCsvText?: string;
  readonly fixturePath?: string;
  readonly retrievedAt?: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_PATH = join(
  __dirname,
  '../../../../firebase/fixtures/reference-indicators',
  SCF_MEDIAN_WEALTH_FIXTURE_FILENAME,
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

export function fetchPhase1ScfWealthObservations(
  options: FetchOptions = {},
): Phase1ScfWealthFetchResult {
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const { text, path } = loadFixtureText(options);
  const parsed = parseScfMedianWealthFixtureCsv(text);
  const observations = mapScfWealthRowsToObservations(parsed.rows, retrievedAt);

  return {
    observations,
    rejected: parsed.rejected,
    surveyYears: parsed.rows.map((row) => row.referenceYear),
    sourceUrl: SCF_HOMEPAGE_URL,
    fixturePath: path,
  };
}

export { DEFAULT_FIXTURE_PATH };
