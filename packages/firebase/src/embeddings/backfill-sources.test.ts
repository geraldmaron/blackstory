/**
 * Unit tests for publicSearchIndex / national-catalog embedding backfill source mappers.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  createNationalCatalogFixtureEntitySource,
  mapCatalogFixtureRecordToEmbeddingInput,
  mapSearchIndexRecordToEmbeddingInput,
  parseStateCodeFromJurisdiction,
} from './backfill-sources.js';

test('parseStateCodeFromJurisdiction resolves full names and postal codes', () => {
  assert.equal(parseStateCodeFromJurisdiction('Philadelphia, Pennsylvania'), 'PA');
  assert.equal(parseStateCodeFromJurisdiction('Washington, D.C.'), 'DC');
  assert.equal(parseStateCodeFromJurisdiction('Atlanta, GA'), 'GA');
  assert.equal(parseStateCodeFromJurisdiction(undefined), undefined);
});

test('mapSearchIndexRecordToEmbeddingInput maps searchable fields', () => {
  const mapped = mapSearchIndexRecordToEmbeddingInput('ent_aamp_philadelphia_001', {
    id: 'ent_aamp_philadelphia_001',
    kind: 'institution',
    displayName: 'African American Museum in Philadelphia',
    summary: 'Founded in 1976 during the Bicentennial.',
    aliases: ['AAMP'],
    jurisdictionState: 'Philadelphia, Pennsylvania',
    eraBuckets: ['1970s'],
  });
  assert.ok(mapped);
  assert.equal(mapped.entityId, 'ent_aamp_philadelphia_001');
  assert.equal(mapped.entity.kind, 'institution');
  assert.equal(mapped.entity.displayName, 'African American Museum in Philadelphia');
  assert.equal(mapped.entity.summary, 'Founded in 1976 during the Bicentennial.');
  assert.deepEqual(mapped.entity.aliases, [{ value: 'AAMP' }]);
  assert.equal(mapped.location?.state, 'PA');
  assert.equal(mapped.location?.placeLabel, 'Philadelphia, Pennsylvania');
});

test('mapSearchIndexRecordToEmbeddingInput skips records without displayName', () => {
  assert.equal(
    mapSearchIndexRecordToEmbeddingInput('ent_x', { kind: 'place', summary: 'Only summary' }),
    undefined,
  );
});

test('mapCatalogFixtureRecordToEmbeddingInput prefers locationLabel for placeLabel', () => {
  const mapped = mapCatalogFixtureRecordToEmbeddingInput({
    id: 'ent_mother_bethel_ame_001',
    kind: 'place',
    displayName: 'Mother Bethel AME Church',
    summary: 'Founded in 1794 by Richard Allen.',
    jurisdictionLabel: 'Philadelphia, Pennsylvania',
    locationLabel: '419 S. 6th Street at Lombard Street, Society Hill',
  });
  assert.ok(mapped);
  assert.equal(mapped.location?.state, 'PA');
  assert.equal(
    mapped.location?.placeLabel,
    '419 S. 6th Street at Lombard Street, Society Hill',
  );
});

test('createNationalCatalogFixtureEntitySource pages unique fixture entities', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bb-embed-fixtures-'));
  writeFileSync(
    join(dir, 'a.json'),
    JSON.stringify([
      {
        id: 'ent_a',
        kind: 'place',
        displayName: 'Alpha',
        summary: 'A',
        jurisdictionLabel: 'Boston, Massachusetts',
      },
      {
        id: 'ent_b',
        kind: 'person',
        displayName: 'Beta',
        summary: 'B',
      },
    ]),
  );
  writeFileSync(
    join(dir, 'b.json'),
    JSON.stringify([
      {
        id: 'ent_a',
        kind: 'place',
        displayName: 'Alpha duplicate',
        summary: 'dup',
      },
      {
        id: 'ent_c',
        kind: 'event',
        displayName: 'Gamma',
        summary: 'C',
      },
    ]),
  );

  const source = createNationalCatalogFixtureEntitySource(dir, 2);
  const page1 = await source.listPage();
  assert.equal(page1.items.length, 2);
  assert.equal(page1.nextCursor, 'ent_b');
  const page2 = await source.listPage(page1.nextCursor);
  assert.equal(page2.items.length, 1);
  assert.equal(page2.items[0]?.entityId, 'ent_c');
  assert.equal(page2.nextCursor, undefined);
});
