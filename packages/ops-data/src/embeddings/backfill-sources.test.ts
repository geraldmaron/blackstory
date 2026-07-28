/**
 * Unit tests for publicSearchIndex embedding backfill source mappers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
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
