/**
 * Internet Archive URL parsing and claim source resolution.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseInternetArchiveUrl,
  resolveInternetArchiveSources,
} from './internet-archive-sources.js';

describe('parseInternetArchiveUrl', () => {
  it('parses archive.org details URLs', () => {
    const parsed = parseInternetArchiveUrl(
      'https://archive.org/details/piedmont-county-directory-1923',
    );
    assert.equal(parsed?.kind, 'details');
    if (parsed?.kind === 'details') {
      assert.equal(parsed.identifier, 'piedmont-county-directory-1923');
    }
  });

  it('parses Wayback capture URLs', () => {
    const parsed = parseInternetArchiveUrl(
      'https://web.archive.org/web/20260101000000/https://example.gov/report',
    );
    assert.equal(parsed?.kind, 'wayback');
    if (parsed?.kind === 'wayback') {
      assert.equal(parsed.originalUrl, 'https://example.gov/report');
    }
  });
});

describe('resolveInternetArchiveSources', () => {
  it('collects distinct IA-backed claim citations', () => {
    const sources = resolveInternetArchiveSources([
      {
        id: 'claim-1',
        citationHref: 'https://archive.org/details/test-item',
        citationLabel: 'County directory, 1923',
        citationSource: 'Internet Archive',
        object: 'Listed in the directory',
      },
      {
        id: 'claim-2',
        citationHref: 'https://web.archive.org/web/20260101000000/https://example.gov/report',
        citationLabel: 'Federal report capture',
        citationSource: 'Wayback Machine',
        object: 'Captured report text',
      },
      {
        id: 'claim-3',
        citationHref: 'https://example.gov/live',
        citationLabel: 'Live page',
        citationSource: 'example.gov',
        object: 'Not archived',
      },
    ]);
    assert.equal(sources.length, 2);
    assert.equal(sources[0]?.kind, 'details');
    assert.equal(sources[1]?.kind, 'wayback');
  });
});
