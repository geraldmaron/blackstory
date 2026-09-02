import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPinPlanRow,
  dignityHoldFor,
  evaluatePinGate,
  mergeCandidatePayloads,
  type CommonsAutoProposeRow,
} from './pin-commons-primary-images-plan.ts';

const BASE_ROW: CommonsAutoProposeRow = {
  entityId: 'ent_rosa_parks',
  displayName: 'Rosa Parks',
  kind: 'person',
  outcome: 'auto_propose',
  fileTitle: 'File:Rosa Parks.jpg',
  commonsPageUrl: 'https://commons.wikimedia.org/wiki/File:Rosa_Parks.jpg',
  alt: 'Rosa Parks, seated, 1955.',
  credit: 'Wikimedia Commons',
  rightsStatus: 'licensed',
  licenseShortName: 'CC BY-SA 4.0',
  wikidataId: 'Q1234',
};

test('dignityHoldFor trusts a precomputed dignityHold when present', () => {
  assert.equal(
    dignityHoldFor({ ...BASE_ROW, dignityHold: 'contested_legacy' }),
    'contested_legacy',
  );
});

test('dignityHoldFor re-derives the lynching_ prefix rule independently', () => {
  assert.equal(dignityHoldFor({ ...BASE_ROW, entityId: 'lynching_1899_smith' }), 'lynching_prefix');
});

test('dignityHoldFor re-derives DIGNITY_CLASSES from raw sensitivity rows', () => {
  assert.equal(
    dignityHoldFor({ ...BASE_ROW, sensitivity: [{ class: 'enslaver_or_segregationist' }] }),
    'enslaver_or_segregationist',
  );
  assert.equal(
    dignityHoldFor({ ...BASE_ROW, sensitivity: [{ class: 'unrelated_class' }] }),
    undefined,
  );
  assert.equal(dignityHoldFor(BASE_ROW), undefined);
});

test('evaluatePinGate passes a clean auto_propose person row', () => {
  assert.deepEqual(evaluatePinGate(BASE_ROW), { ok: true });
});

test('evaluatePinGate holds any dignity-flagged row regardless of kind', () => {
  const result = evaluatePinGate({ ...BASE_ROW, dignityHold: 'violence_associated' });
  assert.deepEqual(result, { ok: false, reason: 'dignity_hold' });
});

test('evaluatePinGate holds lynching_-prefixed entities even without a precomputed hold', () => {
  const result = evaluatePinGate({ ...BASE_ROW, entityId: 'lynching_1899_smith' });
  assert.deepEqual(result, { ok: false, reason: 'dignity_hold' });
});

test('evaluatePinGate holds place-kind rows unless allowPlaces is set', () => {
  const placeRow = { ...BASE_ROW, kind: 'place' };
  assert.deepEqual(evaluatePinGate(placeRow), { ok: false, reason: 'place_kind' });
  assert.deepEqual(evaluatePinGate(placeRow, { allowPlaces: true }), { ok: true });
});

test('evaluatePinGate rejects non-auto_propose outcomes and incomplete rows', () => {
  assert.deepEqual(evaluatePinGate({ ...BASE_ROW, outcome: 'needs_review' }), {
    ok: false,
    reason: 'incomplete_row',
  });
  assert.deepEqual(evaluatePinGate({ ...BASE_ROW, fileTitle: undefined }), {
    ok: false,
    reason: 'incomplete_row',
  });
});

test('buildPinPlanRow shapes the plan row from a gated-in row', () => {
  const plan = buildPinPlanRow({
    row: BASE_ROW,
    thumbUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/File:Rosa_Parks.jpg?width=960',
    sha1: 'deadbeef',
  });
  assert.deepEqual(plan, {
    entityId: 'ent_rosa_parks',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/File:Rosa_Parks.jpg?width=960',
    fileTitle: 'File:Rosa Parks.jpg',
    sha1: 'deadbeef',
    license: 'CC BY-SA 4.0',
    credit: 'Wikimedia Commons',
    sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Rosa_Parks.jpg',
    alt: 'Rosa Parks, seated, 1955.',
  });
});

test('buildPinPlanRow omits sha1/license when not supplied and refuses an incomplete row', () => {
  const plan = buildPinPlanRow({
    row: { ...BASE_ROW, licenseShortName: undefined },
    thumbUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/File:Rosa_Parks.jpg?width=960',
  });
  assert.equal('sha1' in plan, false);
  assert.equal('license' in plan, false);

  assert.throws(() =>
    buildPinPlanRow({
      row: { ...BASE_ROW, fileTitle: undefined },
      thumbUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/File:Rosa_Parks.jpg?width=960',
    }),
  );
});

test('buildPinPlanRow prefers a row-supplied sha1 over the caller fallback', () => {
  const plan = buildPinPlanRow({
    row: { ...BASE_ROW, sha1: 'row-sha1' },
    thumbUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/File:Rosa_Parks.jpg?width=960',
    sha1: 'fallback-sha1',
  });
  assert.equal(plan.sha1, 'row-sha1');
});

test('buildPinPlanRow falls back to the caller-supplied sha1 when the row has none', () => {
  const plan = buildPinPlanRow({
    row: BASE_ROW,
    thumbUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/File:Rosa_Parks.jpg?width=960',
    sha1: 'fallback-sha1',
  });
  assert.equal(plan.sha1, 'fallback-sha1');
});

const NRHP_ROW: CommonsAutoProposeRow = {
  ...BASE_ROW,
  entityId: 'ent_nrhp_kelly_ingram_park',
  displayName: 'Kelly Ingram Park',
  kind: 'place',
};

test('mergeCandidatePayloads combines autoProposeAll and proposes across files', () => {
  const merged = mergeCandidatePayloads([{ autoProposeAll: [BASE_ROW] }, { proposes: [NRHP_ROW] }]);
  assert.deepEqual(
    merged.map((r) => r.entityId),
    [BASE_ROW.entityId, NRHP_ROW.entityId],
  );
});

test('mergeCandidatePayloads prefers autoProposeAll over autoProposePeople within one payload', () => {
  const merged = mergeCandidatePayloads([
    { autoProposeAll: [BASE_ROW], autoProposePeople: [NRHP_ROW] },
  ]);
  assert.deepEqual(
    merged.map((r) => r.entityId),
    [BASE_ROW.entityId],
  );
});

test('mergeCandidatePayloads dedupes by entityId, first payload wins', () => {
  const dupRow: CommonsAutoProposeRow = { ...BASE_ROW, displayName: 'Duplicate Rosa Parks' };
  const merged = mergeCandidatePayloads([{ proposes: [BASE_ROW] }, { proposes: [dupRow] }]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.displayName, 'Rosa Parks');
});

test('mergeCandidatePayloads on no payloads returns an empty list', () => {
  assert.deepEqual(mergeCandidatePayloads([]), []);
});
