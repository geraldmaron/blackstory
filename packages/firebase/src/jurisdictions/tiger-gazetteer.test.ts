
/**
 * Tests for the Census Gazetteer county file parser and bbox approximation.
 *
 * The fixture (./fixtures/sample-gazetteer-counties.txt) is a small, structurally-correct
 * illustrative sample in the real Gazetteer tab-delimited format NOT claimed to be a byte-
 * exact excerpt of a downloaded live Census file (fixtures are hand-authored, not fetched).
 * It exists to prove the parser/transform logic is correct against the documented format;
 * see ./tiger-gazetteer.ts's module doc for how to obtain the real file.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { jurisdictionSchema } from './schema.js';
import {
  approximateCountyBBox,
  buildCountyJurisdictionDocs,
  parseGazetteerCountyFile,
} from './tiger-gazetteer.js';

const FIXTURE_PATH = fileURLToPath(new URL('./fixtures/sample-gazetteer-counties.txt', import.meta.url));

async function loadFixture(): Promise<string> {
  return readFile(FIXTURE_PATH, 'utf-8');
}

test('parseGazetteerCountyFile parses every well-formed row in the fixture', async () => {
  const text = await loadFixture();
  const { rows, rejected } = parseGazetteerCountyFile(text);
  assert.equal(rows.length, 5);
  assert.equal(rejected.length, 0);

  const autauga = rows.find((r) => r.geoid === '01001');
  assert.ok(autauga);
  assert.equal(autauga!.usps, 'AL');
  assert.equal(autauga!.stateFips, '01');
  assert.equal(autauga!.countyFips3, '001');
  assert.equal(autauga!.name, 'Autauga County');
  assert.ok(Number.isFinite(autauga!.alandSqMi));
  assert.ok(Number.isFinite(autauga!.intptlat));
});

test('parseGazetteerCountyFile throws on an unrecognized header (fails closed on format drift)', () => {
  assert.throws(
    () => parseGazetteerCountyFile('WRONG\tHEADER\nfoo\tbar\n'),
    /unrecognized Gazetteer header/,
  );
});

test('parseGazetteerCountyFile rejects malformed rows without throwing for the whole file', () => {
  const text =
    'USPS\tGEOID\tANSICODE\tNAME\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG\n' +
    'AL\tBADID\t123\tBroken County\t1\t1\t1\t1\t32\t-86\n' +
    'AL\t01003\t124\tBaldwin County\t1\t1\t100\t5\t30.7\t-87.7\n';
  const { rows, rejected } = parseGazetteerCountyFile(text);
  assert.equal(rows.length, 1);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0]!.reason, /invalid GEOID/);
});

test('approximateCountyBBox produces a bbox centered on the centroid that grows with area', () => {
  const smallRow = {
    usps: 'NY',
    geoid: '36061',
    stateFips: '36',
    countyFips3: '061',
    name: 'New York County',
    alandSqMi: 22.83,
    awaterSqMi: 4.4,
    intptlat: 40.777,
    intptlong: -73.969,
  };
  const largeRow = {
    usps: 'CA',
    geoid: '06037',
    stateFips: '06',
    countyFips3: '037',
    name: 'Los Angeles County',
    alandSqMi: 4060.85,
    awaterSqMi: 692.79,
    intptlat: 34.317,
    intptlong: -118.226,
  };

  const smallBBox = approximateCountyBBox(smallRow);
  const largeBBox = approximateCountyBBox(largeRow);

  const smallWidth = smallBBox[2] - smallBBox[0];
  const largeWidth = largeBBox[2] - largeBBox[0];
  assert.ok(largeWidth > smallWidth, 'a larger county should get a wider approximated bbox');

  // The centroid sits at the center of its own bbox.
  const centerLng = (smallBBox[0] + smallBBox[2]) / 2;
  const centerLat = (smallBBox[1] + smallBBox[3]) / 2;
  assert.ok(Math.abs(centerLng - smallRow.intptlong) < 1e-9);
  assert.ok(Math.abs(centerLat - smallRow.intptlat) < 1e-9);
});

test('buildCountyJurisdictionDocs excludes out-of-scope territory rows (50 states + D.C. only)', async () => {
  const text = await loadFixture();
  const { rows } = parseGazetteerCountyFile(text);
  const { docs, outOfScope } = buildCountyJurisdictionDocs(rows, { now: () => '2026-01-01T00:00:00.000Z' });

  // 5 fixture rows: 4 in-scope (AL/CA/IL/NY) + 1 out-of-scope (PR).
  assert.equal(docs.length, 4);
  assert.equal(outOfScope.length, 1);
  assert.equal(outOfScope[0]!.usps, 'PR');
  assert.ok(!docs.some((d) => d.stateFips === '72'));
});

test('every built county doc is schema-valid, parented to its state, and FIPS-keyed', async () => {
  const text = await loadFixture();
  const { rows } = parseGazetteerCountyFile(text);
  const { docs } = buildCountyJurisdictionDocs(rows, { now: () => '2026-01-01T00:00:00.000Z' });

  for (const doc of docs) {
    assert.doesNotThrow(() => jurisdictionSchema.parse(doc));
    assert.equal(doc.kind, 'county');
    assert.equal(doc.parentId, `us-${doc.stateFips}`);
    assert.equal(doc.bboxSource, 'census-gazetteer-area-approximated');
    assert.ok(doc.bbox);
    assert.ok(doc.centroid);
  }

  const losAngeles = docs.find((d) => d.fipsCode === '06037');
  assert.equal(losAngeles?.id, 'us-06-037');
  assert.equal(losAngeles?.parentId, 'us-06');
});

test('county doc ids are deterministic across repeated builds (idempotent)', async () => {
  const text = await loadFixture();
  const { rows } = parseGazetteerCountyFile(text);
  const first = buildCountyJurisdictionDocs(rows, { now: () => '2026-01-01T00:00:00.000Z' });
  const second = buildCountyJurisdictionDocs(rows, { now: () => '2027-01-01T00:00:00.000Z' });
  assert.deepEqual(
    first.docs.map((d) => d.id).sort(),
    second.docs.map((d) => d.id).sort(),
  );
});
