/**
 * The AI-review notice lives at site level (footer, methodology, FAQ). A record row on /records
 * must not carry its own note about who or what checked it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const files = [
  join(here, 'RecordsIndex.tsx'),
  join(here, '../../components/discovery/records-chronology.tsx'),
  join(here, 'load-records-index.ts'),
];

test('the records page carries no per-record note about AI review or validation', () => {
  for (const file of files) {
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /\bAI[- ](validated|reviewed|checked)|\b(validated|reviewed|checked) by\b/i,
      `${file} mentions how a record was checked; that notice belongs to the site, not the row`,
    );
  }
});
