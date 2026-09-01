/**
 * Visit handoff URLs and standing copy.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildVisitHandoff, visitStandingLabel } from './visit-handoff.js';

describe('visitStandingLabel', () => {
  it('describes active place-like records', () => {
    assert.equal(visitStandingLabel('school', 'active'), 'Still standing or operating today');
  });

  it('omits standing for people', () => {
    assert.equal(visitStandingLabel('person', 'living'), undefined);
  });
});

describe('buildVisitHandoff', () => {
  it('builds search and directions URLs with a readable address query', () => {
    const visit = buildVisitHandoff({
      displayName: 'Bethel A.M.E. Church',
      locationLabel: '819 West 16th Street, Indianapolis, Indiana',
      jurisdictionLabel: 'Indianapolis, Indiana',
      locationPrecision: 'institution',
      kind: 'institution',
      status: 'active',
      lat: 39.788,
      lng: -86.174,
    });
    assert.equal(visit.addressLine, '819 West 16th Street, Indianapolis, Indiana');
    assert.match(visit.mapsSearchHref ?? '', /819%20West%2016th/);
    assert.match(visit.mapsSearchHref ?? '', /39\.788/);
    assert.match(visit.mapsDirectionsHref ?? '', /\/dir\//);
    assert.equal(visit.visitStanding, 'Still standing or operating today');
  });

  it('includes institution visit contact from sourced claims', () => {
    const visit = buildVisitHandoff({
      displayName: 'Example Museum',
      locationLabel: '100 Museum Drive, Washington, D.C.',
      jurisdictionLabel: 'Washington, D.C.',
      locationPrecision: 'institution',
      kind: 'institution',
      status: 'active',
      claims: [
        {
          id: 'claim-site',
          predicate: 'officialWebsite',
          object: 'https://museum.example.org',
          citationLabel: 'Museum visitor page',
        },
      ],
    });
    assert.equal(visit.contact?.website?.value, 'https://museum.example.org');
  });
});
