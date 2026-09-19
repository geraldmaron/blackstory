/**
 * Tests for capture-completeness ops bar: web-citation denominator, archived-capture detection,
 * ratio/meetsBar/missing aggregation, and offline-citation exclusion.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAPTURE_COMPLETENESS_BAR_RATIO,
  CAPTURE_COMPLETENESS_OPS_BAR_VERSION,
} from './constants.js';
import {
  captureCompletenessOpsBarVersion,
  evaluateCaptureCompleteness,
  isWebCitationForCaptureCompleteness,
  webCitationHasArchivedCapture,
  type CitationForCaptureCompleteness,
} from './evaluator.js';

const WAYBACK = 'https://web.archive.org/web/20260101000000/https://example.gov/record/1';

function webCitation(
  citationId: string,
  overrides: Partial<CitationForCaptureCompleteness> = {},
): CitationForCaptureCompleteness {
  return {
    citationId,
    location: { kind: 'url', url: 'https://example.gov/record/1' },
    capture: {
      captureId: `cap-${citationId}`,
      waybackCaptureUrl: WAYBACK,
      waybackCapturedAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

function offlineCitation(citationId: string): CitationForCaptureCompleteness {
  return {
    citationId,
    location: {
      kind: 'offline',
      designation: {
        kind: 'physical_archive',
        description: 'Florida State Archives, Series 1234, Box 5',
      },
    },
    capture: { captureId: `cap-${citationId}` },
  };
}

test('constants expose a named ops bar ratio and version token', () => {
  assert.equal(CAPTURE_COMPLETENESS_BAR_RATIO, 0.95);
  assert.equal(captureCompletenessOpsBarVersion(), CAPTURE_COMPLETENESS_OPS_BAR_VERSION);
});

test('isWebCitationForCaptureCompleteness distinguishes url vs offline locations', () => {
  assert.equal(isWebCitationForCaptureCompleteness(webCitation('a')), true);
  assert.equal(isWebCitationForCaptureCompleteness(offlineCitation('b')), false);
});

test('webCitationHasArchivedCapture accepts a valid Wayback pointer', () => {
  assert.equal(webCitationHasArchivedCapture(webCitation('a')), true);
});

test('webCitationHasArchivedCapture rejects hash-only metadata without recoverable content', () => {
  const citation = webCitation('hash-only', {
    capture: {
      captureId: 'cap-hash-only',
      contentHash: { algorithm: 'sha256', digest: 'a'.repeat(64) },
    },
  });
  assert.equal(webCitationHasArchivedCapture(citation), false);
});

test('webCitationHasArchivedCapture rejects an archive URL without a completion timestamp', () => {
  const citation = webCitation('url-only', {
    capture: {
      captureId: 'cap-url-only',
      waybackCaptureUrl: WAYBACK,
    },
  });
  assert.equal(webCitationHasArchivedCapture(citation), false);
});

test('webCitationHasArchivedCapture rejects bare captureId without archive evidence', () => {
  const citation = webCitation('bare', {
    capture: { captureId: 'cap-bare' },
  });
  assert.equal(webCitationHasArchivedCapture(citation), false);
});

test('webCitationHasArchivedCapture rejects non-archive https URLs', () => {
  const citation = webCitation('fake', {
    capture: {
      captureId: 'cap-fake',
      waybackCaptureUrl: 'https://example.com/not-wayback',
    },
  });
  assert.equal(webCitationHasArchivedCapture(citation), false);
});

test('webCitationHasArchivedCapture requires the archive pointer to name the cited URL', () => {
  const citation = webCitation('wrong-source', {
    capture: {
      captureId: 'cap-wrong-source',
      waybackCaptureUrl: 'https://web.archive.org/web/20260101000000/https://example.gov/other',
      waybackCapturedAt: '2026-01-01T00:00:00.000Z',
    },
  });
  assert.equal(webCitationHasArchivedCapture(citation), false);
});

test('webCitationHasArchivedCapture requires timestamp to match the archive pointer', () => {
  const citation = webCitation('wrong-time', {
    capture: {
      captureId: 'cap-wrong-time',
      waybackCaptureUrl: WAYBACK,
      waybackCapturedAt: '2026-01-02T00:00:00.000Z',
    },
  });
  assert.equal(webCitationHasArchivedCapture(citation), false);
});

test('webCitationHasArchivedCapture rejects a bare archive host', () => {
  const citation = webCitation('bare-host', {
    capture: {
      captureId: 'cap-bare-host',
      waybackCaptureUrl: 'https://web.archive.org',
      waybackCapturedAt: '2026-01-01T00:00:00.000Z',
    },
  });
  assert.equal(webCitationHasArchivedCapture(citation), false);
});

test('evaluateCaptureCompleteness returns ratio 1 when no web citations exist', () => {
  const result = evaluateCaptureCompleteness([offlineCitation('off-1')]);
  assert.equal(result.ratio, 1);
  assert.equal(result.meetsBar, true);
  assert.deepEqual(result.missing, []);
});

test('evaluateCaptureCompleteness meets bar when all web citations are captured', () => {
  const result = evaluateCaptureCompleteness([
    webCitation('a'),
    webCitation('b'),
    offlineCitation('off-1'),
  ]);
  assert.equal(result.ratio, 1);
  assert.equal(result.meetsBar, true);
  assert.deepEqual(result.missing, []);
});

test('evaluateCaptureCompleteness lists missing web citation ids and computes ratio', () => {
  const result = evaluateCaptureCompleteness([
    webCitation('captured'),
    webCitation('missing', { capture: { captureId: 'cap-missing' } }),
    webCitation('also-missing', { capture: { captureId: 'cap-also' } }),
  ]);
  assert.equal(result.ratio, 1 / 3);
  assert.equal(result.meetsBar, false);
  assert.deepEqual(result.missing, ['also-missing', 'missing']);
});

test('evaluateCaptureCompleteness meets a custom barRatio override', () => {
  const result = evaluateCaptureCompleteness(
    [webCitation('captured'), webCitation('missing', { capture: { captureId: 'cap-missing' } })],
    { barRatio: 0.5 },
  );
  assert.equal(result.ratio, 0.5);
  assert.equal(result.meetsBar, true);
  assert.deepEqual(result.missing, ['missing']);
});

test('evaluateCaptureCompleteness rejects invalid barRatio', () => {
  assert.throws(
    () => evaluateCaptureCompleteness([webCitation('a')], { barRatio: 1.5 }),
    /barRatio must be a finite number between 0 and 1/,
  );
});

test('evaluateCaptureCompleteness on empty input is vacuously complete', () => {
  const result = evaluateCaptureCompleteness([]);
  assert.equal(result.ratio, 1);
  assert.equal(result.meetsBar, true);
  assert.deepEqual(result.missing, []);
});
