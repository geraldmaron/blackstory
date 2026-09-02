/**
 * External maps URL builder — readable place string anchored by coordinates when both exist.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildExternalMapsDirectionsUrl,
  buildExternalMapsSearchUrl,
  buildMapsHandoffQuery,
  externalMapsDirectionsLabel,
  externalMapsLinkLabel,
} from './external-maps-url.js';

describe('buildMapsHandoffQuery', () => {
  it('combines prose and coordinates when both are present', () => {
    assert.equal(
      buildMapsHandoffQuery({
        lat: 38.9072,
        lng: -77.0369,
        query: 'Washington, D.C.',
      }),
      'Washington, D.C. @ 38.9072,-77.0369',
    );
  });

  it('falls back to coordinates alone', () => {
    assert.equal(buildMapsHandoffQuery({ lat: 38.9072, lng: -77.0369 }), '38.9072,-77.0369');
  });
});

describe('buildExternalMapsSearchUrl', () => {
  it('uses the combined handoff query in the search URL', () => {
    const url = buildExternalMapsSearchUrl({
      lat: 38.9072,
      lng: -77.0369,
      query: 'Washington, D.C.',
    });
    assert.match(url ?? '', /Washington/);
    assert.match(url ?? '', /38\.9072/);
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

describe('buildExternalMapsDirectionsUrl', () => {
  it('targets the same combined destination string', () => {
    const url = buildExternalMapsDirectionsUrl({
      lat: 37.021,
      lng: -98.485,
      query: 'Kiowa, Kansas',
    });
    assert.match(url ?? '', /\/dir\//);
    assert.match(url ?? '', /Kiowa/);
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

describe('externalMapsDirectionsLabel', () => {
  it('names the directions action for screen readers', () => {
    assert.equal(externalMapsDirectionsLabel('Kiowa, Kansas'), 'Get directions to Kiowa, Kansas');
  });
});
