/**
 * Normalize parsed Chronicling America docs into AdapterCandidateRecord output.
 */
import {
  MAX_EVIDENCE_SNIPPET_CHARACTERS,
  MAX_EVIDENCE_SNIPPET_WORDS,
} from '../../rights/evidence-pointer.js';
import { stampCandidateProvenance } from '../candidates.js';
import type { SourceRegistryEntry } from '../types.js';
import {
  CHRONICLING_AMERICA_ADAPTER_ID,
  CHRONICLING_AMERICA_DEFAULT_CLASSIFICATION,
  CHRONICLING_AMERICA_PAYLOAD_SCHEMA_VERSION,
} from './types.js';
import type {
  ChroniclingAmericaCandidatePayload,
  ChroniclingAmericaCandidateRecord,
  ChroniclingAmericaNormalizedDoc,
} from './types.js';

function capSummary(text: string | undefined): string | undefined {
  if (!text) return undefined;
  let capped = text.trim();
  if (capped.length > MAX_EVIDENCE_SNIPPET_CHARACTERS) {
    capped = capped.slice(0, MAX_EVIDENCE_SNIPPET_CHARACTERS).trim();
  }
  const words = capped.split(/\s+/u).filter(Boolean);
  if (words.length > MAX_EVIDENCE_SNIPPET_WORDS) {
    capped = words.slice(0, MAX_EVIDENCE_SNIPPET_WORDS).join(' ');
  }
  return capped || undefined;
}

export type NormalizeChroniclingAmericaDocInput = {
  readonly doc: ChroniclingAmericaNormalizedDoc;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly classification?: string;
  readonly summarySource?: string;
};

export function normalizeChroniclingAmericaDoc(
  input: NormalizeChroniclingAmericaDocInput,
): ChroniclingAmericaCandidateRecord {
  const classification = input.classification ?? CHRONICLING_AMERICA_DEFAULT_CLASSIFICATION;
  const summary = capSummary(input.summarySource ?? input.doc.publicationTitle);

  const payload: ChroniclingAmericaCandidatePayload = {
    schemaVersion: CHRONICLING_AMERICA_PAYLOAD_SCHEMA_VERSION,
    ...(input.doc.lccn !== undefined ? { lccn: input.doc.lccn } : {}),
    ...(input.doc.displayDate !== undefined ? { displayDate: input.doc.displayDate } : {}),
    ...(input.doc.publicationTitle !== undefined
      ? { publicationTitle: input.doc.publicationTitle }
      : {}),
    ...(input.doc.publicationPlace !== undefined
      ? { publicationPlace: input.doc.publicationPlace }
      : {}),
    ...(input.doc.location !== undefined ? { location: input.doc.location } : {}),
    ...(input.doc.subjects !== undefined ? { subjects: input.doc.subjects } : {}),
    ...(summary !== undefined ? { summary } : {}),
  };

  const candidate = stampCandidateProvenance(input.registryEntry, input.runId, input.capturedAt, {
    stableIdentifier: input.doc.stableIdentifier,
    title: input.doc.title,
    canonicalUrl: input.doc.canonicalUrl,
    classification,
    payload: payload as Readonly<Record<string, unknown>>,
  });

  assertChroniclingAmericaCandidate(candidate as ChroniclingAmericaCandidateRecord);
  return candidate as ChroniclingAmericaCandidateRecord;
}

export function normalizeChroniclingAmericaBatch(input: {
  readonly docs: readonly ChroniclingAmericaNormalizedDoc[];
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly classification?: string;
}): readonly ChroniclingAmericaCandidateRecord[] {
  return input.docs.map((doc) =>
    normalizeChroniclingAmericaDoc({
      doc,
      registryEntry: input.registryEntry,
      runId: input.runId,
      capturedAt: input.capturedAt,
      ...(input.classification !== undefined ? { classification: input.classification } : {}),
    }),
  );
}

export function assertChroniclingAmericaCandidate(
  candidate: ChroniclingAmericaCandidateRecord,
): void {
  if (candidate.provenance.adapterId !== CHRONICLING_AMERICA_ADAPTER_ID) {
    throw new Error(`Expected adapterId ${CHRONICLING_AMERICA_ADAPTER_ID}`);
  }
  if (candidate.payload.schemaVersion !== CHRONICLING_AMERICA_PAYLOAD_SCHEMA_VERSION) {
    throw new Error(
      `Unexpected payload schema version: ${candidate.payload.schemaVersion}`,
    );
  }
  if (
    candidate.payload.summary &&
    candidate.payload.summary.length > MAX_EVIDENCE_SNIPPET_CHARACTERS
  ) {
    throw new Error('Chronicling America candidate summary exceeds the evidence-pointer snippet cap');
  }
}
