import assert from 'node:assert/strict';
import test from 'node:test';
import {
  candidateSnapshotSha256,
  preparePrimaryScanCorrection,
  type CandidateSnapshot,
  type ScanCorrection,
} from './greenbook-primary-scan-plan.ts';
import {
  requiresPrimaryScanReview,
  isRestatedListing,
  listingSummary,
  listingClaim,
  listingFactsFromRow,
} from './greenbook-registry.ts';
const row: CandidateSnapshot = {
  id: 'listing',
  display_name: 'Studio',
  status: 'pending',
  updated_at: '2026-11-17T00:00:00Z',
  provenance: {
    sourceCategory: 'Restaurant',
    historicAddress: '123 A St., New York',
    editionYear: 1947,
    sourceCity: 'New York',
    sourceState: 'NY',
  },
  payload: { listingReview: { approved: true }, evidenceCitations: [{ quote: 'Restaurant' }] },
};
const correction: ScanCorrection = {
  candidateId: row.id,
  expectedSnapshotSha256: candidateSnapshotSha256(row),
  expectedCategory: 'Restaurant',
  correctedCategory: 'Beauty Parlor',
  evidence: {
    sourceUrl: 'https://example.com/scan.pdf',
    captureSha256: 'a'.repeat(64),
    printedPage: '29',
    pdfPage: 31,
    listingName: 'Studio',
    listingAddress: '123 A St.',
    sectionHeading: 'BEAUTY PARLORS',
  },
  review: {
    actorId: 'reviewer',
    reviewedAt: '2026-11-17T00:00:00Z',
    rationale: 'Listing under section heading',
  },
};
test('preparation preserves source quotations/category, archives review and proposes separate correction', () => {
  const original = JSON.stringify(row);
  const plan = preparePrimaryScanCorrection(row, correction);
  assert.equal(JSON.stringify(row), original);
  assert.equal(
    (plan.proposedCandidate.provenance as Record<string, unknown>).sourceCategory,
    'Restaurant',
  );
  assert.deepEqual(plan.proposedCandidate.payload.evidenceCitations, row.payload.evidenceCitations);
  assert.equal('listingReview' in plan.proposedCandidate.payload, false);
  assert.deepEqual(
    plan.proposedCandidate.provenance.primaryScanCorrection.invalidatedListingReview,
    row.payload.listingReview,
  );
  assert.match(plan.proposedEditorial.claim, /beauty parlor/);
  assert.equal(plan.publication.exactProposalApprovalRequired, true);
});
test('stale snapshot, identity, evidence and no-op corrections fail closed', () => {
  assert.throws(
    () => preparePrimaryScanCorrection({ ...row, updated_at: 'changed' }, correction),
    /snapshot changed/,
  );
  assert.throws(
    () =>
      preparePrimaryScanCorrection(row, {
        ...correction,
        evidence: { ...correction.evidence, listingAddress: 'elsewhere' },
      }),
    /identity/,
  );
  assert.throws(
    () =>
      preparePrimaryScanCorrection(row, {
        ...correction,
        evidence: { ...correction.evidence, captureSha256: '' },
      }),
    /required/,
  );
  assert.throws(
    () => preparePrimaryScanCorrection(row, { ...correction, correctedCategory: 'Restaurant' }),
    /no-op/,
  );
});
test('recorded discrepancy including malformed marker prevents registry-exact restatement eligibility', () => {
  for (const marker of [null, {}, { disposition: 'requires-management-review' }]) {
    const provenance = { ...row.provenance, primaryScanCorrection: marker };
    const facts = listingFactsFromRow(row.display_name, provenance);
    assert.equal(requiresPrimaryScanReview(provenance), true);
    assert.equal(
      isRestatedListing({
        displayName: row.display_name,
        provenance,
        summary: listingSummary(facts),
        claims: [{ object: listingClaim(facts) }],
      }),
      false,
    );
  }
  assert.equal(requiresPrimaryScanReview(row.provenance), false);
});

test('missing required evidence, reviewer and source facts fail closed', () => {
  for (const key of ['printedPage', 'sectionHeading', 'listingName', 'listingAddress']) {
    const invalid = JSON.parse(JSON.stringify(correction));
    delete invalid.evidence[key];
    assert.throws(() => preparePrimaryScanCorrection(row, invalid), /required/);
  }
  for (const key of ['actorId', 'reviewedAt', 'rationale']) {
    const invalid = JSON.parse(JSON.stringify(correction));
    delete invalid.review[key];
    assert.throws(() => preparePrimaryScanCorrection(row, invalid), /required/);
  }
  for (const key of ['sourceCity', 'sourceState', 'editionYear']) {
    const invalid = JSON.parse(JSON.stringify(row));
    delete invalid.provenance[key];
    assert.throws(
      () =>
        preparePrimaryScanCorrection(invalid, {
          ...correction,
          expectedSnapshotSha256: candidateSnapshotSha256(invalid),
        }),
      /required|Unsupported/,
    );
  }
});
