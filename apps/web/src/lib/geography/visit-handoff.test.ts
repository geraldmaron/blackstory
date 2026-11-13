/**
 * Visit block eligibility.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldShowVisitBlock } from './visit-handoff.js';

describe('shouldShowVisitBlock: only a visitable site at site precision', () => {
  const site = {
    displayName: 'Bethel A.M.E. Church',
    locationLabel: '819 West 16th Street, Indianapolis, Indiana',
    locationPrecision: 'site' as const,
    kind: 'place',
    status: 'active',
    lat: 39.79,
    lng: -86.17,
  };

  it('offers a visit for a site-precision place with a stored point', () => {
    assert.equal(shouldShowVisitBlock(site), true);
  });

  it('never offers a visit for an invention, whatever its status or point', () => {
    // The Striking Clock: an 18th-century object with an "active" pipeline status.
    assert.equal(shouldShowVisitBlock({ ...site, kind: 'invention' }), false);
  });

  it('never offers directions below site precision', () => {
    assert.equal(shouldShowVisitBlock({ ...site, locationPrecision: 'city' }), false);
    assert.equal(shouldShowVisitBlock({ ...site, locationPrecision: 'neighborhood' }), false);
  });

  it('needs a stored point and a site the release does not mark private or gone', () => {
    const { lat: _lat, lng: _lng, ...unpinned } = site;
    assert.equal(shouldShowVisitBlock(unpinned), false);
    assert.equal(shouldShowVisitBlock({ ...site, visit: { visitability: 'demolished' } }), false);
    assert.equal(shouldShowVisitBlock({ ...site, visit: { visitability: 'private' } }), false);
  });
});
