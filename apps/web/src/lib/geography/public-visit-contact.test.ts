/**
 * Public visit contact policy and claim resolution.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canPublishPublicVisitContact, resolvePublicVisitContact } from './public-visit-contact.js';

const institutionClaims = [
  {
    id: 'claim-site',
    predicate: 'officialWebsite',
    object: 'https://museum.example.org',
    citationLabel: 'Museum visitor page',
  },
  {
    id: 'claim-phone',
    predicate: 'visitorPhone',
    object: '(202) 555-0100',
    citationLabel: 'Museum visitor page',
  },
  {
    id: 'claim-hours',
    predicate: 'publicHours',
    object: 'Tuesday through Saturday, 10 a.m. to 5 p.m.',
    citationLabel: 'Museum visitor page',
  },
] as const;

describe('canPublishPublicVisitContact', () => {
  it('allows institution records at campus or institution precision', () => {
    assert.equal(
      canPublishPublicVisitContact({
        kind: 'institution',
        locationPrecision: 'institution',
        claims: [],
      }),
      true,
    );
  });

  it('blocks city precision and person-kind records', () => {
    assert.equal(
      canPublishPublicVisitContact({
        kind: 'institution',
        locationPrecision: 'city',
        claims: [],
      }),
      false,
    );
    assert.equal(
      canPublishPublicVisitContact({
        kind: 'person',
        locationPrecision: 'institution',
        livingStatus: 'living',
        claims: [],
      }),
      false,
    );
  });
});

describe('resolvePublicVisitContact', () => {
  it('returns sourced website, phone, and hours for eligible institutions', () => {
    const contact = resolvePublicVisitContact({
      kind: 'institution',
      locationPrecision: 'institution',
      claims: [...institutionClaims],
    });
    assert.equal(contact?.website?.value, 'https://museum.example.org');
    assert.equal(contact?.phone?.value, '(202) 555-0100');
    assert.match(contact?.hours?.value ?? '', /Tuesday through Saturday/);
  });

  it('omits contact for living people even when claims exist', () => {
    assert.equal(
      resolvePublicVisitContact({
        kind: 'person',
        locationPrecision: 'institution',
        livingStatus: 'living',
        claims: [...institutionClaims],
      }),
      undefined,
    );
  });
});
