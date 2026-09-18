/**
 * Validates authored Lives law records from the missing-laws packet fixtures.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { validateLawEntity, type AuthoredLawEntityFile } from './law-entities.js';

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/lives/laws/missing-laws-packet-federal.json',
);

test('missing-laws federal packet records validate for the landscape loader', () => {
  const file = JSON.parse(readFileSync(fixturePath, 'utf8')) as AuthoredLawEntityFile;
  assert.ok(file.records.length >= 2);
  for (const record of file.records) {
    const result = validateLawEntity(record, { runId: 'lives_missing_laws_test' });
    assert.equal(result.ok, true, `${record.id}: ${result.ok ? '' : result.errors.join('; ')}`);
  }
});
