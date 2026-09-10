/**
 * Myth guards. Each case pins a real attribution that circulates publicly against the receipt
 * that actually exists, so the guard fails loudly if the rule is removed.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  boundedAlternativesFor,
  checkAttribution,
  checkCommunityIdentityEvidence,
  findAttributionMarkers,
  highImpactAssertionsInText,
  makesBroadAttribution,
  makesSuperlativeClaim,
  patentTitleSuggestsImprovement,
} from './attribution.ts';

const codes = (findings: readonly { code: string }[]): string[] => findings.map((f) => f.code);

test('Latimer: the patent is a process for manufacturing carbons, so "invented the light bulb" is caught', () => {
  // Case E. US 252,386, "Process of Manufacturing Carbons".
  const findings = checkAttribution({
    statement: 'Lewis Latimer invented the light bulb.',
    supportingSourceClasses: ['patent_specification'],
    patentTitle: 'Process of Manufacturing Carbons',
  });
  assert.ok(codes(findings).includes('invention_scope_broader_than_patent'));
});

test('Latimer: the bounded sentence about the same patent passes', () => {
  // The gate must let the true sentence through, or it is just a word filter.
  const findings = checkAttribution({
    statement:
      'Lewis Latimer patented an improved process for manufacturing carbon conductors used in incandescent lamps.',
    supportingSourceClasses: ['patent_specification'],
    patentTitle: 'Process of Manufacturing Carbons',
  });
  assert.deepEqual(codes(findings), []);
});

test('Morgan: "invented the traffic light" is caught; the all-stop sentence is not', () => {
  // US 1,475,024 is an improvement within an existing traffic-signal field.
  const broad = checkAttribution({
    statement: 'Garrett Morgan invented the traffic light.',
    supportingSourceClasses: ['patent_specification'],
    patentTitle: 'Traffic Signal',
  });
  assert.ok(codes(broad).includes('invention_scope_broader_than_patent'));

  const bounded = checkAttribution({
    statement:
      'Garrett Morgan patented a traffic signal incorporating an all-stop intermediate position.',
    supportingSourceClasses: ['patent_specification'],
    patentTitle: 'Traffic Signal',
  });
  assert.deepEqual(codes(bounded), []);
});

test('West and Sessler: a two-inventor patent cannot support a sole-inventor sentence', () => {
  // Case F. US 3,118,022 names both. Centring West is editorial; erasing Sessler is an error.
  const findings = checkAttribution({
    statement: 'James E. West developed the electret microphone.',
    supportingSourceClasses: ['patent_specification'],
    patentTitle: 'Electroacoustic Transducer',
    patentInventorNames: ['James E. West', 'Gerhard M. Sessler'],
    attributesToSinglePerson: true,
  });
  assert.ok(codes(findings).includes('inventor_team_or_coinventor_unresolved'));
  assert.ok(findings.some((f) => f.explanation.includes('Gerhard M. Sessler')));
});

test('West and Sessler: stating co-invention clears the finding', () => {
  const findings = checkAttribution({
    statement:
      'James E. West co-invented electret transducer technology with Gerhard M. Sessler at Bell Laboratories.',
    supportingSourceClasses: ['patent_specification'],
    patentTitle: 'Electroacoustic Transducer',
    patentInventorNames: ['James E. West', 'Gerhard M. Sessler'],
    attributesToSinglePerson: false,
  });
  assert.deepEqual(codes(findings), []);
});

test('Sampson: the gamma-electric cell claim carries a co-inventor and no cell-phone scope', () => {
  // Case G. US 3,591,860 with George H. Miley. The internet myth is cellular telephony.
  const findings = checkAttribution({
    statement: 'Henry T. Sampson invented the cell phone.',
    supportingSourceClasses: ['patent_specification'],
    patentTitle: 'Gamma-Electric Cell',
    patentInventorNames: ['Henry T. Sampson', 'George H. Miley'],
    attributesToSinglePerson: true,
  });
  assert.ok(codes(findings).includes('inventor_team_or_coinventor_unresolved'));
  assert.ok(codes(findings).includes('invention_scope_broader_than_patent'));
});

test('Boone: an ironing-board improvement does not become inventing the ironing board', () => {
  // Case H. US 473,653.
  const findings = checkAttribution({
    statement: 'Sarah Boone invented the ironing board.',
    supportingSourceClasses: ['patent_specification'],
    patentTitle: 'Ironing Board',
  });
  assert.ok(codes(findings).includes('invention_scope_broader_than_patent'));
});

test('Reed: "first Black woman to receive a US patent" is blocked without a source that researched the ordering', () => {
  // Case K. Later research identified earlier Black women patentees.
  const findings = checkAttribution({
    statement: 'Judy W. Reed was the first Black woman to receive a United States patent.',
    supportingSourceClasses: ['patent_specification', 'modern_reputable_secondary'],
    patentTitle: 'Dough Kneader and Roller',
  });
  assert.ok(codes(findings).includes('superlative_without_institutional_support'));
});

test('a superlative backed by scholarship that studied the ordering is allowed', () => {
  // The gate must be satisfiable, or it stops being a gate and becomes a ban.
  const findings = checkAttribution({
    statement: 'Thomas L. Jennings is the first known Black recipient of a United States patent.',
    supportingSourceClasses: ['peer_reviewed_scholarship', 'institutional_biography'],
  });
  assert.equal(codes(findings).includes('superlative_without_institutional_support'), false);
});

test('Case I: a patent proves the inventor and still cannot establish that they were Black', () => {
  // The technical claim stands. The relevance gate stays shut. Race is never inferred.
  const findings = checkCommunityIdentityEvidence(['patent_specification']);
  assert.ok(codes(findings).includes('patent_used_as_racial_identity_evidence'));
  assert.ok(findings[0]?.remediation.includes('Baker'));
});

test('Case I: a Baker-era compilation is what opens that gate', () => {
  assert.deepEqual(checkCommunityIdentityEvidence(['historical_compilation']), []);
  assert.deepEqual(checkCommunityIdentityEvidence(['institutional_biography']), []);
});

test('a bridge alone cannot establish community identity', () => {
  const findings = checkCommunityIdentityEvidence(['wikidata_bridge']);
  assert.ok(codes(findings).includes('patent_used_as_racial_identity_evidence'));
});

test('commercial and societal impact each need their own kind of receipt', () => {
  const findings = checkAttribution({
    statement:
      'The device was widely adopted and changed the world for workers across the industry.',
    supportingSourceClasses: ['patent_specification'],
  });
  assert.ok(codes(findings).includes('unsupported_commercial_impact_claim'));
  assert.ok(codes(findings).includes('unsupported_societal_impact_claim'));

  const supported = checkAttribution({
    statement: 'The machine was widely adopted in Lynn shoe factories within a decade.',
    supportingSourceClasses: ['contemporaneous_trade_press'],
  });
  assert.equal(codes(supported).includes('unsupported_commercial_impact_claim'), false);
});

test('marker detection reads phrases, not substrings', () => {
  // "reinvented" is not "invented"; "the first" is, and "firstly" is not.
  assert.equal(makesBroadAttribution('The company reinvented its process.'), false);
  assert.equal(makesBroadAttribution('She invented a new closure.'), true);
  assert.equal(makesSuperlativeClaim('Firstly, he moved to Boston.'), false);
  assert.equal(makesSuperlativeClaim('He was the first to file.'), true);
});

test('"inventor of" is reported once, not also as "invented"', () => {
  const markers = findAttributionMarkers('He is the inventor of the lasting machine.');
  assert.equal(markers.filter((m) => m.kind === 'broad_attribution').length, 1);
  assert.equal(markers[0]?.term, 'inventor of');
});

test('bounded verbs are recognized as attribution without being flagged as broad', () => {
  const markers = findAttributionMarkers('He co-invented and later commercialized the device.');
  assert.ok(markers.some((m) => m.kind === 'bounded'));
  assert.equal(
    markers.some((m) => m.kind === 'broad_attribution'),
    false,
  );
});

test('patent titles in period drafting style read as bounded', () => {
  assert.ok(patentTitleSuggestsImprovement('Improvement in Lubricators for Steam Engines'));
  assert.ok(patentTitleSuggestsImprovement('Process of Manufacturing Carbons'));
  assert.ok(patentTitleSuggestsImprovement('Method for Kneading Dough'));
  assert.equal(patentTitleSuggestsImprovement('Lasting Machine'), false);
});

test('every broad verb offers a bounded alternative to reach for', () => {
  for (const term of ['invented', 'inventor of', 'originated', 'pioneered', 'revolutionized']) {
    assert.ok(boundedAlternativesFor(term).length > 0, `${term} should suggest bounded wording`);
  }
});

test('high-impact assertions are surfaced from the sentence for the corroboration gate', () => {
  const classes = highImpactAssertionsInText(
    'She was the first to invent it, and it was widely adopted.',
  );
  assert.ok(classes.includes('superlative'));
  assert.ok(classes.includes('invention_attribution'));
  assert.ok(classes.includes('commercial_impact'));
});

test('an ordinary biographical sentence produces no findings', () => {
  // Precision matters as much as recall: a guard that fires on everything gets turned off.
  const findings = checkAttribution({
    statement: 'He was born in Chelsea, Massachusetts, in 1848 and worked as a draftsman.',
    supportingSourceClasses: ['census_or_vital_record'],
  });
  assert.deepEqual(codes(findings), []);
});
