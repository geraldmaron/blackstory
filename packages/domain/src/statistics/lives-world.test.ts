/**
 * Unit of analysis, affordance, CPI derived-income, and world-packet validation for Lives.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeLivesAffordance,
  deriveLivesRealIncome,
  isLivesUnit,
  livesUnitEmphasis,
  selectLivesWorldBeats,
  validateLivesWorldBeats,
  type LivesWorldBeat,
} from './lives.js';

test('lives units are household, child, woman', () => {
  assert.equal(isLivesUnit('household'), true);
  assert.equal(isLivesUnit('player'), false);
  assert.ok(livesUnitEmphasis('child').primaryConditionKeys.includes('school_attendance'));
  assert.ok(livesUnitEmphasis('woman').refuseAsOwn.includes('homeownership'));
});

test('derived real income uses CPI from 1913 and refuses earlier years', () => {
  assert.equal(deriveLivesRealIncome({ amount: 1000, year: 1870, sourceLabel: 'test' }), null);
  const derived = deriveLivesRealIncome({
    amount: 10_000,
    year: 1970,
    comparisonYear: 2023,
    sourceLabel: 'National median',
  });
  assert.ok(derived);
  assert.equal(derived.status, 'derived');
  assert.ok(derived.comparisonAmount > derived.originalAmount);
  assert.match(derived.caption, /CPI-U-RS/);
});

test('affordance requires same-year dollars and refuses non-positive inputs', () => {
  assert.equal(
    computeLivesAffordance({
      kind: 'rent_to_income',
      annualIncome: 1200,
      price: 50,
      incomeYear: 1930,
      priceYear: 1940,
      incomeGeography: 'nation',
      priceGeography: 'nation',
      incomeSourceLabel: 'income',
      priceSourceLabel: 'rent',
      incomeObservationIds: ['a'],
      priceObservationIds: ['b'],
    }),
    null,
  );
  const ok = computeLivesAffordance({
    kind: 'rent_to_income',
    annualIncome: 1200,
    price: 50,
    incomeYear: 1930,
    priceYear: 1930,
    incomeGeography: 'nation',
    priceGeography: 'nation',
    incomeSourceLabel: 'income',
    priceSourceLabel: 'rent',
    incomeObservationIds: ['a'],
    priceObservationIds: ['b'],
  });
  assert.ok(ok);
  assert.equal(ok.status, 'modeled');
  assert.equal(ok.covers, true);
  assert.match(ok.caption, /percent of monthly income/);
});

test('world beat validation rejects missing citations and research markers', () => {
  const bad = validateLivesWorldBeats([
    {
      id: 'bad-beat',
      decade: 1960,
      areaIds: [],
      lenses: ['all'],
      unit: 'all',
      domain: 'housing',
      claimType: 'factual',
      heading: 'TODO housing',
      body: 'Not yet.',
      citations: [],
      entityIds: [],
    },
  ]);
  assert.ok(bad.errors.length >= 2);
  assert.equal(bad.records.length, 0);
});

test('selectLivesWorldBeats fills gap cards for missing core domains', () => {
  const beat: LivesWorldBeat = {
    id: 'only-housing',
    domain: 'housing',
    claimType: 'factual',
    heading: 'Housing',
    body: 'A sourced housing beat.',
    citations: [{ label: 'Census', url: 'https://www.census.gov/' }],
    appliesTo: ['all'],
    unit: 'all',
    entities: [],
  };
  const { beats, gaps } = selectLivesWorldBeats({
    beats: [beat],
    decade: 1960,
    unit: 'household',
    emphasis: 'black',
    domains: ['housing', 'justice', 'testimony'],
  });
  assert.equal(beats.length, 1);
  assert.equal(gaps.length, 2);
  assert.ok(gaps.some((gap) => gap.domain === 'justice'));
});

test('selectLivesWorldBeats can query every authored unit without a reader unit control', () => {
  const base: LivesWorldBeat = {
    id: 'household',
    domain: 'housing',
    claimType: 'factual',
    heading: 'Housing',
    body: 'A sourced housing beat.',
    citations: [{ label: 'Census', url: 'https://www.census.gov/' }],
    appliesTo: ['all'],
    unit: 'household',
    entities: [],
  };
  const records: LivesWorldBeat[] = [
    base,
    { ...base, id: 'child', unit: 'child', domain: 'schooling' },
    { ...base, id: 'woman', unit: 'woman', domain: 'work' },
  ];

  const selected = selectLivesWorldBeats({
    beats: records,
    decade: 1930,
    unit: 'all',
    emphasis: 'black',
  });

  assert.deepEqual(
    selected.beats.map((entry) => entry.id),
    ['household', 'child', 'woman'],
  );
});

function speakerBeat(speaker: Record<string, unknown>, claimType = 'testimony') {
  return {
    id: 'mediation-check',
    decade: 1930,
    areaIds: [],
    lenses: ['black'],
    unit: 'all',
    domain: 'testimony',
    claimType,
    heading: 'A tenant farmer’s account',
    body: 'An Alabama tenant farmer described debt and organizing under tenancy.',
    citations: [{ label: 'Publisher record', url: 'https://www.loc.gov/item/example/' }],
    entityIds: [],
    speaker,
  };
}

test('a speaker must say how their words reached the page', () => {
  const base = { name: 'Nate Shaw (Ned Cobb)', place: 'Alabama', year: '1930s' };

  const unlabeled = validateLivesWorldBeats([speakerBeat(base)]);
  assert.match(unlabeled.errors.join('\n'), /speaker\.mediation must be/);

  const unnamedWriter = validateLivesWorldBeats([
    speakerBeat({ ...base, mediation: 'as-told-to' }),
  ]);
  assert.match(
    unnamedWriter.errors.join('\n'),
    /mediatedBy is required when mediation is as-told-to/,
  );

  const labeled = validateLivesWorldBeats([
    speakerBeat({ ...base, mediation: 'as-told-to', mediatedBy: 'Theodore Rosengarten' }),
  ]);
  assert.deepEqual(labeled.errors, []);
  assert.equal(labeled.records[0]?.speaker?.mediation, 'as-told-to');
  assert.equal(labeled.records[0]?.speaker?.mediatedBy, 'Theodore Rosengarten');

  // The rule follows the speaker, not the claim type.
  const factualWithSpeaker = validateLivesWorldBeats([speakerBeat(base, 'factual')]);
  assert.match(factualWithSpeaker.errors.join('\n'), /speaker\.mediation must be/);
});

test('the mediation line names the second person only where there is one', async () => {
  const { livesWorldMediationLine } = await import('./lives.js');
  const who = { name: 'N', place: 'P', year: 'Y' };
  assert.equal(
    livesWorldMediationLine({ ...who, mediation: 'self-authored' }),
    'In their own writing',
  );
  assert.equal(
    livesWorldMediationLine({
      ...who,
      mediation: 'as-told-to',
      mediatedBy: 'Theodore Rosengarten',
    }),
    'As told to Theodore Rosengarten',
  );
  assert.equal(
    livesWorldMediationLine({ ...who, mediation: 'reported-by-third-party' }),
    'Reported by an observer',
  );
});
