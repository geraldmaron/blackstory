import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPinPlanRow,
  depictionHoldFor,
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

/*
 * The depiction gate (repo-n7p6.7.1).
 *
 * Every string below is a REAL file title or Commons ImageDescription that was live on a
 * BlackStory person record on 2026-09-13, fetched from the Commons API. They are here verbatim
 * because the failure was not a hypothetical: the entity gate passed all of them, since there was
 * never anything wrong with the entity.
 */
test('a group photograph is refused even when the file title is just the subject name', () => {
  // The worst live case. Two of the four children murdered in the 16th Street Baptist Church
  // bombing carried this one photograph of all four as their solo portrait.
  assert.equal(
    depictionHoldFor(
      { fileTitle: 'File:Cynthia Wesley (cropped).jpg', kind: 'person' },
      'The four girls killed during the 16th Street Baptist Church bombing. From left: Denise McNair (11), Carole Robertson (14), Addie Mae Collins (14), Cynthia Wesley, (14)',
    ),
    'depicts_a_group',
    '"(cropped)" is not evidence the crop isolated the subject — here it did not',
  );
});

test('a class photograph is refused on its title alone, before any description is fetched', () => {
  assert.equal(
    depictionHoldFor(
      {
        fileTitle:
          'File:Charles C. Dawson and class at the School of the Art Institute of Chicago.jpg',
        kind: 'person',
      },
      undefined,
    ),
    'depicts_a_group',
    'the gate has to work with no description, because that is the cheap path',
  );
});

test('a photograph of the subject with family is refused', () => {
  assert.equal(
    depictionHoldFor(
      {
        fileTitle: 'File:Jill Brown and parents alongside a T-34B Mentor training aircraft.jpg',
        kind: 'person',
      },
      'Aviation Officer Candidate Jill Brown and her parents, Mr. and Mrs. Gilbert Brown stand alongside a T-34B Mentor training aircraft.',
    ),
    'depicts_a_group',
  );
});

test('a file whose own title opens on someone else is refused', () => {
  assert.equal(
    depictionHoldFor(
      {
        fileTitle:
          'File:Unidentified man, New Orleans Mayor Ernest N. "Dutch" Morial, Mayor Raymond L. Flynn and Mayor Coleman Young at the U.S. Conference of Mayors.jpg',
        kind: 'person',
      },
      undefined,
    ),
    'depicts_a_group',
  );
});

test('a statue, a mural and a headstone are refused: an object of someone is not a photograph of them', () => {
  for (const title of [
    'File:Daisy Bates Statue (cropped).jpg',
    'File:Rebecca Howard mural in Olympia, WA.jpg',
    'File:Headstone of Example Person.jpg',
  ]) {
    assert.equal(
      depictionHoldFor({ fileTitle: title, kind: 'person' }, undefined),
      'depicts_an_object',
      title,
    );
  }
});

test('an ordinary solo portrait passes, including a legitimate crop', () => {
  for (const title of [
    'File:Booker T. Washington by Francis Benjamin Johnston, c. 1895.jpg',
    'File:W.E.B. Du Bois by James E. Purdy, 1907 (cropped).jpg',
    'File:Harriet Tubman (circa 1885).jpg',
    'File:Stokely Carmichael HS Yearbook.jpg',
  ]) {
    assert.equal(
      depictionHoldFor({ fileTitle: title, kind: 'person' }, undefined),
      undefined,
      title,
    );
  }
});

test("a place's photograph of its own marker is not held: the rule is about person records", () => {
  assert.equal(
    depictionHoldFor(
      { fileTitle: 'File:Historical marker at the Example Site.jpg', kind: 'place' },
      'Historical marker erected at the site.',
    ),
    undefined,
  );
});

test('the gate reports depiction_hold, so the operator report can say which rule fired', () => {
  const result = evaluatePinGate(
    {
      entityId: 'ent_example_001',
      displayName: 'Example',
      outcome: 'auto_propose',
      kind: 'person',
      fileTitle: 'File:Example and class.jpg',
      alt: 'alt',
      credit: 'credit',
      rightsStatus: 'public_domain',
    },
    { allowPlaces: false },
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'depiction_hold');
  assert.equal(result.detail, 'depicts_a_group');
});
