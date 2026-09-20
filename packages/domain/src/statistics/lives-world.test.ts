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

const HUGHES_RECORDING = {
  mediaUrl:
    'https://tile.loc.gov/storage-services/service/afc/afc1950037/afc1950037_afs09990/afc1950037_afs09990a.mp3',
  itemUrl: 'https://www.loc.gov/item/afc1950037_afs09990a/',
  transcriptUrl:
    'https://tile.loc.gov/storage-services/service/afc/afc1950037/afc1950037_afs09990/afc1950037_afs09990a.pdf',
  holdingInstitution: 'American Folklife Center, Library of Congress',
  creditLine:
    'Cyrus B. Koonce Collection (AFC 1950/037), American Folklife Center, Library of Congress',
  rightsNote:
    'The Library of Congress is unaware of any copyright or other restrictions in the Voices Remembering Slavery Collection.',
  recordedOn: 'June 11, 1949, Baltimore, Maryland',
};

test('a recording must belong to a recorded interview with a named interviewer', () => {
  const who = { name: 'Fountain Hughes', place: 'Baltimore, Maryland', year: '1949' };
  const wrongMediation = validateLivesWorldBeats([
    { ...speakerBeat({ ...who, mediation: 'self-authored' }), recording: HUGHES_RECORDING },
  ]);
  assert.match(
    wrongMediation.errors.join('\n'),
    /requires a speaker whose mediation is recorded-interview/,
  );

  const insecure = validateLivesWorldBeats([
    {
      ...speakerBeat({ ...who, mediation: 'recorded-interview', mediatedBy: 'Hermond Norwood' }),
      recording: { ...HUGHES_RECORDING, mediaUrl: 'http://tile.loc.gov/x.mp3' },
    },
  ]);
  assert.match(insecure.errors.join('\n'), /recording\.mediaUrl must be an https URL/);

  const good = validateLivesWorldBeats([
    {
      ...speakerBeat({ ...who, mediation: 'recorded-interview', mediatedBy: 'Hermond Norwood' }),
      quote: 'We didn’t have no property. We didn’t have no home. We had nowhere or nothing.',
      recording: HUGHES_RECORDING,
    },
  ]);
  assert.deepEqual(good.errors, []);
  assert.equal(good.records[0]?.recording?.mediaUrl, HUGHES_RECORDING.mediaUrl);
  assert.match(good.records[0]?.quote ?? '', /nowhere or nothing/);
});

test('a quote needs a speaker and stays within forty words', () => {
  const noSpeaker = validateLivesWorldBeats([
    { ...speakerBeat({}, 'factual'), speaker: undefined, quote: 'Words with nobody attached.' },
  ]);
  assert.match(noSpeaker.errors.join('\n'), /a quote requires a speaker/);

  const long = validateLivesWorldBeats([
    {
      ...speakerBeat({ name: 'N', place: 'P', year: 'Y', mediation: 'self-authored' }),
      quote: Array.from({ length: 41 }, () => 'word').join(' '),
    },
  ]);
  assert.match(long.errors.join('\n'), /quote is longer than 40 words/);
});

test('a group gap is derived only from two published rates, and claims no cause', async () => {
  const { deriveLivesConditionGap } = await import('./lives.js');
  const published = (estimate: number, extra: Record<string, unknown> = {}) => ({
    state: 'published' as const,
    estimate,
    definitionLabel: 'as the census recorded it',
    ...extra,
  });
  const pending = { state: 'pending' as const, reason: 'Not yet loaded' };

  const home = deriveLivesConditionGap({
    black: published(24.62, { observationIds: ['obs-b'] }),
    white: published(50.42, { observationIds: ['obs-w'] }),
    hispanic: pending,
  });
  assert.equal(home?.points, 25.8);
  assert.equal(home?.status, 'derived');
  assert.deepEqual(home?.inputObservationIds, ['obs-b', 'obs-w']);
  assert.match(home?.assumptions.join(' ') ?? '', /does not say why/);
  assert.equal(home?.uncertainty, undefined);

  // The Black figure may be the higher one; the gap is a distance either way.
  const work = deriveLivesConditionGap({
    black: published(12, { marginOfError: 0.3 }),
    white: published(6, { marginOfError: 0.4 }),
    hispanic: pending,
  });
  assert.equal(work?.points, 6);
  assert.equal(work?.uncertainty, 0.5);

  assert.equal(
    deriveLivesConditionGap({ black: published(20), white: pending, hispanic: pending }),
    null,
  );
});

test('shares of one total are never reported as a gap between groups', async () => {
  const { livesConditionIsGroupRate } = await import('./lives.js');
  assert.equal(livesConditionIsGroupRate('population_share'), false);
  assert.equal(livesConditionIsGroupRate('homeownership'), true);
  assert.equal(livesConditionIsGroupRate('unemployed'), true);
});
