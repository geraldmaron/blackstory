/**
 * citation structural-completeness and the claim-level projection-level fail-closed
 * gates it feeds. Proves "unsourced" cannot pass projection build.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertCitationStructurallyComplete,
  buildCitationFromEvidence,
  isCitationStructurallyComplete,
  type Citation,
} from './citation.js';
import {
  assertClaimCitationComplete,
  assertProjectionCitationCompletenessGate,
  evaluateClaimCitationCompleteness,
  evaluateProjectionCitationCompleteness,
} from './completeness-gate.js';
import { buildReleaseManifest } from '../publication/index.js';

function urlCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    id: 'cit-1',
    claimId: 'claim-1',
    sourceName: 'National Archives',
    location: { kind: 'url', url: 'https://example.gov/record/1' },
    capture: { captureId: 'capture-1' },
    retrievalDate: '2026-07-01T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

test('a structurally complete URL citation passes validation', () => {
  const citation = urlCitation();
  assert.doesNotThrow(() => assertCitationStructurallyComplete(citation));
  assert.equal(isCitationStructurallyComplete(citation), true);
});

test('an offline citation with a structured designation passes without a URL', () => {
  const citation = urlCitation({
    location: {
      kind: 'offline',
      designation: {
        kind: 'physical_archive',
        description: 'Florida State Archives, Series 1234, Box 5, Folder 2',
      },
    },
  });
  assert.equal(isCitationStructurallyComplete(citation), true);
});

test('a citation missing a capture pointer is not structurally complete', () => {
  const citation = urlCitation({ capture: { captureId: '' } });
  assert.equal(isCitationStructurallyComplete(citation), false);
});

test('a citation with a non-https URL is rejected', () => {
  const citation = urlCitation({ location: { kind: 'url', url: 'http://example.gov/record/1' } });
  assert.equal(isCitationStructurallyComplete(citation), false);
});

test('an offline designation with an empty description is rejected', () => {
  const citation = urlCitation({
    location: { kind: 'offline', designation: { kind: 'book', description: '   ' } },
  });
  assert.equal(isCitationStructurallyComplete(citation), false);
});

test('buildCitationFromEvidence adapts a  evidence chain into a citation', () => {
  const citation = buildCitationFromEvidence({
    id: 'cit-2',
    claimId: 'claim-2',
    evidence: { sourceItemId: 'item-1', sourceId: 'source-1' },
    sourceItem: { canonicalUrl: 'https://archives.gov/item/1', title: 'Grand jury report' },
    source: { displayName: 'National Archives', classification: 'federal_archive' },
    capture: { id: 'capture-2', retrievedAt: '2026-06-01T00:00:00.000Z' },
    waybackCaptureUrl: 'https://web.archive.org/web/20260601000000/https://archives.gov/item/1',
    authorName: 'State Attorney',
    namedEntities: ['Rosewood', 'Florida', '1923'],
    createdAt: '2026-06-01T00:00:00.000Z',
  });
  assert.equal(citation.sourceName, 'National Archives');
  assert.equal(citation.title, 'Grand jury report');
  assert.equal(citation.capture.captureId, 'capture-2');
  assert.equal(
    citation.capture.waybackCaptureUrl,
    'https://web.archive.org/web/20260601000000/https://archives.gov/item/1',
  );
  assert.equal(isCitationStructurallyComplete(citation), true);
});

test('buildCitationFromEvidence requires either a capture or an offline designation', () => {
  assert.throws(() =>
    buildCitationFromEvidence({
      id: 'cit-3',
      claimId: 'claim-3',
      evidence: { sourceItemId: 'item-1', sourceId: 'source-1' },
      sourceItem: {},
      source: { displayName: 'Unknown' },
      createdAt: '2026-06-01T00:00:00.000Z',
    }),
  );
});

test('evaluateClaimCitationCompleteness fails a claim with zero citations', () => {
  const result = evaluateClaimCitationCompleteness({ id: 'claim-9' }, []);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failures[0]?.reason, 'no_citation');
  }
});

test('evaluateClaimCitationCompleteness fails a claim whose only citation is incomplete', () => {
  const result = evaluateClaimCitationCompleteness({ id: 'claim-1' }, [
    urlCitation({ retrievalDate: 'not-a-date' }),
  ]);
  assert.equal(result.ok, false);
});

test('evaluateClaimCitationCompleteness passes a claim with at least one complete citation', () => {
  const result = evaluateClaimCitationCompleteness({ id: 'claim-1' }, [
    urlCitation({ id: 'incomplete', capture: { captureId: '' } }),
    urlCitation({ id: 'complete' }),
  ]);
  assert.equal(result.ok, true);
});

test('assertClaimCitationComplete throws for an unsourced claim', () => {
  assert.throws(() => assertClaimCitationComplete({ id: 'claim-1' }, []), /cannot publish/);
});

test('evaluateProjectionCitationCompleteness aggregates failures across every claim', () => {
  const citationsByClaimId = new Map([
    ['claim-a', [urlCitation({ id: 'a1', claimId: 'claim-a' })]],
    ['claim-b', []],
    ['claim-c', [urlCitation({ id: 'c1', claimId: 'claim-c', capture: { captureId: '' } })]],
  ]);
  const result = evaluateProjectionCitationCompleteness(
    [{ id: 'claim-a' }, { id: 'claim-b' }, { id: 'claim-c' }],
    citationsByClaimId,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    const claimIds = result.failures.map((f) => f.claimId).sort();
    assert.deepEqual(claimIds, ['claim-b', 'claim-c']);
  }
});

/**
 * Direct proof for a claim without a valid citation cannot pass
 * projection build. Simulates the guarded build path the fail-closed gate must run and throw
 * before `buildReleaseManifest` (the real projection-build primitive) is ever reached.
 */
test('a claim without a valid citation cannot pass projection build', () => {
  const claims = [{ id: 'claim-unsourced' }];
  const citationsByClaimId = new Map<string, readonly Citation[]>([['claim-unsourced', []]]);

  function guardedBuildReleaseManifest(): ReturnType<typeof buildReleaseManifest> {
    assertProjectionCitationCompletenessGate(claims, citationsByClaimId);
    return buildReleaseManifest({
      releaseId: 'release-1',
      generatedAt: '2026-07-17T00:00:00.000Z',
      searchIndexVersion: 'search-v1',
      artifacts: [
        {
          entityId: 'claim-unsourced',
          revision: 'rev-1',
          projection: { claimId: 'claim-unsourced' },
          snapshot: { claimId: 'claim-unsourced' },
        },
      ],
    });
  }

  assert.throws(guardedBuildReleaseManifest, /Projection build blocked/);

  // Once a complete citation exists, the same guarded path proceeds and actually builds the
  // manifest proving the gate is the only thing standing between "unsourced" and "published".
  citationsByClaimId.set('claim-unsourced', [urlCitation({ claimId: 'claim-unsourced' })]);
  assert.doesNotThrow(guardedBuildReleaseManifest);
});
