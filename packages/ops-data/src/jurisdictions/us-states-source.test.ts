/**
 * Tests proving state jurisdiction docs are sourced solely from the existing
 * `@repo/domain` `US_STATES` table.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { US_STATES } from '@repo/domain';
import { jurisdictionSchema } from './schema.js';
import {
  buildCountryJurisdictionDoc,
  buildStateJurisdictionDocs,
  stateInfoByFips,
} from './us-states-source.js';

test('buildStateJurisdictionDocs produces exactly 51 states + D.C. plus one country row', () => {
  const docs = buildStateJurisdictionDocs({ now: () => '2026-01-01T00:00:00.000Z' });
  const countryDocs = docs.filter((d) => d.kind === 'country');
  const stateDocs = docs.filter((d) => d.kind === 'state');
  assert.equal(countryDocs.length, 1);
  assert.equal(stateDocs.length, 51);
  assert.equal(docs.length, 52);
});

test('every state doc is schema-valid and every field traces back to US_STATES', () => {
  const docs = buildStateJurisdictionDocs({ now: () => '2026-01-01T00:00:00.000Z' });
  const stateDocs = docs.filter((d) => d.kind === 'state');

  for (const doc of stateDocs) {
    assert.doesNotThrow(() => jurisdictionSchema.parse(doc));
    const source = US_STATES.find((s) => s.fips === doc.fipsCode);
    assert.ok(source, `no US_STATES row for fips ${doc.fipsCode}`);
    assert.equal(doc.name, source!.name);
    assert.equal(doc.postalCode, source!.postalCode);
    assert.deepEqual(doc.bbox, source!.bbox);
    assert.equal(doc.bboxSource, 'us-geography-module');
  }
});

test('every state doc parents to the single country row', () => {
  const docs = buildStateJurisdictionDocs({ now: () => '2026-01-01T00:00:00.000Z' });
  const country = buildCountryJurisdictionDoc({ now: () => '2026-01-01T00:00:00.000Z' });
  const stateDocs = docs.filter((d) => d.kind === 'state');
  for (const doc of stateDocs) {
    assert.equal(doc.parentId, country.id);
  }
});

test('state jurisdiction ids are deterministic (idempotent re-run produces identical ids)', () => {
  const first = buildStateJurisdictionDocs({ now: () => '2026-01-01T00:00:00.000Z' });
  const second = buildStateJurisdictionDocs({ now: () => '2027-06-06T00:00:00.000Z' });
  assert.deepEqual(first.map((d) => d.id).sort(), second.map((d) => d.id).sort());
});

test('stateInfoByFips resolves a known FIPS and returns undefined for an unknown one', () => {
  assert.equal(stateInfoByFips('06')?.postalCode, 'CA');
  assert.equal(stateInfoByFips('99'), undefined);
});

test('D.C. is included (51 states table) and no territory FIPS appears', () => {
  const docs = buildStateJurisdictionDocs({ now: () => '2026-01-01T00:00:00.000Z' });
  const dc = docs.find((d) => d.postalCode === 'DC');
  assert.ok(dc);
  // Puerto Rico (FIPS 72) is a territory, out of the 50-states-+-D.C. product scope.
  assert.equal(stateInfoByFips('72'), undefined);
});
