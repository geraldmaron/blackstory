/**
 * Fixture-backed fetch for Phase 1 USSC Quick Facts national drug sentencing observations.
 * Loads curated published-table cells — no USSC microdata scrape.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { USSC_QUICK_FACTS_DRUG_FIXTURE_FILENAME, USSC_QUICK_FACTS_HOMEPAGE_URL } from './constants.js';
import {
  mapUsscQuickFactsRowsToObservations,
  parseUsscQuickFactsDrugFixtureCsv,
  type Phase1UsscQuickFactsObservationDraft,
} from './phase1-ussc-quick-facts-mapper.js';

export type Phase1UsscQuickFactsFetchResult = {
  readonly observations: readonly Phase1UsscQuickFactsObservationDraft[];
  readonly rejected: readonly string[];
  readonly fiscalYears: readonly number[];
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
  USSC_QUICK_FACTS_DRUG_FIXTURE_FILENAME,
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

export function fetchPhase1UsscQuickFactsObservations(
  options: FetchOptions = {},
): Phase1UsscQuickFactsFetchResult {
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const { text, path } = loadFixtureText(options);
  const parsed = parseUsscQuickFactsDrugFixtureCsv(text);
  const observations = mapUsscQuickFactsRowsToObservations(parsed.rows, retrievedAt);

  return {
    observations,
    rejected: parsed.rejected,
    fiscalYears: parsed.rows.map((row) => row.fiscalYear),
    sourceUrl: USSC_QUICK_FACTS_HOMEPAGE_URL,
    fixturePath: path,
  };
}

export { DEFAULT_FIXTURE_PATH };
