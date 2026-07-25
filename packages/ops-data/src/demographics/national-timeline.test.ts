/**
 * Tests for the national-timeline snapshot builder — the merge of the historical lane
 * (censusNationalDecades) with the modern county-sum lane, plus deterministic assembly. Uses a
 * minimal fake Firestore for the historical read; the modern lane returns empty here (its
 * county-aggregate path is covered by national-stats.test.ts). Full two-lane merge over real
 * county data is the emulator lane (repo-lcl9.1 operator step).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import type { NationalPopulationTimelineRow } from '@repo/domain';
import { FIRESTORE_ROOT } from '../firestore/paths.js';
import { buildCensusNationalDecadeDoc } from './national-load-cli.js';
import type { CensusNationalDecadeDoc } from './schema.js';
import { buildNationalPopulationTimelineSnapshot, mergeTimelineRows } from './national-timeline.js';

function doc(input: {
  decade: string;
  totalPopulation: number;
  blackPopulation: number;
  freeBlackPopulation?: number;
  enslavedBlackPopulation?: number;
}): CensusNationalDecadeDoc {
  return buildCensusNationalDecadeDoc({
    row: input as never,
    source: 'us-census-historical-race-1790-1990',
    sourceUrl: 'https://www.census.gov/library/working-papers/2002/demo/POP-twps0056.html',
    license: 'U.S. government work — public domain (17 U.S.C. §105)',
    datasetChecksum: 'a'.repeat(64),
    nowIso: '2026-07-19T00:00:00.000Z',
  });
}

/** Fake Firestore: historical collection returns `historicalDocs`; county collection is empty. */
function fakeFirestore(historicalDocs: readonly CensusNationalDecadeDoc[]): Firestore {
  const emptyAggregate = {
    async get() {
      return { data: () => ({ countyCount: 0 }) };
    },
  };
  const emptySample = {
    async get() {
      return { empty: true, docs: [] };
    },
  };
  return {
    collection(name: string) {
      if (name === FIRESTORE_ROOT.censusNationalDecades) {
        return {
          async get() {
            return { docs: historicalDocs.map((d) => ({ data: () => d })) };
          },
        };
      }
      return {
        where() {
          return { aggregate: () => emptyAggregate, limit: () => emptySample };
        },
      };
    },
  } as unknown as Firestore;
}

test('builds an ascending historical timeline with shares, changes, and a deduped source', async () => {
  const firestore = fakeFirestore([
    doc({
      decade: '1860',
      totalPopulation: 31_443_321,
      blackPopulation: 4_441_830,
      freeBlackPopulation: 488_070,
      enslavedBlackPopulation: 3_953_760,
    }),
    doc({
      decade: '1790',
      totalPopulation: 3_929_214,
      blackPopulation: 757_208,
      freeBlackPopulation: 59_527,
      enslavedBlackPopulation: 697_681,
    }),
    doc({ decade: '1870', totalPopulation: 38_558_371, blackPopulation: 4_880_009 }),
  ]);

  const snapshot = await buildNationalPopulationTimelineSnapshot(
    firestore,
    () => '2026-07-19T00:00:00.000Z',
  );

  assert.deepEqual(
    snapshot.rows.map((r) => r.decade),
    ['1790', '1860', '1870'],
  );
  const y1790 = snapshot.rows[0]!;
  assert.equal(y1790.freeBlackPopulation, 59_527);
  assert.ok(Math.abs(y1790.blackShareOfTotalPct! - 19.27) < 0.05);
  // 1870 carries the undercount caveat, no split.
  const y1870 = snapshot.rows[2]!;
  assert.equal(y1870.southernUndercountCaveat, true);
  assert.equal(y1870.freeBlackPopulation, null);

  // Adjacent 1860→1870 change exists; 1790→1860 is a 70-year gap → no spurious delta.
  assert.deepEqual(
    snapshot.changes.map((c) => `${c.fromDecade}->${c.toDecade}`),
    ['1860->1870'],
  );
  assert.equal(snapshot.sources.length, 1);
  assert.equal(snapshot.sources[0]!.sourceId, 'us-census-historical-race-1790-1990');
  assert.match(snapshot.contentHash, /^[a-f0-9]{64}$/);
});

test('snapshot contentHash is deterministic across rebuilds over identical data', async () => {
  const docs = [
    doc({
      decade: '1790',
      totalPopulation: 3_929_214,
      blackPopulation: 757_208,
      freeBlackPopulation: 59_527,
      enslavedBlackPopulation: 697_681,
    }),
  ];
  const a = await buildNationalPopulationTimelineSnapshot(
    fakeFirestore(docs),
    () => '2026-07-19T00:00:00.000Z',
  );
  const b = await buildNationalPopulationTimelineSnapshot(
    fakeFirestore(docs),
    () => '2030-01-01T00:00:00.000Z',
  );
  assert.equal(a.contentHash, b.contentHash, 'generatedAt is excluded from the hash');
});

test('mergeTimelineRows orders by year and never lets the modern lane overwrite a historical decade', () => {
  const historical: NationalPopulationTimelineRow[] = [
    {
      decade: '1990',
      year: 1990,
      totalPopulation: 248_709_873,
      blackPopulation: 29_986_060,
      freeBlackPopulation: null,
      enslavedBlackPopulation: null,
      blackShareOfTotalPct: 12.1,
      raceCategoryLabel: 'Black',
      nationalSource: 'twps0056',
      sourceId: 'us-census-historical-race-1790-1990',
      sourceUrl: 'https://x',
      opensDefinitionBoundary: false,
      southernUndercountCaveat: false,
      hasFreeEnslavedSplit: false,
    },
  ];
  const modern: NationalPopulationTimelineRow[] = [
    {
      decade: '1990',
      year: 1990,
      totalPopulation: 999,
      blackPopulation: 999,
      freeBlackPopulation: null,
      enslavedBlackPopulation: null,
      blackShareOfTotalPct: 0,
      raceCategoryLabel: 'x',
      nationalSource: 'census-county-sum',
      sourceId: 'other',
      sourceUrl: 'https://y',
      opensDefinitionBoundary: false,
      southernUndercountCaveat: false,
      hasFreeEnslavedSplit: false,
    },
    {
      decade: '2000',
      year: 2000,
      totalPopulation: 281_421_906,
      blackPopulation: 34_658_190,
      freeBlackPopulation: null,
      enslavedBlackPopulation: null,
      blackShareOfTotalPct: 12.3,
      raceCategoryLabel: 'Black or African American alone',
      nationalSource: 'census-county-sum',
      sourceId: 'other',
      sourceUrl: 'https://y',
      opensDefinitionBoundary: true,
      southernUndercountCaveat: false,
      hasFreeEnslavedSplit: false,
    },
  ];
  const merged = mergeTimelineRows(historical, modern);
  assert.deepEqual(
    merged.map((r) => r.decade),
    ['1990', '2000'],
  );
  assert.equal(merged[0]!.blackPopulation, 29_986_060, 'historical 1990 wins the collision');
});
