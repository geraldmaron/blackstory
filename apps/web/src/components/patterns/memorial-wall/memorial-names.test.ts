/**
 * Normalization tests for the merged memorial wall/list name dataset:
 * shared archive (police-violence + racial-terror research JSON) plus a
 * small legacy supplemental set, deduped and plate-eligibility filtered.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import policeViolenceRaw from '../../../../../../docs/research/police-violence-memorial-names.json';
import racialTerrorRaw from '../../../../../../docs/research/racial-terror-memorial-names.json';
import {
  isMemorialNamePlateEligible,
  MEMORIAL_NAMES as ARCHIVE_ENTRIES,
} from '../../atmosphere/memorial-names';
import {
  MEMORIAL_NAMES,
  MEMORIAL_NAMES_REQUIRED,
  memorialNamesAlphabetical,
} from './memorial-names';

type RawEntry = { readonly name: string };

test('raw research datasets sum to the documented 1,680 entries', () => {
  const police = policeViolenceRaw as readonly RawEntry[];
  const racialTerror = racialTerrorRaw as readonly RawEntry[];
  assert.equal(police.length, 1104);
  assert.equal(racialTerror.length, 576);
  assert.equal(police.length + racialTerror.length, 1680);
});

test('shared archive dataset is exactly the deduped merge of the two raw sources', () => {
  const police = policeViolenceRaw as readonly RawEntry[];
  const racialTerror = racialTerrorRaw as readonly RawEntry[];
  const rawNames = new Set([...police, ...racialTerror].map((entry) => entry.name));
  const archiveNames = new Set(ARCHIVE_ENTRIES.map((entry) => entry.name));
  assert.equal(archiveNames.size, rawNames.size);
  for (const name of archiveNames) {
    assert.ok(rawNames.has(name), `archive name not found in raw sources: ${name}`);
  }
});

test('every merged name is either plate-eligible or was correctly filtered out', () => {
  const eligibleArchiveCount = ARCHIVE_ENTRIES.filter(isMemorialNamePlateEligible).length;
  const ineligibleArchiveCount = ARCHIVE_ENTRIES.length - eligibleArchiveCount;
  assert.ok(
    ineligibleArchiveCount > 0,
    'expected at least one single-token archive name to be filtered',
  );

  for (const name of MEMORIAL_NAMES) {
    const tokenCount = name
      .trim()
      .split(/\s+/)
      .map((token) => token.replace(/^["']+|["']+$/g, ''))
      .filter((token) => /[A-Za-z]/.test(token)).length;
    assert.ok(tokenCount >= 2, `single-token name leaked into wall/list set: ${name}`);
  }
});

test('merged wall/list dataset is unique and reaches the expected final count', () => {
  assert.equal(
    new Set(MEMORIAL_NAMES.map((n) => n.trim().toLowerCase())).size,
    MEMORIAL_NAMES.length,
  );
  assert.equal(MEMORIAL_NAMES.length, 1672);
  assert.ok(
    MEMORIAL_NAMES.length > 1000,
    'expected the full merged dataset, not the old 64-name subset',
  );
});

test('required names remain present verbatim', () => {
  for (const required of MEMORIAL_NAMES_REQUIRED) {
    assert.ok(MEMORIAL_NAMES.includes(required), `missing required name: ${required}`);
  }
});

test('legacy supplemental names not yet in the archive are preserved', () => {
  assert.ok(MEMORIAL_NAMES.includes('Andrew Goodman'));
  assert.ok(MEMORIAL_NAMES.includes('Michael Schwerner'));
  assert.ok(MEMORIAL_NAMES.includes('Rodney King'));
});

test('memorialNamesAlphabetical sorts the full merged set', () => {
  const sorted = memorialNamesAlphabetical();
  assert.equal(sorted.length, MEMORIAL_NAMES.length);
  assert.ok(sorted.includes('Trayvon Martin'));
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(sorted[i - 1]!.localeCompare(sorted[i]!, 'en', { sensitivity: 'base' }) <= 0);
  }
});
