import { createHash } from 'node:crypto';
import { listingFactsFromRow, listingClaim, listingSummary } from './greenbook-registry.ts';

export type CandidateSnapshot = {
  id: string;
  display_name: string;
  status: string;
  updated_at: string;
  provenance: Record<string, unknown>;
  payload: Record<string, unknown>;
};
export type ScanCorrection = {
  candidateId: string;
  expectedSnapshotSha256: string;
  expectedCategory: string;
  correctedCategory: string;
  evidence: {
    sourceUrl: string;
    captureSha256: string;
    printedPage: string;
    pdfPage: number;
    listingName: string;
    listingAddress: string;
    sectionHeading: string;
  };
  review: { actorId: string; reviewedAt: string; rationale: string };
};
function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ':' + stable(item))
        .join(',') +
      '}'
    );
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('Snapshot must contain JSON values only');
  return encoded;
}
export function candidateSnapshotSha256(row: CandidateSnapshot): string {
  return createHash('sha256').update(stable(row)).digest('hex');
}
function required(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
}
/** Pure preparation only. Does not approve, write, replace source quotes, or publish anything. */
export function preparePrimaryScanCorrection(row: CandidateSnapshot, correction: ScanCorrection) {
  if (
    row.id !== correction.candidateId ||
    candidateSnapshotSha256(row) !== correction.expectedSnapshotSha256
  )
    throw new Error('Candidate snapshot changed; refresh and review the proposal');
  if (!['pending', 'accepted'].includes(row.status)) throw new Error('Unsupported candidate state');
  if (Object.prototype.hasOwnProperty.call(row.provenance, 'primaryScanCorrection'))
    throw new Error('Existing primary scan correction requires explicit reconciliation');
  const facts = listingFactsFromRow(row.display_name, row.provenance);
  for (const key of ['name', 'address', 'category', 'city', 'state'] as const)
    required(facts[key], key);
  if (![1947, 1956].includes(facts.year)) throw new Error('Unsupported Green Book edition');
  required(row.id, 'Candidate ID');
  required(row.updated_at, 'Candidate version');
  if (facts.category !== correction.expectedCategory) throw new Error('Imported category changed');
  required(correction.correctedCategory, 'Corrected category');
  if (correction.correctedCategory === facts.category)
    throw new Error('Category correction is a no-op');
  const evidence = correction.evidence;
  for (const key of [
    'sourceUrl',
    'captureSha256',
    'printedPage',
    'listingName',
    'listingAddress',
    'sectionHeading',
  ] as const)
    required(evidence[key], key);
  for (const key of ['actorId', 'reviewedAt', 'rationale'] as const)
    required(correction.review[key], key);
  const sourceUrl = new URL(evidence.sourceUrl);
  if (sourceUrl.protocol !== 'https:' || sourceUrl.username || sourceUrl.password)
    throw new Error('Invalid primary scan URL');
  if (
    !/^https:\/\//u.test(evidence.sourceUrl) ||
    !/^[a-f0-9]{64}$/u.test(evidence.captureSha256) ||
    !Number.isInteger(evidence.pdfPage) ||
    evidence.pdfPage < 1 ||
    !Number.isFinite(Date.parse(correction.review.reviewedAt))
  )
    throw new Error('Primary scan evidence or review is invalid');
  if (evidence.listingName !== facts.name || evidence.listingAddress !== facts.address)
    throw new Error(
      'Primary scan listing identity must match; handle OCR/address changes separately',
    );
  const effectiveFacts = { ...facts, category: correction.correctedCategory };
  const { listingReview, ...payload } = row.payload;
  const nextProvenance = {
    ...row.provenance,
    primaryScanCorrection: {
      schemaVersion: 1,
      ...correction,
      invalidatedListingReview: listingReview ?? null,
      disposition: 'requires-management-review',
    },
  };
  return {
    candidateId: row.id,
    guard: {
      snapshotSha256: correction.expectedSnapshotSha256,
      updatedAt: row.updated_at,
      status: row.status,
    },
    // Preserve the imported category and every source quotation. These are proposed changes only.
    proposedCandidate: { ...row, provenance: nextProvenance, payload },
    proposedEditorial: {
      summary: listingSummary(effectiveFacts),
      claim: listingClaim(effectiveFacts),
    },
    publication: { requiredPath: 'management-work', exactProposalApprovalRequired: true },
    audit: {
      action: 'greenbook.primary-scan-correction',
      beforeSha256: candidateSnapshotSha256(row),
      correction,
    },
  };
}
