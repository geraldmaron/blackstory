/**
 * Tests for the "why this appears" public composer exercises the five acceptance
 * criteria end to end against `buildPublicWhyThisAppears`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RelevanceEvidence } from './types.js';
import {
  assertReasonNotIdentityAttendanceOrJobAlone,
  assertSubstantiveConnectionExplained,
  buildPublicWhyThisAppears,
} from './why-public-explanation.js';

const ACCEPTED_EVIDENCE: readonly RelevanceEvidence[] = [
  { kind: 'thematic', summary: 'Thematic term classes matched.', detail: 'freedmen, schools' },
  {
    kind: 'geographic',
    summary: 'Geographic place connection detected.',
    detail: 'Washington, D.C.',
  },
];

const BASIS = [
  {
    criterion: 'documented_site' as const,
    note: 'Primary-source evidence ties this campus to a documented Freedmen school.',
    evidenceIds: ['ev-1'],
  },
];

test('buildPublicWhyThisAppears composes explanation, notabilityBasis, dimensions, and notices', () => {
  const result = buildPublicWhyThisAppears({
    explanation:
      'Included because archival records document this campus as a Freedmen school founded by the community.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: BASIS,
    storyTexts: [
      'The community founded the school and organized mutual aid alongside daily classroom life.',
    ],
  });

  assert.equal(result.notabilityBasis.length, 1);
  assert.equal(result.notabilityBasis[0]?.criterionLabel, 'Documented site');
  assert.ok(result.storyDimensions.includes('institution_building'));
  assert.equal(result.traumaContentNotice.warranted, false);
  assert.deepEqual(result.missingPerspectiveIndicators, []);
});

test('AC1: throws when notabilityBasis is empty even if the explanation reads well', () => {
  assert.throws(
    () =>
      buildPublicWhyThisAppears({
        explanation: 'This is a long enough explanation sentence describing a connection.',
        evidence: ACCEPTED_EVIDENCE,
        notabilityBasis: [],
      }),
    /notabilityBasis record/,
  );
});

test('AC1: assertSubstantiveConnectionExplained throws on a too-short explanation', () => {
  assert.throws(
    () =>
      assertSubstantiveConnectionExplained({ explanation: 'Included.', notabilityBasis: BASIS }),
    /too short/,
  );
});

test('AC2: throws when the explanation presents fame/attendance/residence alone as the reason', () => {
  assert.throws(
    () => assertReasonNotIdentityAttendanceOrJobAlone('Included because of their fame alone.'),
    /race, fame, attendance, employment, or residence alone/,
  );
  assert.doesNotThrow(() =>
    assertReasonNotIdentityAttendanceOrJobAlone(
      'Included because the site is documented as a Freedmen school with primary-source evidence.',
    ),
  );
});

test('AC3: buildPublicWhyThisAppears returns storyDimensions for the caller to run the result-set collapse check over', () => {
  const result = buildPublicWhyThisAppears({
    explanation:
      'A mob of white residents committed violence and burned down the church on the night of March 3, 1921.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: BASIS,
  });
  assert.deepEqual(result.storyDimensions, ['harm']);
  assert.equal(result.traumaContentNotice.warranted, true);
  assert.equal(result.missingPerspectiveIndicators.length, 8);
});

test('AC4: throws when evidence has no substantive (non-gate) entries', () => {
  assert.throws(
    () =>
      buildPublicWhyThisAppears({
        explanation: 'This is a long enough explanation sentence describing a connection.',
        evidence: [{ kind: 'gate', summary: 'Gate threshold failed.', detail: 'below minimum' }],
        notabilityBasis: BASIS,
      }),
    /substantive \(non-gate\) accepted relevance evidence/,
  );
});

test('AC5: rendered notabilityBasis is auditable (criterion, rubric, note, evidenceIds) and carries no numeric leaf', () => {
  const result = buildPublicWhyThisAppears({
    explanation:
      'Included because archival records document this campus as a Freedmen school founded by the community.',
    evidence: ACCEPTED_EVIDENCE,
    notabilityBasis: BASIS,
  });
  const [item] = result.notabilityBasis;
  assert.equal(item?.criterion, 'documented_site');
  assert.ok(item?.rubric.includes('documented site'));
  assert.deepEqual(item?.evidenceIds, ['ev-1']);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized.toLowerCase(), /score/);
});

test('rejects prose containing a passive-euphemism phrase before it ever reaches the public payload', () => {
  assert.throws(
    () =>
      buildPublicWhyThisAppears({
        explanation: 'An incident occurred at the school in 1954, tied to its founding community.',
        evidence: ACCEPTED_EVIDENCE,
        notabilityBasis: BASIS,
      }),
    /passive-euphemism phrasing/,
  );
});
