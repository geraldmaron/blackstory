/**
 * Tests deterministic claim extraction, evidence registration, and rejection gates.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ClaimEvidenceLink } from './claims/index.js';
import {
  assessAtomicity,
  createManualClaimEntry,
  evaluateClaimExtraction,
  parseClaimLines,
  registerEvidenceSpan,
  type ClaimDraft,
  type ExtractionUncertainty,
} from './extraction/index.js';
import type { EvidenceRecord } from './provenance/index.js';

const NOW = '2026-07-17T04:30:00.000Z';
const EXCERPT = 'The school opened in 1961 in Atlanta.';

function evidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: 'ev-1',
    sourceItemId: 'item-1',
    sourceId: 'source-1',
    locator: { page: '12', paragraph: '3' },
    excerpt: EXCERPT,
    excerptKind: 'short',
    rightsStatus: 'public_domain',
    publicationPermissions: ['cite', 'short_excerpt'],
    prohibitedUses: [],
    lineageRootId: 'ev-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function draft(overrides: Partial<ClaimDraft> = {}): ClaimDraft {
  return {
    claimId: 'claim-1',
    claimVersionId: 'claim-version-1',
    entityId: 'school-1',
    predicate: 'opened in',
    object: '1961',
    claimClass: 'standard',
    proceduralStatus: 'unknown_procedural',
    temporal: { validFrom: '1961-01-01', validTo: '1961-12-31' },
    geographic: { locationId: 'atlanta', precision: 'city' },
    atomicity: assessAtomicity('opened in', '1961'),
    ...overrides,
  };
}

function link(
  overrides: Partial<ClaimEvidenceLink> = {},
): ClaimEvidenceLink {
  return {
    id: 'link-1',
    claimId: 'claim-1',
    claimVersionId: 'claim-version-1',
    evidenceId: 'ev-1',
    role: 'supporting',
    lineageRootId: 'ev-1',
    credible: true,
    sourceClassification: 'government_record',
    directness: 1,
    temporalProximity: 1,
    geographicPrecision: 1,
    entityMatchQuality: 1,
    extractionQuality: 1,
    assertedValue: '1961',
    createdAt: NOW,
    ...overrides,
  };
}

function registeredSpan() {
  const start = EXCERPT.indexOf('opened in 1961');
  return registerEvidenceSpan({
    id: 'span-1',
    evidence: evidence(),
    offsetStart: start,
    offsetEnd: start + 'opened in 1961'.length,
    exactQuotation: true,
    quotation: 'opened in 1961',
  });
}

test('line parser is deterministic and records atomicity uncertainty', () => {
  const source = '# claims\nschool-1 | opened in | 1961\nschool-2 | served Atlanta and Birmingham | 1962';
  assert.deepEqual(parseClaimLines(source), parseClaimLines(source));
  const parsed = parseClaimLines(source);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.draft.object, '1961');
  assert.equal(parsed[1]?.uncertainties[0]?.code, 'atomicity');
});

test('manual entry preserves extraction uncertainty', () => {
  const uncertainties: ExtractionUncertainty[] = [
    { code: 'temporal', detail: 'Month is not stated.', recordedBy: 'researcher' },
  ];
  const entry = createManualClaimEntry({
    id: 'manual-1',
    extractedAt: NOW,
    extractedBy: 'researcher-1',
    draft: draft(),
    uncertainties,
  });
  assert.deepEqual(entry.uncertainties, uncertainties);
});

test('exact quotations require exact text and source location', () => {
  const start = EXCERPT.indexOf('opened in 1961');
  const { locator: _locator, ...evidenceWithoutLocator } = evidence();
  assert.throws(
    () =>
      registerEvidenceSpan({
        id: 'span-bad-quote',
        evidence: evidence(),
        offsetStart: start,
        offsetEnd: start + 'opened in 1961'.length,
        exactQuotation: true,
        quotation: 'opened in 1962',
      }),
    /does not match/,
  );
  assert.throws(
    () =>
      registerEvidenceSpan({
        id: 'span-no-location',
        evidence: evidenceWithoutLocator,
        offsetStart: start,
        offsetEnd: start + 'opened in 1961'.length,
        exactQuotation: true,
        quotation: 'opened in 1961',
      }),
    /exact source locator/,
  );
});

test('supported atomic claim is accepted with registered evidence', () => {
  const record = evaluateClaimExtraction({
    id: 'extraction-1',
    method: 'deterministic',
    draft: draft(),
    evidenceSpans: [registeredSpan()],
    evidenceLinks: [link()],
    uncertainties: [],
    extractedAt: NOW,
    extractedBy: 'parser-v1',
  });
  assert.equal(record.decision, 'accepted');
  assert.equal(record.workflowStatus, 'accepted');
  assert.deepEqual(record.rejectionReasons, []);
});

test('unsupported claim is rejected and missing context remains explicit', () => {
  const { temporal: _temporal, geographic: _geographic, ...draftWithoutContext } = draft();
  const record = evaluateClaimExtraction({
    id: 'extraction-unsupported',
    method: 'manual',
    draft: draftWithoutContext,
    evidenceSpans: [],
    evidenceLinks: [],
    uncertainties: [],
    extractedAt: NOW,
    extractedBy: 'researcher-1',
  });
  assert.equal(record.decision, 'rejected');
  assert.ok(record.rejectionReasons.some((reason) => reason.includes('qualifying')));
  assert.ok(record.uncertainties.some((entry) => entry.code === 'temporal'));
  assert.ok(record.uncertainties.some((entry) => entry.code === 'geographic'));
  assert.ok(record.uncertainties.some((entry) => entry.code === 'evidence'));
});

test('supporting evidence for a different asserted value does not qualify', () => {
  const record = evaluateClaimExtraction({
    id: 'extraction-value-mismatch',
    method: 'manual',
    draft: draft(),
    evidenceSpans: [registeredSpan()],
    evidenceLinks: [link({ assertedValue: '1962' })],
    uncertainties: [],
    extractedAt: NOW,
    extractedBy: 'researcher-1',
  });
  assert.equal(record.decision, 'rejected');
  assert.ok(record.rejectionReasons.some((reason) => reason.includes('qualifying')));
});

test('multi-assertion and unsupported procedural language are rejected', () => {
  const multi = evaluateClaimExtraction({
    id: 'extraction-multi',
    method: 'deterministic',
    draft: draft({
      predicate: 'opened and relocated',
      object: '1961',
      atomicity: assessAtomicity('opened and relocated', '1961'),
    }),
    evidenceSpans: [registeredSpan()],
    evidenceLinks: [link()],
    uncertainties: [],
    extractedAt: NOW,
    extractedBy: 'parser-v1',
  });
  assert.equal(multi.decision, 'rejected');
  assert.match(multi.rejectionReasons[0] ?? '', /one independently supportable assertion/);

  const procedural = evaluateClaimExtraction({
    id: 'extraction-procedural',
    method: 'manual',
    draft: draft({ predicate: 'was', object: 'definitely guilty' }),
    evidenceSpans: [registeredSpan()],
    evidenceLinks: [link({ assertedValue: 'definitely guilty' })],
    uncertainties: [],
    extractedAt: NOW,
    extractedBy: 'researcher-1',
  });
  assert.equal(procedural.decision, 'rejected');
  assert.ok(procedural.rejectionReasons.some((reason) => reason.includes('Unsupported procedural')));
});

test('credible contradictions are attached without collapsing values', () => {
  const record = evaluateClaimExtraction({
    id: 'extraction-contradiction',
    method: 'manual',
    draft: draft(),
    evidenceSpans: [registeredSpan()],
    evidenceLinks: [
      link(),
      link({
        id: 'link-contradiction',
        evidenceId: 'ev-2',
        lineageRootId: 'ev-2',
        role: 'contradicting',
        assertedValue: '1962',
      }),
    ],
    uncertainties: [],
    extractedAt: NOW,
    extractedBy: 'researcher-1',
  });
  assert.equal(record.decision, 'accepted');
  assert.equal(record.contradictions.hasCredibleContradiction, true);
  assert.ok(record.contradictions.values.some((value) => value.value === '1962'));
});
