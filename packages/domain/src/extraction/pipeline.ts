/**
 * Deterministic extraction decision pipeline with evidence and uncertainty gates.
 */
import {
  assertClaimEvidenceLinkValid,
  preserveContradictoryValues,
  type ClaimEvidenceLink,
} from '../claims/index.js';
import { evidenceLinkQualifies } from './evidence.js';
import type {
  ClaimDraft,
  EvidenceSpan,
  ExtractionMethod,
  ExtractionRecord,
  ExtractionUncertainty,
} from './types.js';
import {
  assertAtomicDraftValid,
  assertExtractionRecordValid,
  assertGeographicContextValid,
  assertProceduralLanguageValid,
  assertTemporalContextValid,
} from './validation.js';

function appendUncertainty(
  uncertainties: ExtractionUncertainty[],
  uncertainty: ExtractionUncertainty,
): void {
  if (
    !uncertainties.some(
      (existing) => existing.code === uncertainty.code && existing.detail === uncertainty.detail,
    )
  ) {
    uncertainties.push(uncertainty);
  }
}

function contextUncertainties(draft: ClaimDraft): ExtractionUncertainty[] {
  return [
    ...(draft.temporal
      ? []
      : [
          {
            code: 'temporal',
            detail: 'No temporal context was established during extraction.',
            recordedBy: 'validator',
          } as const,
        ]),
    ...(draft.geographic
      ? []
      : [
          {
            code: 'geographic',
            detail: 'No geographic context was established during extraction.',
            recordedBy: 'validator',
          } as const,
        ]),
  ];
}

export function evaluateClaimExtraction(input: {
  readonly id: string;
  readonly method: ExtractionMethod;
  readonly draft: ClaimDraft;
  readonly evidenceSpans: readonly EvidenceSpan[];
  readonly evidenceLinks: readonly ClaimEvidenceLink[];
  readonly uncertainties: readonly ExtractionUncertainty[];
  readonly extractedAt: string;
  readonly extractedBy: string;
}): ExtractionRecord {
  const rejectionReasons: string[] = [];
  const uncertainties = [...input.uncertainties];
  for (const uncertainty of contextUncertainties(input.draft)) {
    appendUncertainty(uncertainties, uncertainty);
  }

  try {
    assertAtomicDraftValid(input.draft);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Claim validation failed';
    const normalizedDetail = detail.toLocaleLowerCase('en-US');
    rejectionReasons.push(detail);
    const code =
      normalizedDetail.includes('temporal') ||
      normalizedDetail.includes('validfrom') ||
      normalizedDetail.includes('validto')
        ? 'temporal'
        : normalizedDetail.includes('geographic')
          ? 'geographic'
          : normalizedDetail.includes('procedural')
            ? 'procedural_status'
            : 'atomicity';
    appendUncertainty(uncertainties, { code, detail, recordedBy: 'validator' });
  }

  try {
    assertTemporalContextValid(input.draft.temporal);
    assertGeographicContextValid(input.draft.geographic);
    assertProceduralLanguageValid(input.draft);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Context validation failed';
    if (!rejectionReasons.includes(detail)) rejectionReasons.push(detail);
  }

  for (const link of input.evidenceLinks) {
    assertClaimEvidenceLinkValid(link);
    if (
      link.claimId !== input.draft.claimId ||
      link.claimVersionId !== input.draft.claimVersionId
    ) {
      rejectionReasons.push(`Evidence link ${link.id} does not target the extracted claim version`);
    }
  }

  const qualifyingEvidence = input.evidenceLinks.some((link) =>
    evidenceLinkQualifies(link, input.evidenceSpans, input.draft.object),
  );
  if (!qualifyingEvidence) {
    const detail = 'Claim has no qualifying credible supporting evidence span';
    rejectionReasons.push(detail);
    appendUncertainty(uncertainties, {
      code: 'evidence',
      detail,
      recordedBy: 'validator',
    });
  }

  const contradictions = preserveContradictoryValues({
    claimId: input.draft.claimId,
    primaryValue: input.draft.object,
    evidenceLinks: input.evidenceLinks,
  });
  const decision = rejectionReasons.length === 0 ? 'accepted' : 'rejected';
  const record: ExtractionRecord = {
    schemaVersion: 'extraction-record.v1',
    id: input.id,
    method: input.method,
    draft: input.draft,
    evidenceSpans: [...input.evidenceSpans],
    evidenceLinks: [...input.evidenceLinks],
    contradictions,
    uncertainties,
    decision,
    workflowStatus: decision,
    rejectionReasons,
    extractedAt: input.extractedAt,
    extractedBy: input.extractedBy,
  };
  assertExtractionRecordValid(record);
  return record;
}
