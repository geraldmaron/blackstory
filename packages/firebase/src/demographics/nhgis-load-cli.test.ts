/**
 * Tests for the idempotent NHGIS historical county loader. Self-contained inline 1860 CSV
 * (two NHGIS header rows + a couple of real counties) — no network, no Firestore.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildNhgisCountyDecadeArtifact,
  buildNhgisCountyHistoricalDoc,
  runNhgisCountyLoad,
  type CensusCountyHistoricalWriteOutcome,
  type CensusCountyHistoricalWriter,
} from './nhgis-load-cli.js';
import {
  censusCountyHistoricalDecadeSchema,
  type CensusCountyHistoricalDecadeDoc,
} from './schema.js';
import { parseNhgisCountyRaceCsv } from '@repo/domain';

const CSV_1860 = [
  'GISJOIN,YEAR,STATE,STATEA,COUNTY,COUNTYA,AREANAME,STATEICP,COUNTYICP,AH3001,AH3002,AH3003,AH3004,AH3005,AH3006',
  'code,year,st,sta,co,coa,area,sti,coi,White,Free colored,Slave,Indian,Half breed,Asiatic',
  '"G0100010","1860","Alabama","010","Autauga","0010","Autauga","41","10",7105,14,9607,13,,',
  '"G0100030","1860","Alabama","010","Baldwin","0030","Baldwin","41","30",3585,140,3714,91,,',
].join('\n');

function inMemoryWriter(): CensusCountyHistoricalWriter & {
  store: Map<string, CensusCountyHistoricalDecadeDoc>;
} {
  const store = new Map<string, CensusCountyHistoricalDecadeDoc>();
  return {
    store,
    async upsert(doc): Promise<CensusCountyHistoricalWriteOutcome> {
      const existing = store.get(doc.id);
      if (!existing) {
        store.set(doc.id, doc);
        return 'created';
      }
      if (existing.contentHash === doc.contentHash) return 'unchanged';
      store.set(doc.id, { ...doc, createdAt: existing.createdAt });
      return 'updated';
    },
  };
}

test('loads 1860 county docs with the free/slave split and full provenance', async () => {
  const writer = inMemoryWriter();
  const summary = await runNhgisCountyLoad({
    writer,
    decades: ['1860'],
    readCsvForDecade: () => CSV_1860,
    now: () => '2026-07-19T00:00:00.000Z',
  });
  assert.equal(summary.decades[0]!.counties, 2);
  assert.equal(summary.decades[0]!.created, 2);
  assert.equal(summary.totalWritten, 2);

  const autauga = writer.store.get('G0100010_1860')!;
  assert.doesNotThrow(() => censusCountyHistoricalDecadeSchema.parse(autauga));
  assert.equal(autauga.black, 9621);
  assert.equal(autauga.blackFree, 14);
  assert.equal(autauga.blackEnslaved, 9607);
  assert.equal(autauga.boundaryVersion, 'nhgis-1860');
  assert.match(autauga.sourceUrl, /nhgis\.org/);
  assert.ok(autauga.license.length > 0);
  assert.match(autauga.contentHash, /^[a-f0-9]{64}$/);
});

test('re-running over unchanged CSV is a full no-op', async () => {
  const writer = inMemoryWriter();
  const opts = { writer, decades: ['1860'], readCsvForDecade: () => CSV_1860 };
  await runNhgisCountyLoad({ ...opts, now: () => '2026-07-19T00:00:00.000Z' });
  const second = await runNhgisCountyLoad({ ...opts, now: () => '2030-01-01T00:00:00.000Z' });
  assert.equal(second.decades[0]!.created, 0);
  assert.equal(second.decades[0]!.updated, 0);
  assert.equal(second.decades[0]!.unchanged, 2);
});

test('a changed count updates exactly that county and preserves createdAt', async () => {
  const writer = inMemoryWriter();
  await runNhgisCountyLoad({
    writer,
    decades: ['1860'],
    readCsvForDecade: () => CSV_1860,
    now: () => '2026-07-19T00:00:00.000Z',
  });
  const createdAt = writer.store.get('G0100010_1860')!.createdAt;
  const bumped = CSV_1860.replace('7105,14,9607', '7105,15,9607');
  const summary = await runNhgisCountyLoad({
    writer,
    decades: ['1860'],
    readCsvForDecade: () => bumped,
    now: () => '2031-01-01T00:00:00.000Z',
  });
  const changed = summary.decades[0]!;
  assert.equal(changed.updated, 1);
  assert.equal(changed.unchanged, 1);
  assert.equal(writer.store.get('G0100010_1860')!.blackFree, 15);
  assert.equal(writer.store.get('G0100010_1860')!.createdAt, createdAt);
});

test('the static artifact is bounded, decade-keyed, and carries attribution + boundary note', () => {
  const rows = parseNhgisCountyRaceCsv(CSV_1860, '1860');
  const docs = rows.map((row) =>
    buildNhgisCountyHistoricalDoc({
      row,
      source: 'nhgis-county-race',
      sourceUrl: 'https://www.nhgis.org/',
      license: 'IPUMS NHGIS terms (attribution required)',
      datasetChecksum: 'a'.repeat(64),
      nowIso: '2026-07-19T00:00:00.000Z',
    }),
  );
  const artifact = buildNhgisCountyDecadeArtifact(docs);
  assert.deepEqual(artifact.decades, ['1860']);
  assert.equal(artifact.boundaryVersions['1860'], 'nhgis-1860');
  assert.equal(artifact.byDecade['1860']!.length, 2);
  assert.equal(artifact.byDecade['1860']![0]!.gisJoin, 'G0100010');
  assert.match(artifact.attribution, /NHGIS/);
  assert.match(artifact.note, /residual/);
});
