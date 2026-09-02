/**
 * Unit tests for `publicVisitForTier`: the pure gate deciding which visit-contact fields a
 * public projection may carry, given location precision tier, entity kind, and living status.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicVisitForTier, type PublicVisit } from './visit.js';

const FULL_VISIT: PublicVisit = {
  address: {
    street: '1530 6th Avenue North',
    city: 'Birmingham',
    state: 'AL',
    postalCode: '35203',
    line: '1530 6th Avenue North, Birmingham, AL 35203',
  },
  phone: { e164: '+12053281000', display: '(205) 328-1000' },
  website: 'https://example.org',
  hours: 'Tue–Sat 10am–5pm',
  visitability: 'open_to_public',
  sources: ['claim-1', 'claim-2'],
};

test('publicVisitForTier: undefined visit stays undefined', () => {
  assert.equal(publicVisitForTier(undefined, 'site', 'place', 'deceased'), undefined);
});

test('publicVisitForTier: street/line emitted at site tier for eligible place', () => {
  const result = publicVisitForTier(FULL_VISIT, 'site', 'place', 'deceased');
  assert.ok(result);
  assert.equal(result?.address?.street, '1530 6th Avenue North');
  assert.equal(result?.address?.line, FULL_VISIT.address?.line);
  assert.equal(result?.address?.city, 'Birmingham');
});

test('publicVisitForTier: street/line emitted at address tier', () => {
  const result = publicVisitForTier(FULL_VISIT, 'address', 'institution', 'not_applicable');
  assert.ok(result);
  assert.equal(result?.address?.street, '1530 6th Avenue North');
  assert.equal(result?.address?.line, FULL_VISIT.address?.line);
});

test('publicVisitForTier: street/line omitted at coarser tiers', () => {
  for (const tier of ['locality', 'county', 'state', 'campus', 'institution', 'city']) {
    const result = publicVisitForTier(FULL_VISIT, tier, 'place', 'deceased');
    assert.equal(result?.address?.street, undefined, `tier ${tier} should omit street`);
    assert.equal(result?.address?.line, undefined, `tier ${tier} should omit line`);
    // city/state/postalCode still carry through — jurisdiction-level geography is already public.
    assert.equal(result?.address?.city, 'Birmingham');
    assert.equal(result?.address?.postalCode, '35203');
  }
});

test('publicVisitForTier: phone/website only for eligible kinds', () => {
  for (const kind of ['place', 'institution', 'school', 'organization']) {
    const result = publicVisitForTier(FULL_VISIT, 'site', kind, 'deceased');
    assert.ok(result?.phone, `kind ${kind} should carry phone`);
    assert.equal(result?.website, 'https://example.org');
  }
  for (const kind of ['person', 'event', 'law', 'case', 'publication', 'artifact', 'movement']) {
    const result = publicVisitForTier(FULL_VISIT, 'site', kind, 'deceased');
    assert.equal(result?.phone, undefined, `kind ${kind} should omit phone`);
    assert.equal(result?.website, undefined, `kind ${kind} should omit website`);
  }
});

test('publicVisitForTier: phone/website omitted when livingStatus is living', () => {
  const result = publicVisitForTier(FULL_VISIT, 'site', 'place', 'living');
  assert.equal(result?.phone, undefined);
  assert.equal(result?.website, undefined);
  // Address and hours are unaffected by living status.
  assert.equal(result?.address?.street, '1530 6th Avenue North');
  assert.equal(result?.hours, FULL_VISIT.hours);
});

test('publicVisitForTier: phone/website omitted when visitability disqualifies', () => {
  for (const visitability of ['private', 'demolished'] as const) {
    const result = publicVisitForTier({ ...FULL_VISIT, visitability }, 'site', 'place', 'deceased');
    assert.equal(result?.phone, undefined, `visitability ${visitability} should omit phone`);
    assert.equal(result?.website, undefined, `visitability ${visitability} should omit website`);
  }
});

test('publicVisitForTier: phone/website kept when visitability is absent or unknown', () => {
  // An official website or phone is publishable for a place-like record unless the place is
  // positively private or gone; unknown visitability is the common case for a live institution.
  const { visitability: _visitability, ...withoutVisitability } = FULL_VISIT;
  for (const visit of [withoutVisitability, { ...FULL_VISIT, visitability: 'unknown' as const }]) {
    const result = publicVisitForTier(visit, 'site', 'place', 'deceased');
    assert.deepEqual(result?.phone, FULL_VISIT.phone);
    assert.equal(result?.website, FULL_VISIT.website);
  }
});

test('publicVisitForTier: hours/visitability/sources pass through regardless of tier/kind', () => {
  const result = publicVisitForTier(FULL_VISIT, 'state', 'person', 'living');
  assert.equal(result?.hours, FULL_VISIT.hours);
  assert.equal(result?.visitability, 'open_to_public');
  assert.deepEqual(result?.sources, ['claim-1', 'claim-2']);
});

test('publicVisitForTier: returns undefined when nothing survives filtering', () => {
  const minimal: PublicVisit = {
    address: { street: '123 Main St' },
  };
  const result = publicVisitForTier(minimal, 'city', 'person', 'living');
  assert.equal(result, undefined);
});

test('publicVisitForTier: exterior_only counts as contact-eligible', () => {
  const result = publicVisitForTier(
    { ...FULL_VISIT, visitability: 'exterior_only' },
    'site',
    'school',
    'not_applicable',
  );
  assert.ok(result?.phone);
  assert.equal(result?.website, 'https://example.org');
});
