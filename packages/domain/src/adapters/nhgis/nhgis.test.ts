import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  assertNhgisApiKeyConfigured,
  buildNhgisExtractDefinition,
  NHGIS_DECADE_RACE_TABLES,
  getNhgisExtractStatus,
  isNhgisAggregateArea,
  nhgisCountyRaceFromCsv,
  parseNhgisCountyRaceCsv,
  submitNhgisExtract,
  type NhgisFetchLike,
} from './index.js';

const SAMPLE = readFileSync(
  new URL('./__fixtures__/nhgis-1860-county-race-sample.csv', import.meta.url),
  'utf8',
);

test('parses real 1860 county race/slave rows, skipping the description header row', () => {
  const rows = parseNhgisCountyRaceCsv(SAMPLE, '1860');
  assert.equal(rows.length, 5, 'two header lines skipped; five data rows');

  const autauga = rows[0]!;
  assert.equal(autauga.gisJoin, 'G0100010');
  assert.equal(autauga.stateName, 'Alabama');
  assert.equal(autauga.countyName, 'Autauga');
  assert.equal(autauga.boundaryVersion, 'nhgis-1860');
  assert.equal(autauga.white, 7105);
  assert.equal(autauga.blackFree, 14);
  assert.equal(autauga.blackEnslaved, 9607);
  assert.equal(autauga.black, 9621, 'Black = free colored + slave');

  const baldwin = rows[1]!;
  assert.equal(baldwin.black, 140 + 3714);
});

test('sums multiple variables per category (1830 is split by sex)', () => {
  // 1830 NT12 maps White=ABO001+ABO002, Slave=ABO003+ABO004, Free=ABO005+ABO006.
  const csv = [
    'GISJOIN,YEAR,STATE,STATEA,COUNTY,COUNTYA,AREANAME,STATEICP,COUNTYICP,ABO001,ABO002,ABO003,ABO004,ABO005,ABO006',
    'code,year,st,sta,co,coa,area,sti,coi,White M,White F,Slave M,Slave F,Free M,Free F',
    '"G01","1830","X","001","Y","0010","Y","1","1",100,110,5,6,7,8',
  ].join('\n');
  const [row] = parseNhgisCountyRaceCsv(csv, '1830');
  assert.equal(row!.white, 210, 'white = male + female');
  assert.equal(row!.blackEnslaved, 11, 'slave = male + female');
  assert.equal(row!.blackFree, 15, 'free = male + female');
  assert.equal(row!.black, 26, 'black = free + enslaved');
});

test('excludes special/aggregate reporting areas (COUNTYA >= 9900) so they never double-count', () => {
  assert.equal(isNhgisAggregateArea('9997'), true);
  assert.equal(isNhgisAggregateArea('0010'), false);
  const csv = [
    'GISJOIN,YEAR,STATE,STATEA,COUNTY,COUNTYA,AREANAME,STATEICP,COUNTYICP,AH3001,AH3002,AH3003,AH3004,AH3005,AH3006',
    'code,year,st,sta,co,coa,area,sti,coi,White,Free colored,Slave,Indian,Half breed,Asiatic',
    '"G01","1860","X","001","Real County","0010","x","1","1",100,10,20,0,,',
    '"G99","1860","X","001","X [multi-county reporting area]","9997","x","1","1",9999,9999,9999,0,,',
  ].join('\n');
  const rows = parseNhgisCountyRaceCsv(csv, '1860');
  assert.equal(rows.length, 1, 'the 9997 aggregate row is dropped');
  assert.equal(rows[0]!.black, 30);
});

test('nhgisCountyRaceFromCsv wraps the parse in a result envelope', () => {
  const result = nhgisCountyRaceFromCsv(SAMPLE, '1860');
  assert.equal(result.request.decade, '1860');
  assert.equal(result.rows.length, 5);
  assert.deepEqual(result.rejected, []);
});

test('registry covers every decade 1790–1960 with the right split regime', () => {
  const decades = NHGIS_DECADE_RACE_TABLES.map((t) => t.decade);
  const expected = Array.from({ length: 18 }, (_u, i) => String(1790 + i * 10));
  assert.deepEqual([...decades].sort(), expected.sort(), 'no gaps 1790–1960');
  for (const t of NHGIS_DECADE_RACE_TABLES) {
    const isFreeSlaveEra = Number(t.decade) <= 1860;
    assert.equal(t.hasFreeEnslavedSplit, isFreeSlaveEra, `${t.decade} split regime`);
    // Every table must map at least one Black-bearing variable.
    const cats = new Set(Object.values(t.variables));
    assert.ok(
      cats.has('black') || (cats.has('blackFree') && cats.has('blackEnslaved')),
      `${t.decade} maps Black`,
    );
  }
});

test('fails closed on an unregistered decade', () => {
  assert.throws(() => parseNhgisCountyRaceCsv(SAMPLE, '1855'), /no registered race table/);
});

test('fails closed when a required variable column is missing', () => {
  const broken = SAMPLE.replace('AH3003', 'ZZZ999'); // drop the Slave column code
  assert.throws(() => parseNhgisCountyRaceCsv(broken, '1860'), /missing required columns/);
});

test('fails closed when a row YEAR does not match the requested decade', () => {
  const wrongYear = SAMPLE.replace(
    '"1860","Alabama","010","Autauga"',
    '"1870","Alabama","010","Autauga"',
  );
  assert.throws(
    () => parseNhgisCountyRaceCsv(wrongYear, '1860'),
    /does not match requested decade/,
  );
});

test('buildNhgisExtractDefinition targets the 1860 dataset/table at county geography', () => {
  const def = buildNhgisExtractDefinition('1860') as {
    datasets: Record<string, { dataTables: string[]; geogLevels: string[] }>;
    dataFormat: string;
  };
  assert.deepEqual(def.datasets['1860_cPAX'], { dataTables: ['NT6'], geogLevels: ['county'] });
  assert.equal(def.dataFormat, 'csv_header');
});

test('extract client requires an API key and threads the injected fetch', async () => {
  assert.throws(() => assertNhgisApiKeyConfigured(undefined), /NHGIS_API_KEY required/);

  const calls: string[] = [];
  const fakeFetch: NhgisFetchLike = async (url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (init?.method === 'POST') {
      return { ok: true, status: 200, json: async () => ({ number: 42, status: 'queued' }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: 'completed',
        downloadLinks: { tableData: { url: 'https://dl/x.zip' } },
      }),
    };
  };

  const handle = await submitNhgisExtract(buildNhgisExtractDefinition('1860'), {
    apiKey: 'k',
    fetchImpl: fakeFetch,
  });
  assert.equal(handle.number, 42);

  const status = await getNhgisExtractStatus(42, { apiKey: 'k', fetchImpl: fakeFetch });
  assert.equal(status.status, 'completed');
  assert.equal(status.tableDataUrl, 'https://dl/x.zip');
  assert.ok(calls.some((c) => c.startsWith('POST')) && calls.some((c) => c.startsWith('GET')));
});
