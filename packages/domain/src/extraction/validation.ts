/**
 * Atomicity, context, procedural-language, and extraction-record validation.
 */
import { loadProductConstitution } from '@blap/schemas';
import {
  assertContradictionsPreserved,
  assertProceduralStatusRecognized,
} from '../claims/index.js';
import type { ClaimGeographicContext } from '../claims/index.js';
import type { TemporalContext } from '../relationship.js';
import { evidenceLinkQualifies } from './evidence.js';
import type { ClaimDraft, ExtractionRecord } from './types.js';

function assertDateValue(value: string, label: string): void {
  if (!value.trim() || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a parseable date`);
  }
}

export function assertTemporalContextValid(temporal: TemporalContext | undefined): void {
  if (!temporal) return;
  if (temporal.label !== undefined && !temporal.label.trim()) {
    throw new Error('Temporal context label cannot be blank');
  }
  if (temporal.validFrom !== undefined) assertDateValue(temporal.validFrom, 'validFrom');
  if (temporal.validTo !== undefined && temporal.validTo !== null) {
    assertDateValue(temporal.validTo, 'validTo');
  }
  if (
    temporal.validFrom !== undefined &&
    temporal.validTo !== undefined &&
    temporal.validTo !== null &&
    Date.parse(temporal.validFrom) > Date.parse(temporal.validTo)
  ) {
    throw new Error('Temporal context validFrom cannot be after validTo');
  }
  if (
    temporal.label === undefined &&
    temporal.validFrom === undefined &&
    temporal.validTo === undefined
  ) {
    throw new Error('Temporal context cannot be empty');
  }
}

export function assertGeographicContextValid(
  geographic: ClaimGeographicContext | undefined,
): void {
  if (!geographic) return;
  if (
    !geographic.locationId?.trim() &&
    !geographic.jurisdictionId?.trim() &&
    !geographic.notes?.trim()
  ) {
    throw new Error('Geographic context cannot be empty');
  }
  if (geographic.precision !== undefined && !geographic.precision.trim()) {
    throw new Error('Geographic precision cannot be blank');
  }
}

export function assertProceduralLanguageValid(draft: ClaimDraft): void {
  assertProceduralStatusRecognized(draft.proceduralStatus);
  const text = `${draft.predicate} ${draft.object}`.toLocaleLowerCase('en-US');
  const unsupported = loadProductConstitution().unsupportedProceduralLanguage.find((phrase) =>
    text.includes(phrase.toLocaleLowerCase('en-US')),
  );
  if (unsupported) {
    throw new Error(`Unsupported procedural language: ${unsupported}`);
  }
}

export function assertAtomicDraftValid(draft: ClaimDraft): void {
  if (!draft.claimId.trim()) throw new Error('Claim id is required');
  if (!draft.claimVersionId.trim()) throw new Error('Claim version id is required');
  if (!draft.entityId.trim()) throw new Error('Entity id is required');
  if (!draft.predicate.trim()) throw new Error('Claim predicate is required');
  if (!draft.object.trim()) throw new Error('Claim object is required');
  if (
    draft.atomicity.assertionCount !== 1 ||
    !draft.atomicity.independentlySupportable
  ) {
    throw new Error('A claim must contain one independently supportable assertion');
  }
  if (!draft.atomicity.rationale.trim()) throw new Error('Atomicity rationale is required');
  assertTemporalContextValid(draft.temporal);
  assertGeographicContextValid(draft.geographic);
  assertProceduralLanguageValid(draft);
}

export function assertExtractionRecordValid(record: ExtractionRecord): void {
  if (record.schemaVersion !== 'extraction-record.v1') {
    throw new Error('Unsupported extraction record schema version');
  }
  if (!record.id.trim()) throw new Error('Extraction record id is required');
  if (!record.extractedAt.trim() || Number.isNaN(Date.parse(record.extractedAt))) {
    throw new Error('Extraction timestamp must be a parseable date');
  }
  if (!record.extractedBy.trim()) throw new Error('Extractor is required');
  for (const uncertainty of record.uncertainties) {
    if (!uncertainty.detail.trim()) throw new Error('Extraction uncertainty detail is required');
  }
  assertContradictionsPreserved(record.contradictions);

  const hasQualifyingEvidence = record.evidenceLinks.some((link) =>
    evidenceLinkQualifies(link, record.evidenceSpans, record.draft.object),
  );
  if (record.decision === 'accepted') {
    assertAtomicDraftValid(record.draft);
    if (!hasQualifyingEvidence) {
      throw new Error('Accepted claims require qualifying supporting evidence');
    }
    if (record.workflowStatus !== 'accepted' || record.rejectionReasons.length !== 0) {
      throw new Error('Accepted extraction decision is internally inconsistent');
    }
  } else if (record.workflowStatus !== 'rejected' || record.rejectionReasons.length === 0) {
    throw new Error('Rejected extraction decision requires at least one rejection reason');
  }
}
