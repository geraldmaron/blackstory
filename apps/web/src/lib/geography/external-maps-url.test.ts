/**
 * External maps URL builder — readable place string anchored by coordinates when both exist.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAppleMapsDirectionsUrl,
  buildAppleMapsSearchUrl,
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

describe('buildAppleMapsSearchUrl', () => {
  it('sends the prose destination as q and anchors it with ll', () => {
    const url = buildAppleMapsSearchUrl({
      lat: 39.788,
      lng: -86.164,
      query: '819 West 16th Street, Indianapolis, IN',
    });
    assert.equal(
      url,
      'https://maps.apple.com/?q=819+West+16th+Street%2C+Indianapolis%2C+IN&ll=39.788%2C-86.164',
    );
  });

  it('falls back to coordinates alone and to undefined when nothing is usable', () => {
    assert.equal(
      buildAppleMapsSearchUrl({ lat: 39.788, lng: -86.164 }),
      'https://maps.apple.com/?ll=39.788%2C-86.164',
    );
    assert.equal(buildAppleMapsSearchUrl({ query: '   ' }), undefined);
  });
});

describe('buildAppleMapsDirectionsUrl', () => {
  it('routes to the address, disambiguated by ll, driving', () => {
    const url = buildAppleMapsDirectionsUrl({
      lat: 39.788,
      lng: -86.164,
      query: '819 West 16th Street, Indianapolis, IN',
    });
    assert.equal(
      url,
      'https://maps.apple.com/?daddr=819+West+16th+Street%2C+Indianapolis%2C+IN&ll=39.788%2C-86.164&dirflg=d',
    );
  });

  it('routes to the point when there is no prose destination', () => {
    assert.equal(
      buildAppleMapsDirectionsUrl({ lat: 39.788, lng: -86.164 }),
      'https://maps.apple.com/?daddr=39.788%2C-86.164&dirflg=d',
    );
  });
});
