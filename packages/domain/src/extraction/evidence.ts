/**
 * Evidence-span registration and exact-quotation verification.
 */
import { assertClaimEvidenceLinkValid, type ClaimEvidenceLink } from '../claims/index.js';
import {
  assertEvidenceRecordValid,
  type EvidenceLocator,
  type EvidenceRecord,
} from '../provenance/index.js';
import type { EvidenceSpan } from './types.js';

function hasExactLocator(locator: EvidenceLocator | undefined): locator is EvidenceLocator {
  if (!locator) return false;
  return Boolean(
    locator.page?.trim() ||
      locator.pages?.trim() ||
      locator.paragraph?.trim() ||
      locator.label?.trim() ||
      locator.uriFragment?.trim() ||
      (Number.isInteger(locator.offsetStart) && Number.isInteger(locator.offsetEnd)),
  );
}

export function assertQuotationAccurate(input: {
  readonly excerpt: string;
  readonly offsetStart: number;
  readonly offsetEnd: number;
  readonly quotation: string;
}): void {
  if (!Number.isInteger(input.offsetStart) || !Number.isInteger(input.offsetEnd)) {
    throw new Error('Evidence span offsets must be integers');
  }
  if (input.offsetStart < 0 || input.offsetEnd <= input.offsetStart) {
    throw new Error('Evidence span offsets must define a non-empty range');
  }
  if (input.offsetEnd > input.excerpt.length) {
    throw new Error('Evidence span exceeds the evidence excerpt');
  }
  if (input.excerpt.slice(input.offsetStart, input.offsetEnd) !== input.quotation) {
    throw new Error('Exact quotation does not match the registered evidence span');
  }
}

export function registerEvidenceSpan(input: {
  readonly id: string;
  readonly evidence: EvidenceRecord;
  readonly offsetStart: number;
  readonly offsetEnd: number;
  readonly exactQuotation: boolean;
  readonly quotation?: string;
}): EvidenceSpan {
  assertEvidenceRecordValid(input.evidence);
  if (!input.id.trim()) throw new Error('Evidence span id is required');
  if (!input.evidence.id.trim()) throw new Error('Evidence id is required');
  if (!input.evidence.excerpt) throw new Error('Evidence span registration requires an excerpt');
  if (!hasExactLocator(input.evidence.locator)) {
    throw new Error('Evidence span registration requires an exact source locator');
  }

  const text = input.evidence.excerpt.slice(input.offsetStart, input.offsetEnd);
  if (!text) throw new Error('Evidence span offsets must define a non-empty range');
  if (input.exactQuotation && input.quotation === undefined) {
    throw new Error('Exact quotations require quotation text');
  }
  assertQuotationAccurate({
    excerpt: input.evidence.excerpt,
    offsetStart: input.offsetStart,
    offsetEnd: input.offsetEnd,
    quotation: input.exactQuotation ? input.quotation! : text,
  });

  const locator = input.evidence.locator;
  return {
    id: input.id,
    evidenceId: input.evidence.id,
    sourceItemId: input.evidence.sourceItemId,
    offsetStart: input.offsetStart,
    offsetEnd: input.offsetEnd,
    text,
    exactQuotation: input.exactQuotation,
    locator: {
      ...(locator.page?.trim() ? { page: locator.page } : {}),
      ...(locator.pages?.trim() ? { pages: locator.pages } : {}),
      ...(locator.paragraph?.trim() ? { paragraph: locator.paragraph } : {}),
      ...(locator.offsetStart !== undefined && Number.isInteger(locator.offsetStart)
        ? { offsetStart: locator.offsetStart }
        : {}),
      ...(locator.offsetEnd !== undefined && Number.isInteger(locator.offsetEnd)
        ? { offsetEnd: locator.offsetEnd }
        : {}),
      ...(locator.label?.trim() ? { label: locator.label } : {}),
      ...(locator.uriFragment?.trim() ? { uriFragment: locator.uriFragment } : {}),
    },
  };
}

export function evidenceLinkQualifies(
  link: ClaimEvidenceLink,
  spans: readonly EvidenceSpan[],
  expectedValue?: string,
): boolean {
  assertClaimEvidenceLinkValid(link);
  return (
    link.role === 'supporting' &&
    link.credible &&
    link.directness > 0 &&
    link.extractionQuality > 0 &&
    (expectedValue === undefined || link.assertedValue?.trim() === expectedValue.trim()) &&
    spans.some((span) => span.evidenceId === link.evidenceId)
  );
}
