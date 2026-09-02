import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyNrhpAddressOutcome,
  classifyVisitability,
  NRHP_ADDRESS_TIER_TABLE,
  parseSrcAccuMeters,
  proposeNrhpTier,
  type NrhpArcgisAttributes,
} from './nrhp-address-classify.ts';

function feature(overrides: Partial<NrhpArcgisAttributes> = {}): NrhpArcgisAttributes {
  return {
    refnum: '71000836',
    resname: 'Example Site',
    address: null,
    city: 'Example City',
    county: 'Example County',
    state: 'Example State',
    vicinity: null,
    isExtant: null,
    extantOther: null,
    constraint: null,
    srcAccu: null,
    mapMethod: null,
    boundaryType: null,
    resType: null,
    lat: null,
    lng: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------------------------
// parseSrcAccuMeters
// ---------------------------------------------------------------------------------------------

test('parseSrcAccuMeters reads the leading integer out of "+/- 12 meters"', () => {
  assert.equal(parseSrcAccuMeters('+/- 12 meters'), 12);
});

test('parseSrcAccuMeters reads a decimal accuracy value', () => {
  assert.equal(parseSrcAccuMeters('4.5 meters'), 4.5);
});

test('parseSrcAccuMeters returns null for text with no number', () => {
  assert.equal(parseSrcAccuMeters('unknown'), null);
});

test('parseSrcAccuMeters returns null for null/undefined input', () => {
  assert.equal(parseSrcAccuMeters(null), null);
  assert.equal(parseSrcAccuMeters(undefined), null);
});

test('parseSrcAccuMeters converts a foot-denominated RMSE to meters', () => {
  assert.equal(parseSrcAccuMeters('0.5-foot RMSE'), 0.5 * 0.3048);
});

test('parseSrcAccuMeters treats a bare "5m" as 5 meters, not 5 feet', () => {
  assert.equal(parseSrcAccuMeters('5m'), 5);
});

// ---------------------------------------------------------------------------------------------
// classifyVisitability
// ---------------------------------------------------------------------------------------------

test('classifyVisitability maps Yes/No to extant/not_extant, everything else to unknown', () => {
  assert.equal(classifyVisitability('Yes'), 'extant');
  assert.equal(classifyVisitability('No'), 'not_extant');
  assert.equal(classifyVisitability('Unknown'), 'unknown');
  assert.equal(classifyVisitability(null), 'unknown');
  assert.equal(classifyVisitability(undefined), 'unknown');
});

// ---------------------------------------------------------------------------------------------
// classifyNrhpAddressOutcome
// ---------------------------------------------------------------------------------------------

test('classifyNrhpAddressOutcome: restricted always wins, even with a full address on the layer', () => {
  const outcome = classifyNrhpAddressOutcome({
    restrictedAddress: true,
    feature: feature({ address: '123 Main St', vicinity: 'False', lat: 1, lng: 2 }),
  });
  assert.equal(outcome, 'restricted');
});

test('classifyNrhpAddressOutcome: no_match when the refnum has no layer feature', () => {
  assert.equal(classifyNrhpAddressOutcome({ restrictedAddress: false, feature: null }), 'no_match');
});

test('classifyNrhpAddressOutcome: address_found when Address is set and Vicinity is False', () => {
  const outcome = classifyNrhpAddressOutcome({
    restrictedAddress: false,
    feature: feature({ address: '123 Main St', vicinity: 'False' }),
  });
  assert.equal(outcome, 'address_found');
});

test('classifyNrhpAddressOutcome: vicinity when Vicinity is True, even with Address text present', () => {
  const outcome = classifyNrhpAddressOutcome({
    restrictedAddress: false,
    feature: feature({ address: '5th Ave., Denny Way, and Cedar St.', vicinity: 'True' }),
  });
  assert.equal(outcome, 'vicinity');
});

test('classifyNrhpAddressOutcome: coordinates_only when there is geometry but no address/vicinity text', () => {
  const outcome = classifyNrhpAddressOutcome({
    restrictedAddress: false,
    feature: feature({ address: null, vicinity: null, lat: 39.1, lng: -84.5 }),
  });
  assert.equal(outcome, 'coordinates_only');
});

test('classifyNrhpAddressOutcome: no_match when the layer feature has neither address nor geometry', () => {
  const outcome = classifyNrhpAddressOutcome({
    restrictedAddress: false,
    feature: feature({ address: null, vicinity: null, lat: null, lng: null }),
  });
  assert.equal(outcome, 'no_match');
});

// ---------------------------------------------------------------------------------------------
// proposeNrhpTier
// ---------------------------------------------------------------------------------------------

test('proposeNrhpTier: restricted keeps the current tier and flags nps_restricted_address', () => {
  const proposal = proposeNrhpTier('restricted', null, 'county');
  assert.equal(proposal.tier, 'county');
  assert.equal(proposal.flagged, true);
  assert.equal(proposal.flagReason, 'nps_restricted_address');
});

test('proposeNrhpTier: address_found proposes the tier table site tier', () => {
  const proposal = proposeNrhpTier('address_found', null, null);
  assert.equal(proposal.tier, NRHP_ADDRESS_TIER_TABLE.addressFound);
  assert.equal(proposal.flagged, false);
});

test('proposeNrhpTier: vicinity proposes the tier table city tier', () => {
  const proposal = proposeNrhpTier('vicinity', null, null);
  assert.equal(proposal.tier, NRHP_ADDRESS_TIER_TABLE.vicinity);
});

test('proposeNrhpTier: coordinates_only within the accuracy threshold proposes site', () => {
  const proposal = proposeNrhpTier('coordinates_only', 12, null);
  assert.equal(proposal.tier, NRHP_ADDRESS_TIER_TABLE.coordinatesOnlyWithinThreshold);
});

test('proposeNrhpTier: coordinates_only beyond the accuracy threshold proposes neighborhood', () => {
  const proposal = proposeNrhpTier('coordinates_only', 500, null);
  assert.equal(proposal.tier, NRHP_ADDRESS_TIER_TABLE.coordinatesOnlyBeyondThreshold);
});

test('proposeNrhpTier: coordinates_only with unknown accuracy is treated as beyond threshold', () => {
  const proposal = proposeNrhpTier('coordinates_only', null, null);
  assert.equal(proposal.tier, NRHP_ADDRESS_TIER_TABLE.coordinatesOnlyBeyondThreshold);
});

test('proposeNrhpTier: coordinates_only exactly at the threshold counts as within it', () => {
  const proposal = proposeNrhpTier(
    'coordinates_only',
    NRHP_ADDRESS_TIER_TABLE.coordinatesOnlyAccuracyThresholdMeters,
    null,
  );
  assert.equal(proposal.tier, NRHP_ADDRESS_TIER_TABLE.coordinatesOnlyWithinThreshold);
});

test('proposeNrhpTier: no_match proposes no tier and is not flagged', () => {
  const proposal = proposeNrhpTier('no_match', null, null);
  assert.equal(proposal.tier, null);
  assert.equal(proposal.flagged, false);
});
