/**
 * Unit tests for deterministic status backfill derivation helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyStatusFix,
  buildCorrectedStatusHistory,
  buildTerminalStatusHistory,
  caseNeedsStatusReview,
  derivePersonLivingStatusDeterministic,
  hasRecentLifeEvidenceFromClaims,
  isDeathBearingPredicate,
  LAW_STATUS_FIXES,
  PLACE_STATUS_FIXES,
} from './status-backfill.ts';

test('isDeathBearingPredicate matches death-bearing claim predicates', () => {
  assert.equal(isDeathBearingPredicate('was lynched in 1931'), true);
  assert.equal(isDeathBearingPredicate('date_of_death'), true);
  assert.equal(isDeathBearingPredicate('buried_at'), true);
  assert.equal(isDeathBearingPredicate('assassinated_on'), true);
  assert.equal(isDeathBearingPredicate('died_in'), true);
  assert.equal(isDeathBearingPredicate('birth_year'), false);
});

test('derivePersonLivingStatusDeterministic prefers death claims over BDP', () => {
  const result = derivePersonLivingStatusDeterministic({
    claims: [
      { claimId: 'c1', predicate: 'was killed', object: '1968' },
      { claimId: 'c2', predicate: 'birth_year', object: '1900' },
    ],
    qualifiers: [],
  });
  assert.equal(result.status, 'deceased');
  assert.equal(result.signal, 'death_claim');
  assert.deepEqual(result.basisClaimIds, ['c1']);
});

test('derivePersonLivingStatusDeterministic uses death qualifier with edtf', () => {
  const result = derivePersonLivingStatusDeterministic({
    claims: [],
    qualifiers: [
      {
        claimId: 'c9',
        predicate: 'date_of_death',
        property: 'point_in_time',
        edtf: '1968-04-04',
      },
    ],
  });
  assert.equal(result.status, 'deceased');
  assert.equal(result.signal, 'death_qualifier');
  assert.equal(result.deathEdtf, '1968-04-04');
});

test('derivePersonLivingStatusDeterministic applies WP:BDP as presumed_deceased', () => {
  const result = derivePersonLivingStatusDeterministic({
    claims: [{ claimId: 'c2', predicate: 'birth_year', object: '1850' }],
    qualifiers: [],
    asOfYear: 2026,
  });
  assert.equal(result.status, 'presumed_deceased');
  assert.equal(result.signal, 'bdp_rule');
  assert.equal(result.birthYear, 1850);
});

test('derivePersonLivingStatusDeterministic blocks BDP when recent life evidence exists', () => {
  const result = derivePersonLivingStatusDeterministic({
    claims: [
      { claimId: 'c2', predicate: 'birth_year', object: '1900' },
      { claimId: 'c3', predicate: 'was honored in', object: '2025' },
    ],
    qualifiers: [],
    asOfYear: 2026,
  });
  assert.equal(result.status, 'unknown');
  assert.equal(result.signal, 'no_signal');
  assert.equal(
    hasRecentLifeEvidenceFromClaims(
      [{ claimId: 'c3', predicate: 'honored', object: '2025' }],
      2026,
    ),
    true,
  );
});

test('buildTerminalStatusHistory closes open-ended prior entry', () => {
  const prior = [
    {
      status: 'in_force',
      validFrom: '1875',
      datePrecision: 'year' as const,
      basisClaimIds: ['c1'],
    },
  ];
  const next = buildTerminalStatusHistory(prior, {
    priorStatus: 'in_force',
    nextStatus: 'struck_down',
    validFrom: '1875',
    validTo: '1883',
    datePrecision: 'year',
    basisClaimIds: ['c1'],
  });
  assert.equal(next.length, 2);
  assert.equal(next[0]?.validTo, '1883');
  assert.equal(next[1]?.status, 'struck_down');
  assert.equal(next[1]?.validTo, null);
});

test('buildCorrectedStatusHistory replaces wrong prior snapshot', () => {
  const corrected = buildCorrectedStatusHistory({
    nextStatus: 'in_force',
    validFrom: '1868',
    datePrecision: 'year',
    basisClaimIds: ['c1', 'c2'],
  });
  assert.equal(corrected.length, 1);
  assert.equal(corrected[0]?.status, 'in_force');
  assert.equal(corrected[0]?.validFrom, '1868');
  assert.equal(corrected[0]?.validTo, null);
});

test('applyStatusFix uses replace mode for Fourteenth Amendment fix', () => {
  const fix = LAW_STATUS_FIXES.find((row) => row.entityId === 'ent_law_14th_amendment_1868');
  assert.ok(fix);
  const prior = [
    {
      status: 'repealed',
      validFrom: '1860',
      datePrecision: 'year' as const,
      basisClaimIds: ['c1'],
    },
  ];
  const next = applyStatusFix(prior, fix!);
  assert.equal(next.length, 1);
  assert.equal(next[0]?.status, 'in_force');
  assert.equal(next[0]?.validFrom, '1868');
});

test('applyStatusFix uses terminal mode for Louisiana Separate Car Act', () => {
  const fix = LAW_STATUS_FIXES.find(
    (row) => row.entityId === 'ent_law_louisiana_separate_car_act_1890',
  );
  assert.ok(fix);
  const prior = [
    {
      status: 'in_force',
      validFrom: '1890',
      datePrecision: 'year' as const,
      basisClaimIds: ['c1'],
    },
  ];
  const next = applyStatusFix(prior, fix!);
  assert.equal(next.length, 2);
  assert.equal(next[0]?.validTo, '1964');
  assert.equal(next[1]?.status, 'struck_down');
});

test('caseNeedsStatusReview flags in_force rows with demise language', () => {
  assert.equal(
    caseNeedsStatusReview({
      entityId: 'ent_case_example',
      openStatus: 'in_force',
      kindDetail: { editorial: { summary: 'The court struck down the statute in 1964.' } },
    }),
    true,
  );
  assert.equal(
    caseNeedsStatusReview({
      entityId: 'ent_case_example',
      openStatus: 'struck_down',
      kindDetail: { editorial: { summary: 'The court struck down the statute in 1964.' } },
    }),
    false,
  );
});

test('law and place fix catalogs include named audit targets', () => {
  assert.ok(LAW_STATUS_FIXES.some((f) => f.entityId === 'ent_law_civil_rights_act_1875'));
  assert.ok(LAW_STATUS_FIXES.some((f) => f.entityId === 'ent_law_14th_amendment_1868'));
  assert.ok(LAW_STATUS_FIXES.some((f) => f.entityId === 'ent_law_freedmens_bureau_act_1865'));
  assert.ok(PLACE_STATUS_FIXES.some((f) => f.entityId === 'ent_negro_fort_001'));
  assert.ok(PLACE_STATUS_FIXES.some((f) => f.entityId === 'ent_charles_wright_museum_001'));
  assert.ok(PLACE_STATUS_FIXES.some((f) => f.entityId === 'ent_little_rock_central_high_001'));
  assert.ok(PLACE_STATUS_FIXES.some((f) => f.entityId === 'ent_pullman_porters_001'));
  assert.ok(PLACE_STATUS_FIXES.some((f) => f.entityId === 'dc-black-history-sites-i38'));
});
