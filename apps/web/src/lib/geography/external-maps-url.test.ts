/**
 * External maps URL builder — coordinates preferred over prose query.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildExternalMapsSearchUrl, externalMapsLinkLabel } from './external-maps-url.js';

describe('buildExternalMapsSearchUrl', () => {
  it('prefers lat/lng over a prose query', () => {
    const url = buildExternalMapsSearchUrl({
      lat: 38.9072,
      lng: -77.0369,
      query: 'Washington, D.C.',
    });
    assert.equal(url, 'https://www.google.com/maps/search/?api=1&query=38.9072%2C-77.0369');
  });

  it('falls back to an encoded query when coordinates are absent', () => {
    const url = buildExternalMapsSearchUrl({ query: 'Indianapolis, IN' });
    assert.equal(url, 'https://www.google.com/maps/search/?api=1&query=Indianapolis%2C%20IN');
  });

  it('returns undefined for empty input', () => {
    assert.equal(buildExternalMapsSearchUrl({}), undefined);
    assert.equal(buildExternalMapsSearchUrl({ query: '   ' }), undefined);
  });
});

describe('externalMapsLinkLabel', () => {
  it('names the destination for screen readers', () => {
    assert.equal(
      externalMapsLinkLabel('Bethel A.M.E. Church, Indianapolis'),
      'Open Bethel A.M.E. Church, Indianapolis in maps',
    );
  });
});
