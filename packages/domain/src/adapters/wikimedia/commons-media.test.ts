/**
 * Fixture tests for deterministic Commons media enrichment (no live network).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAltText,
  buildCreditLine,
  chunkForWikimediaBatch,
  evaluateCommonsMediaPropose,
  extractP18Candidates,
  isExactLabelMatch,
  mapCommonsLicenseToRights,
  summarizeCommonsMediaProposes,
} from './commons-media.js';
import type { WikidataEntity } from './types.js';

test('exact label match is case-insensitive and whitespace-normalized', () => {
  assert.equal(isExactLabelMatch('Rosa Parks', 'rosa  parks'), true);
  assert.equal(isExactLabelMatch('Rosa Parks', 'Rosa Louise Parks'), false);
});

test('mapCommonsLicenseToRights accepts PD and libre CC; rejects NC/unknown', () => {
  assert.equal(mapCommonsLicenseToRights('Public domain'), 'public_domain');
  assert.equal(mapCommonsLicenseToRights('CC0'), 'public_domain');
  assert.equal(mapCommonsLicenseToRights('CC BY-SA 4.0'), 'licensed');
  assert.equal(mapCommonsLicenseToRights('CC BY 3.0'), 'licensed');
  assert.equal(mapCommonsLicenseToRights('CC BY-NC 4.0'), undefined);
  assert.equal(mapCommonsLicenseToRights('Fair use'), undefined);
  assert.equal(mapCommonsLicenseToRights(undefined), undefined);
});

test('extractP18Candidates prefers preferred-rank and skips deprecated', () => {
  const entity = {
    id: 'Q1',
    claims: {
      P18: [
        {
          rank: 'deprecated',
          mainsnak: { property: 'P18', datavalue: { value: 'Old.jpg' } },
        },
        {
          rank: 'normal',
          mainsnak: { property: 'P18', datavalue: { value: 'Normal.jpg' } },
        },
        {
          rank: 'preferred',
          mainsnak: { property: 'P18', datavalue: { value: 'Preferred.jpg' } },
        },
      ],
    },
  } satisfies WikidataEntity;

  const candidates = extractP18Candidates(entity);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]!.fileTitle, 'File:Preferred.jpg');
});

test('evaluateCommonsMediaPropose auto-proposes only on full deterministic gate', () => {
  const propose = evaluateCommonsMediaPropose({
    entity: { entityId: 'ent_1', displayName: 'Rosa Parks' },
    wikidataId: 'Q41909',
    qidMatchMethod: 'enwiki_exact_title',
    enwikiTitle: 'Rosa_Parks',
    p18Candidates: [{ fileTitle: 'File:Rosa Parks.jpg', rank: 'preferred' }],
    image: {
      fileTitle: 'File:Rosa Parks.jpg',
      commonsPageUrl: 'https://commons.wikimedia.org/wiki/File:Rosa_Parks.jpg',
      fullUrl: 'https://upload.wikimedia.org/wikipedia/commons/r/rp.jpg',
      licenseShortName: 'Public domain',
      artist: 'United Press',
      imageDescription: 'Rosa Parks in 1955',
    },
  });

  assert.equal(propose.outcome, 'auto_propose');
  assert.equal(propose.rightsStatus, 'public_domain');
  assert.ok(propose.alt);
  assert.ok(propose.credit?.includes('United Press'));
  assert.ok(propose.resourceLinks?.some((l) => l.kind === 'wikipedia'));
});

test('evaluateCommonsMediaPropose refuses ambiguous P18 and unmapped license', () => {
  const ambiguous = evaluateCommonsMediaPropose({
    entity: { entityId: 'ent_1', displayName: 'Test' },
    wikidataId: 'Q1',
    p18Candidates: [
      { fileTitle: 'File:A.jpg', rank: 'normal' },
      { fileTitle: 'File:B.jpg', rank: 'normal' },
    ],
  });
  assert.equal(ambiguous.outcome, 'p18_ambiguous');

  const unmapped = evaluateCommonsMediaPropose({
    entity: { entityId: 'ent_1', displayName: 'Test' },
    wikidataId: 'Q1',
    p18Candidates: [{ fileTitle: 'File:A.jpg', rank: 'preferred' }],
    image: {
      fileTitle: 'File:A.jpg',
      commonsPageUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
      licenseShortName: 'CC BY-NC 4.0',
      artist: 'Someone',
    },
  });
  assert.equal(unmapped.outcome, 'license_unmapped');
});

test('buildAltText and credit are deterministic from metadata', () => {
  assert.equal(
    buildAltText({
      displayName: 'Rosa Parks',
      imageDescription: 'Rosa Parks seated on a bus',
      fileTitle: 'File:Rosa_Parks.jpg',
    }),
    'Rosa Parks seated on a bus',
  );
  assert.equal(
    buildCreditLine({ artist: '<a href="x">Jane Doe</a>', licenseShortName: 'CC BY 4.0' }),
    'Jane Doe · CC BY 4.0 · Wikimedia Commons',
  );
});

test('chunkForWikimediaBatch and summarize counts', () => {
  assert.deepEqual(chunkForWikimediaBatch([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  const counts = summarizeCommonsMediaProposes([
    {
      schemaVersion: 'commons-media-propose.v1',
      entityId: 'a',
      displayName: 'A',
      outcome: 'auto_propose',
      reason: 'ok',
      wikidataId: 'Q1',
    },
    {
      schemaVersion: 'commons-media-propose.v1',
      entityId: 'b',
      displayName: 'B',
      outcome: 'no_qid',
      reason: 'missing',
    },
  ]);
  assert.equal(counts.total, 2);
  assert.equal(counts.auto_propose, 1);
  assert.equal(counts.no_qid, 1);
  assert.equal(counts.withQid, 1);
});
