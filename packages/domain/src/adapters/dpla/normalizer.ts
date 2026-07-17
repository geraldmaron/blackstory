/**
 * Normalize defensively-parsed DPLA v2 docs into BB-037 AdapterCandidateRecord output (BB-073).
 */
import { MAX_EVIDENCE_SNIPPET_CHARACTERS, MAX_EVIDENCE_SNIPPET_WORDS } from '../../rights/evidence-pointer.js';
import { stampCandidateProvenance } from '../candidates.js';
import type { SourceRegistryEntry } from '../types.js';
import { DPLA_V2_ADAPTER_ID, DPLA_V2_DEFAULT_CLASSIFICATION, DPLA_V2_PAYLOAD_SCHEMA_VERSION } from './types.js';
import type { DplaCandidatePayload, DplaCandidateRecord, DplaNormalizedDoc } from './types.js';

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

export function buildDplaCanonicalUrl(doc: DplaNormalizedDoc): string {
  return doc.isShownAt ?? `https://dp.la/item/${encodeURIComponent(doc.id)}`;
}

export type NormalizeDplaDocInput = {
  readonly doc: DplaNormalizedDoc;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly classification?: string;
};

export function normalizeDplaDoc(input: NormalizeDplaDocInput): DplaCandidateRecord {
  const summary = capSummary(input.doc.description);
  const classification = input.classification ?? DPLA_V2_DEFAULT_CLASSIFICATION;

  const payload: DplaCandidatePayload = {
    schemaVersion: DPLA_V2_PAYLOAD_SCHEMA_VERSION,
    dplaId: input.doc.id,
    ...(input.doc.providerName !== undefined ? { providerName: input.doc.providerName } : {}),
    ...(input.doc.displayDate !== undefined ? { displayDate: input.doc.displayDate } : {}),
    ...(input.doc.subjects !== undefined ? { subjects: input.doc.subjects } : {}),
    ...(summary !== undefined ? { summary } : {}),
  };

  const candidate = stampCandidateProvenance(input.registryEntry, input.runId, input.capturedAt, {
    stableIdentifier: `dpla-v2:${input.doc.id}`,
    ...(input.doc.title !== undefined ? { title: input.doc.title } : {}),
    canonicalUrl: buildDplaCanonicalUrl(input.doc),
    classification,
    payload: payload as Readonly<Record<string, unknown>>,
  });

  assertDplaCandidate(candidate as DplaCandidateRecord);
  return candidate as DplaCandidateRecord;
}

export function normalizeDplaBatch(input: {
  readonly docs: readonly DplaNormalizedDoc[];
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly classification?: string;
}): readonly DplaCandidateRecord[] {
  return input.docs.map((doc) =>
    normalizeDplaDoc({
      doc,
      registryEntry: input.registryEntry,
      runId: input.runId,
      capturedAt: input.capturedAt,
      ...(input.classification !== undefined ? { classification: input.classification } : {}),
    }),
  );
}

export function assertDplaCandidate(candidate: DplaCandidateRecord): void {
  if (candidate.provenance.adapterId !== DPLA_V2_ADAPTER_ID) {
    throw new Error(`Expected adapterId ${DPLA_V2_ADAPTER_ID}`);
  }
  if (candidate.payload.schemaVersion !== DPLA_V2_PAYLOAD_SCHEMA_VERSION) {
    throw new Error(`Unexpected payload schema version: ${candidate.payload.schemaVersion}`);
  }
  if (candidate.payload.summary && candidate.payload.summary.length > MAX_EVIDENCE_SNIPPET_CHARACTERS) {
    throw new Error('DPLA candidate summary exceeds the evidence-pointer snippet cap');
  }
}
