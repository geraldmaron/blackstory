/**
 * Normalize web-search results into BB-037 AdapterCandidateRecord output (BB-075).
 *
 * CRITICAL fail-closed gate (bead acceptance criterion 1): `assertStorageTermsConfirmed` throws
 * unless `config.storageTermsConfirmed === true`. This is independent of, and in addition to,
 * the BB-037 registry's disabled-by-default state (../gates.ts) -- a registry approval alone can
 * never cause a result to be persisted; storage-rights confirmation is a second, separate gate
 * that only a human sets after obtaining real written confirmation from the vendor. Every
 * normalize/persist entry point in this module calls this assertion before constructing a
 * candidate -- there is no code path here that returns a `WebSearchCandidateRecord` without it.
 */
import { MAX_EVIDENCE_SNIPPET_CHARACTERS, MAX_EVIDENCE_SNIPPET_WORDS } from '../../rights/evidence-pointer.js';
import { stampCandidateProvenance } from '../candidates.js';
import type { SourceRegistryEntry } from '../types.js';
import { WEB_SEARCH_DEFAULT_CLASSIFICATION, WEB_SEARCH_PAYLOAD_SCHEMA_VERSION, webSearchAdapterId } from './types.js';
import type {
  ExternalQueryProvenance,
  WebSearchCandidatePayload,
  WebSearchCandidateRecord,
  WebSearchProviderConfig,
  WebSearchRawResult,
} from './types.js';

/** Throws (fails closed) unless the caller has recorded real, written storage-rights confirmation. */
export function assertStorageTermsConfirmed(config: WebSearchProviderConfig): void {
  if (config.storageTermsConfirmed !== true) {
    throw new Error(
      `Cannot persist a ${config.provider} web-search result: storageTermsConfirmed is false. ` +
        'Written storage-rights confirmation from the vendor is required before any result may ' +
        'be persisted (BB-075 acceptance criterion 1); this flag is never set automatically.',
    );
  }
}

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

export type NormalizeWebSearchResultInput = {
  readonly result: WebSearchRawResult;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly config: WebSearchProviderConfig;
  readonly queryProvenance: ExternalQueryProvenance;
  readonly classification?: string;
};

export function normalizeWebSearchResult(input: NormalizeWebSearchResultInput): WebSearchCandidateRecord {
  assertStorageTermsConfirmed(input.config);
  if (!input.result.url.trim()) {
    throw new Error('Web search result requires a url to normalize into a candidate');
  }

  const summary = capSummary(input.result.description);
  const payload: WebSearchCandidatePayload = {
    schemaVersion: WEB_SEARCH_PAYLOAD_SCHEMA_VERSION,
    provider: input.config.provider,
    query: input.queryProvenance,
    ...(input.result.pageAge !== undefined ? { pageAge: input.result.pageAge } : {}),
    ...(summary !== undefined ? { summary } : {}),
  };

  const candidate = stampCandidateProvenance(input.registryEntry, input.runId, input.capturedAt, {
    stableIdentifier: `${webSearchAdapterId(input.config.provider)}:${input.result.url}`,
    ...(input.result.title !== undefined ? { title: input.result.title } : {}),
    canonicalUrl: input.result.url,
    classification: input.classification ?? WEB_SEARCH_DEFAULT_CLASSIFICATION,
    payload: payload as Readonly<Record<string, unknown>>,
  });

  assertWebSearchCandidate(candidate as WebSearchCandidateRecord);
  return candidate as WebSearchCandidateRecord;
}

export function normalizeWebSearchBatch(input: {
  readonly results: readonly WebSearchRawResult[];
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly config: WebSearchProviderConfig;
  readonly queryProvenance: ExternalQueryProvenance;
  readonly classification?: string;
}): readonly WebSearchCandidateRecord[] {
  return input.results
    .filter((result) => Boolean(result.url?.trim()))
    .map((result) =>
      normalizeWebSearchResult({
        result,
        registryEntry: input.registryEntry,
        runId: input.runId,
        capturedAt: input.capturedAt,
        config: input.config,
        queryProvenance: input.queryProvenance,
        ...(input.classification !== undefined ? { classification: input.classification } : {}),
      }),
    );
}

export function assertWebSearchCandidate(candidate: WebSearchCandidateRecord): void {
  const expectedAdapterId = webSearchAdapterId(candidate.payload.provider);
  if (candidate.provenance.adapterId !== expectedAdapterId) {
    throw new Error(`Expected adapterId ${expectedAdapterId} for provider ${candidate.payload.provider}`);
  }
  if (candidate.payload.schemaVersion !== WEB_SEARCH_PAYLOAD_SCHEMA_VERSION) {
    throw new Error(`Unexpected payload schema version: ${candidate.payload.schemaVersion}`);
  }
  if (candidate.payload.summary && candidate.payload.summary.length > MAX_EVIDENCE_SNIPPET_CHARACTERS) {
    throw new Error('Web search candidate summary exceeds the evidence-pointer snippet cap');
  }
}
