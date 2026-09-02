/**
 * Visit handoff URLs and standing copy.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildVisitHandoff,
  buildVisitHandoffFromMapFeature,
  visitStandingLabel,
} from './visit-handoff.js';

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
    assert.match(
      visit.appleMapsSearchHref ?? '',
      /^https:\/\/maps\.apple\.com\/\?q=819\+West\+16th/,
    );
    assert.match(visit.appleMapsSearchHref ?? '', /ll=39\.788%2C-86\.174/);
    assert.match(visit.appleMapsDirectionsHref ?? '', /daddr=819\+West\+16th/);
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
        {
          id: 'claim-phone',
          predicate: 'visitorPhone',
          object: '(202) 555-0100',
          citationLabel: 'Museum visitor page',
        },
      ],
    });
    assert.equal(visit.contact?.website?.value, 'https://museum.example.org');
    assert.equal(visit.contact?.phone?.value, '(202) 555-0100');
  });

  it('builds map-feature visit input with jurisdiction and contact claims', () => {
    const visit = buildVisitHandoff(
      buildVisitHandoffFromMapFeature({
        displayName: 'Example Museum',
        locationLabel: '100 Museum Drive',
        jurisdictionLabel: 'Washington, D.C.',
        locationPrecision: 'institution',
        kind: 'institution',
        status: 'active',
        lat: 38.89,
        lng: -77.02,
        claims: [
          {
            id: 'claim-phone',
            predicate: 'visitorPhone',
            object: '(202) 555-0100',
            citationLabel: 'Museum visitor page',
          },
        ],
      }),
    );
    assert.equal(visit.addressLine, '100 Museum Drive, Washington, D.C.');
    assert.equal(visit.contact?.phone?.value, '(202) 555-0100');
  });
});
