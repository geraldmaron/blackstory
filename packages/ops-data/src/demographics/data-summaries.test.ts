/**
 * Tests for materialized `/data` summary snapshots — build aggregation, point-get readers,
 * and contentHash idempotency. Uses minimal fake Firestore; no live Admin SDK.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE_ROOT, firestorePaths } from '../firestore/paths.js';
import { censusCountyDecadeSchema } from './schema.js';
import {
  __resetDataSummarySnapshotCaches,
  buildHistoricalStatePopulationCoverageSnapshot,
  buildOpportunityAtlasCoverageSnapshot,
  buildStatePopulationByDecadeSnapshot,
  getHistoricalStatePopulationCoverageSnapshot,
  getOpportunityAtlasCoverageSnapshot,
  getStatePopulationByDecadeSnapshot,
  writeStatePopulationByDecadeSnapshot,
} from './data-summaries.js';

function countyDoc(input: {
  readonly stateFips: string;
  readonly decade: '2020';
  readonly totalPopulation: number;
  readonly blackPopulation: number;
}) {
  return censusCountyDecadeSchema.parse({
    id: `${input.stateFips.padStart(5, '0')}_${input.decade}`,
    fips5: input.stateFips.padStart(5, '0'),
    stateFips: input.stateFips,
    countyFips: '001',
    countyName: 'Sample County',
    decade: input.decade,
    totalPopulation: input.totalPopulation,
    blackPopulation: input.blackPopulation,
    source: 'us-census-decennial-2020-pl',
    sourceUrl: 'https://www.census.gov/data/datasets/2020/dec/pl-94171.html',
    datasetChecksum: 'a'.repeat(64),
    license: 'U.S. government work',
    retrievedAt: '2026-07-20T00:00:00.000Z',
    contentHash: 'b'.repeat(64),
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
  });
}

function fakeFirestoreForStatePopulation(): Firestore {
  const counties = [
    countyDoc({ stateFips: '06', decade: '2020', totalPopulation: 100, blackPopulation: 10 }),
    countyDoc({ stateFips: '06', decade: '2020', totalPopulation: 200, blackPopulation: 20 }),
    countyDoc({ stateFips: '48', decade: '2020', totalPopulation: 300, blackPopulation: 30 }),
  ];
  const storedDocs = new Map<string, unknown>();
  return {
    collection(name: string) {
      if (name !== FIRESTORE_ROOT.censusCountyDecades) {
        throw new Error(`unexpected collection ${name}`);
      }
      return {
        where(field: string, _op: string, decade: string) {
          assert.equal(field, 'decade');
          return {
            async get() {
              const docs = counties.filter((row) => row.decade === decade);
              return {
                empty: docs.length === 0,
                docs: docs.map((data) => ({ data: () => data })),
              };
            },
          };
        },
      };
    },
    doc(path: string) {
      return {
        async get() {
          const data = storedDocs.get(path);
          return {
            exists: data !== undefined,
            data: () => data,
          };
        },
        async set(data: unknown) {
          storedDocs.set(path, data);
        },
      };
    },
  } as unknown as Firestore;
}

test('buildStatePopulationByDecadeSnapshot rolls counties up by state', async () => {
  const snapshot = await buildStatePopulationByDecadeSnapshot(
    fakeFirestoreForStatePopulation(),
    () => '2026-07-20T00:00:00.000Z',
  );
  assert.equal(snapshot.rows.length, 2);
  assert.equal(snapshot.rows[0]!.stateFips, '06');
  assert.equal(snapshot.rows[0]!.totalPopulation, 300);
  assert.match(snapshot.contentHash, /^[a-f0-9]{64}$/);
});

test('getStatePopulationByDecadeSnapshot point-gets the materialized doc', async () => {
  __resetDataSummarySnapshotCaches();
  const firestore = fakeFirestoreForStatePopulation();
  const built = await buildStatePopulationByDecadeSnapshot(firestore);
  await writeStatePopulationByDecadeSnapshot(built, firestore);

  const loaded = await getStatePopulationByDecadeSnapshot(firestore);
  assert.deepEqual(loaded?.rows, built.rows);
});

test('state snapshot contentHash is deterministic across rebuilds', async () => {
  const firestore = fakeFirestoreForStatePopulation();
  const a = await buildStatePopulationByDecadeSnapshot(
    firestore,
    () => '2026-07-20T00:00:00.000Z',
  );
  const b = await buildStatePopulationByDecadeSnapshot(
    firestore,
    () => '2030-01-01T00:00:00.000Z',
  );
  assert.equal(a.contentHash, b.contentHash);
});

test('buildOpportunityAtlasCoverageSnapshot aggregates tract outcomes', async () => {
  const tracts = [
    {
      outcomes: { kfrBlackP25: 0.15, kfrWhiteP25: 0.4 },
      source: 'opportunity-insights-tract-outcomes',
      sourceUrl: 'https://opportunityinsights.org/data/',
      license: 'attribution required',
    },
    { outcomes: { kfrBlackP25: 0.55 }, source: 'x', sourceUrl: 'https://x', license: 'y' },
  ];
  const firestore = {
    collection(name: string) {
      assert.equal(name, FIRESTORE_ROOT.opportunityAtlasTracts);
      return {
        limit() {
          return {
            async get() {
              return { empty: false, docs: [{ data: () => tracts[0] }] };
            },
          };
        },
        select() {
          return {
            async get() {
              return { docs: tracts.map((row) => ({ data: () => row })) };
            },
          };
        },
      };
    },
  } as unknown as Firestore;

  const snapshot = await buildOpportunityAtlasCoverageSnapshot(
    firestore,
    () => '2026-07-20T00:00:00.000Z',
  );
  assert.ok(snapshot);
  assert.equal(snapshot!.tractCount, 2);
  assert.equal(
    snapshot!.kfrBlackP25Histogram.find((bin) => bin.id === '0-20')?.tractCount,
    1,
  );
});

test('buildHistoricalStatePopulationCoverageSnapshot derives decade bounds', async () => {
  const rows = [
    { stateFips: '06', decade: '1790', source: 'twps', sourceUrl: 'https://census.gov' },
    { stateFips: '48', decade: '1990', source: 'twps', sourceUrl: 'https://census.gov' },
  ];
  const firestore = {
    collection(name: string) {
      assert.equal(name, FIRESTORE_ROOT.censusStateDecades);
      return {
        aggregate() {
          return {
            async get() {
              return { data: () => ({ n: rows.length }) };
            },
          };
        },
        limit() {
          return {
            async get() {
              return { empty: false, docs: [{ data: () => rows[0] }] };
            },
          };
        },
        select() {
          return {
            async get() {
              return { docs: rows.map((row) => ({ data: () => row })) };
            },
          };
        },
      };
    },
  } as unknown as Firestore;

  const snapshot = await buildHistoricalStatePopulationCoverageSnapshot(
    firestore,
    () => '2026-07-20T00:00:00.000Z',
  );
  assert.ok(snapshot);
  assert.equal(snapshot!.rowCount, 2);
  assert.equal(snapshot!.stateCount, 2);
  assert.equal(snapshot!.decadeMin, '1790');
  assert.equal(snapshot!.decadeMax, '1990');
});

test('getOpportunityAtlasCoverageSnapshot returns null when doc is missing', async () => {
  __resetDataSummarySnapshotCaches();
  const firestore = {
    doc() {
      return {
        async get() {
          return { exists: false, data: () => undefined };
        },
      };
    },
  } as unknown as Firestore;
  assert.equal(await getOpportunityAtlasCoverageSnapshot(firestore), null);
});

test('getHistoricalStatePopulationCoverageSnapshot caches for repeat reads', async () => {
  __resetDataSummarySnapshotCaches();
  let reads = 0;
  const payload = {
    rowCount: 1,
    stateCount: 1,
    decadeMin: '1790',
    decadeMax: '1790',
    source: 'twps',
    sourceUrl: 'https://census.gov',
    generatedAt: '2026-07-20T00:00:00.000Z',
    contentHash: 'c'.repeat(64),
  };
  const firestore = {
    doc(path: string) {
      return {
        async get() {
          reads += 1;
          assert.equal(path, firestorePaths.publicHistoricalStatePopulationCoverage());
          return { exists: true, data: () => payload };
        },
      };
    },
  } as unknown as Firestore;

  await getHistoricalStatePopulationCoverageSnapshot(firestore);
  await getHistoricalStatePopulationCoverageSnapshot(firestore);
  assert.equal(reads, 1);
});
