/**
 * Tests for DOI resolution/comparison. Every HTTP call goes through a mock SafeHttpClient
 * injected by the test, never a real fetch (same discipline as the Wayback adapter tests).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  SafeHttpRequest,
  SafeHttpResponse,
} from '../adapters/internet-archive/shared/http-port.js';
import { checkDoiCitation, normalizeDoi, type StoredCitation } from './doi-resolution.js';

function jsonResponse(body: unknown, status = 200): SafeHttpResponse {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    bodyText: JSON.stringify(body),
    finalUrl: '',
  };
}

const CROSSREF_WORK = {
  message: {
    title: ['The Wages of Whiteness'],
    author: [{ family: 'Roediger', given: 'David' }],
    'container-title': ['Verso Books'],
  },
};

const STORED: StoredCitation = {
  title: 'The Wages of Whiteness',
  firstAuthorSurname: 'Roediger',
  venue: 'Verso Books',
};

test('normalizeDoi strips doi.org URL and doi: prefixes', () => {
  assert.equal(normalizeDoi('https://doi.org/10.1234/abc'), '10.1234/abc');
  assert.equal(normalizeDoi('http://dx.doi.org/10.1234/abc'), '10.1234/abc');
  assert.equal(normalizeDoi('doi:10.1234/abc'), '10.1234/abc');
  assert.equal(normalizeDoi('  10.1234/abc  '), '10.1234/abc');
});

test('an exact Crossref match reports outcome: match', async () => {
  const requests: SafeHttpRequest[] = [];
  const client = async (request: SafeHttpRequest) => {
    requests.push(request);
    return jsonResponse(CROSSREF_WORK);
  };
  const result = await checkDoiCitation(client, '10.1234/abc', STORED);
  assert.equal(result.outcome, 'match');
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, 'https://api.crossref.org/works/10.1234%2Fabc');
});

test('title/punctuation case differences do not count as a mismatch', async () => {
  const client = async () =>
    jsonResponse({
      message: {
        title: ['the WAGES of whiteness!'],
        author: [{ family: 'Roediger' }],
        'container-title': ['Verso Books'],
      },
    });
  const result = await checkDoiCitation(client, '10.1234/abc', STORED);
  assert.equal(result.outcome, 'match');
});

test('a genuinely different title is flagged as a mismatch', async () => {
  const client = async () =>
    jsonResponse({
      message: {
        title: ['A Completely Different Paper'],
        author: [{ family: 'Roediger' }],
        'container-title': ['Verso Books'],
      },
    });
  const result = await checkDoiCitation(client, '10.1234/abc', STORED);
  assert.equal(result.outcome, 'mismatch');
  if (result.outcome === 'mismatch') {
    assert.deepEqual(
      result.mismatches.map((m) => m.field),
      ['title'],
    );
  }
});

test('falls back to OpenAlex when Crossref has no record (404)', async () => {
  const requests: SafeHttpRequest[] = [];
  const client = async (request: SafeHttpRequest) => {
    requests.push(request);
    if (request.url.includes('crossref')) return jsonResponse({}, 404);
    return jsonResponse({
      title: 'The Wages of Whiteness',
      authorships: [{ author: { display_name: 'David Roediger' } }],
      primary_location: { source: { display_name: 'Verso Books' } },
    });
  };
  const result = await checkDoiCitation(client, '10.1234/abc', STORED);
  assert.equal(result.outcome, 'match');
  if (result.outcome === 'match') {
    assert.equal(result.resolved.resolvedVia, 'openalex');
  }
  assert.equal(requests.length, 2);
  assert.match(requests[1]?.url ?? '', /openalex\.org\/works\/doi:10\.1234%2Fabc/);
});

test('a DOI unresolved by both resolvers reports outcome: unresolved with reason not_found', async () => {
  const client = async () => jsonResponse({}, 404);
  const result = await checkDoiCitation(client, '10.9999/nonexistent', STORED);
  assert.equal(result.outcome, 'unresolved');
  if (result.outcome === 'unresolved') {
    assert.equal(result.reason, 'not_found');
  }
});

test('an empty DOI is unresolved without making any HTTP call', async () => {
  let called = false;
  const client = async () => {
    called = true;
    return jsonResponse({}, 404);
  };
  const result = await checkDoiCitation(client, '   ', STORED);
  assert.equal(result.outcome, 'unresolved');
  assert.equal(called, false);
});

test('a transport error surfaces as unresolved, not a thrown exception', async () => {
  const client = async () => {
    throw new Error('network unreachable');
  };
  const result = await checkDoiCitation(client, '10.1234/abc', STORED);
  assert.equal(result.outcome, 'unresolved');
});

test('a resolver 500 status is treated as a lookup failure, not a silent not_found', async () => {
  const client = async () => jsonResponse({}, 500);
  const result = await checkDoiCitation(client, '10.1234/abc', STORED);
  assert.equal(result.outcome, 'unresolved');
  if (result.outcome === 'unresolved') {
    assert.match(result.reason, /500/);
  }
});

test('a missing venue in the resolved record is not itself flagged as a mismatch', async () => {
  const client = async () =>
    jsonResponse({
      message: { title: ['The Wages of Whiteness'], author: [{ family: 'Roediger' }] },
    });
  const result = await checkDoiCitation(client, '10.1234/abc', STORED);
  assert.equal(result.outcome, 'match');
});
