/**
 * Normalize Internet Archive search/metadata docs into BB-037 AdapterCandidateRecord output
 * (BB-073).
 */
import { MAX_EVIDENCE_SNIPPET_CHARACTERS, MAX_EVIDENCE_SNIPPET_WORDS } from '../../rights/evidence-pointer.js';
import { stampCandidateProvenance } from '../candidates.js';
import type { SourceRegistryEntry } from '../types.js';
import {
  INTERNET_ARCHIVE_ADAPTER_ID,
  INTERNET_ARCHIVE_DEFAULT_CLASSIFICATION,
  INTERNET_ARCHIVE_PAYLOAD_SCHEMA_VERSION,
} from './types.js';
import type {
  InternetArchiveCandidatePayload,
  InternetArchiveCandidateRecord,
  InternetArchiveSearchDoc,
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

export function buildInternetArchiveCanonicalUrl(identifier: string): string {
  return `https://archive.org/details/${encodeURIComponent(identifier)}`;
}

export type NormalizeInternetArchiveDocInput = {
  readonly doc: InternetArchiveSearchDoc;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly classification?: string;
};

export function normalizeInternetArchiveDoc(input: NormalizeInternetArchiveDocInput): InternetArchiveCandidateRecord {
  const summary = capSummary(input.doc.description);
  const classification = input.classification ?? INTERNET_ARCHIVE_DEFAULT_CLASSIFICATION;

  const payload: InternetArchiveCandidatePayload = {
    schemaVersion: INTERNET_ARCHIVE_PAYLOAD_SCHEMA_VERSION,
    identifier: input.doc.identifier,
    ...(input.doc.mediatype !== undefined ? { mediatype: input.doc.mediatype } : {}),
    ...(input.doc.date !== undefined ? { date: input.doc.date } : {}),
    ...(input.doc.subject !== undefined ? { subject: input.doc.subject } : {}),
    ...(input.doc.collection !== undefined ? { collection: input.doc.collection } : {}),
    ...(summary !== undefined ? { summary } : {}),
  };

  const candidate = stampCandidateProvenance(input.registryEntry, input.runId, input.capturedAt, {
    stableIdentifier: `internet-archive:${input.doc.identifier}`,
    ...(input.doc.title !== undefined ? { title: input.doc.title } : {}),
    canonicalUrl: buildInternetArchiveCanonicalUrl(input.doc.identifier),
    classification,
    payload: payload as Readonly<Record<string, unknown>>,
  });

  assertInternetArchiveCandidate(candidate as InternetArchiveCandidateRecord);
  return candidate as InternetArchiveCandidateRecord;
}

export function normalizeInternetArchiveBatch(input: {
  readonly docs: readonly InternetArchiveSearchDoc[];
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly classification?: string;
}): readonly InternetArchiveCandidateRecord[] {
  return input.docs.map((doc) =>
    normalizeInternetArchiveDoc({
      doc,
      registryEntry: input.registryEntry,
      runId: input.runId,
      capturedAt: input.capturedAt,
      ...(input.classification !== undefined ? { classification: input.classification } : {}),
    }),
  );
}

export function assertInternetArchiveCandidate(candidate: InternetArchiveCandidateRecord): void {
  if (candidate.provenance.adapterId !== INTERNET_ARCHIVE_ADAPTER_ID) {
    throw new Error(`Expected adapterId ${INTERNET_ARCHIVE_ADAPTER_ID}`);
  }
  if (candidate.payload.schemaVersion !== INTERNET_ARCHIVE_PAYLOAD_SCHEMA_VERSION) {
    throw new Error(`Unexpected payload schema version: ${candidate.payload.schemaVersion}`);
  }
  if (candidate.payload.summary && candidate.payload.summary.length > MAX_EVIDENCE_SNIPPET_CHARACTERS) {
    throw new Error('Internet Archive candidate summary exceeds the evidence-pointer snippet cap');
  }
}
