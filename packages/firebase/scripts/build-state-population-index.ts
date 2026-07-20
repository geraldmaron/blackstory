/**
 * Rebuild `apps/web/public/geo/state-population-decades.json` from committed sources —
 * no Firestore required.
 *
 * Sources:
 *  - twps0056 state CSV (1790–1990): packages/firebase/src/demographics/data/twps0056-state-1790-1990.csv
 *  - modern county index (2000–2020): apps/web/public/geo/county-population-decades.json
 *    rolled up by state FIPS (first two digits of fips5)
 *
 * Run from repo root:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/build-state-population-index.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { US_STATES } from '@repo/domain/map/geography';
import { parseTwps0056StateCsv } from '../src/demographics/state-load-cli.js';

const ROOT = resolve(process.cwd());
const CSV_PATH = resolve(
  ROOT,
  'packages/firebase/src/demographics/data/twps0056-state-1790-1990.csv',
);
const COUNTY_PATH = resolve(ROOT, 'apps/web/public/geo/county-population-decades.json');
const OUT_PATH = resolve(ROOT, 'apps/web/public/geo/state-population-decades.json');

const MODERN_DECADES = ['2000', '2010', '2020'] as const;
/** Product scope: 50 states + D.C. — exclude territory FIPS from county rollups. */
const IN_SCOPE_STATE_FIPS = new Set(US_STATES.map((state) => state.fips));

type CompactCounts = { total: number; black: number };
type CountyIndexFile = {
  readonly vintages?: readonly string[];
  readonly counties?: Readonly<
    Record<string, Readonly<Partial<Record<string, CompactCounts>>>>
  >;
};

function rollupCountiesToStates(countyPath: string): {
  readonly vintages: readonly string[];
  readonly states: Record<string, Partial<Record<string, CompactCounts>>>;
} {
  const payload = JSON.parse(readFileSync(countyPath, 'utf8')) as CountyIndexFile;
  const states: Record<string, Partial<Record<string, CompactCounts>>> = {};
  const vintages = (payload.vintages ?? MODERN_DECADES).filter((v) =>
    (MODERN_DECADES as readonly string[]).includes(v),
  );

  for (const [fips5, byDecade] of Object.entries(payload.counties ?? {})) {
    if (!/^\d{5}$/.test(fips5)) continue;
    const stateFips = fips5.slice(0, 2);
    if (!IN_SCOPE_STATE_FIPS.has(stateFips)) continue;
    for (const decade of vintages) {
      const row = byDecade?.[decade];
      if (!row || typeof row.total !== 'number' || typeof row.black !== 'number') continue;
      states[stateFips] ??= {};
      const existing = states[stateFips]![decade] ?? { total: 0, black: 0 };
      states[stateFips]![decade] = {
        total: existing.total + row.total,
        black: existing.black + row.black,
      };
    }
  }

  return { vintages, states };
}

const csvText = readFileSync(CSV_PATH, 'utf8');
const historicalRows = parseTwps0056StateCsv(csvText);
const modern = rollupCountiesToStates(COUNTY_PATH);

const states: Record<string, Partial<Record<string, CompactCounts>>> = {};
const vintageSet = new Set<string>();

for (const row of historicalRows) {
  vintageSet.add(row.decade);
  states[row.stateFips] ??= {};
  states[row.stateFips]![row.decade] = {
    total: row.totalPopulation,
    black: row.blackPopulation,
  };
}

for (const [stateFips, byDecade] of Object.entries(modern.states)) {
  states[stateFips] ??= {};
  for (const [decade, counts] of Object.entries(byDecade)) {
    if (!counts) continue;
    vintageSet.add(decade);
    states[stateFips]![decade] = counts;
  }
}

const vintages = [...vintageSet].sort((a, b) => Number(a) - Number(b));
const payload = { vintages, states };
writeFileSync(OUT_PATH, JSON.stringify(payload));

console.log(
  JSON.stringify(
    {
      out: OUT_PATH,
      states: Object.keys(states).length,
      vintages,
      historicalRows: historicalRows.length,
      modernStates: Object.keys(modern.states).length,
      bytes: Buffer.byteLength(JSON.stringify(payload)),
    },
    null,
    2,
  ),
);
