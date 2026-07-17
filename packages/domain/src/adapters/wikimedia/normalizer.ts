/**
 * Normalize Wikimedia API/bulk fetches into AdapterCandidateRecord output.
 */
import { stampCandidateProvenance } from '../candidates.js';
import type { SourceRegistryEntry } from '../types.js';
import { evaluateCategoryGate } from './category-gate.js';
import { WIKIMEDIA_ATTRIBUTION } from './contract.js';
import {
  buildStableIdentifier,
  buildWikipediaCanonicalUrl,
  extractAliases,
  extractExternalReferences,
  extractLocations,
  extractPageCategories,
  extractRelationships,
  extractWikidataId,
  readLatestRevision,
  resolvePageTitle,
} from './extractors.js';
import type {
  MediaWikiPage,
  WikidataEntity,
  WikimediaApiFetch,
  WikimediaBulkBatch,
  WikimediaBulkPageRecord,
  WikimediaCandidatePayload,
  WikimediaCandidateRecord,
  WikimediaIngestMode,
} from './types.js';
import {
  WIKIMEDIA_ADAPTER_ID,
  WIKIMEDIA_PAYLOAD_SCHEMA_VERSION,
} from './types.js';

export type NormalizeWikimediaPageInput = {
  readonly project: string;
  readonly page: MediaWikiPage;
  readonly wikidata?: WikidataEntity;
  readonly ingestMode: WikimediaIngestMode;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
};

export function normalizeWikimediaPage(input: NormalizeWikimediaPageInput): WikimediaCandidateRecord {
  const categories = extractPageCategories(input.page);
  const categoryGate = evaluateCategoryGate({ pageCategories: categories });
  const revision = readLatestRevision(input.page);
  const wikidataId = extractWikidataId(input.page, input.wikidata);

  const payload: WikimediaCandidatePayload = {
    schemaVersion: WIKIMEDIA_PAYLOAD_SCHEMA_VERSION,
    ingestMode: input.ingestMode,
    pageId: input.page.pageid,
    pageTitle: input.page.title,
    revisionId: revision.revisionId,
    revisionTimestamp: revision.revisionTimestamp,
    namespace: input.page.ns,
    ...(wikidataId !== undefined ? { wikidataId } : {}),
    aliases: extractAliases(input.wikidata),
    locations: extractLocations(input.wikidata),
    externalReferences: extractExternalReferences(input.wikidata),
    relationships: extractRelationships(input.wikidata),
    categories,
    categoryGate,
    includeProse: false,
    attribution: { ...WIKIMEDIA_ATTRIBUTION },
  };

  const stableIdentifier = buildStableIdentifier(input.project, input.page.pageid);
  const title = resolvePageTitle(input.wikidata, input.page);

  const candidate = stampCandidateProvenance(
    input.registryEntry,
    input.runId,
    input.capturedAt,
    {
      stableIdentifier,
      title,
      canonicalUrl: buildWikipediaCanonicalUrl(input.project, input.page.title),
      classification: input.registryEntry.contract.classification,
      payload: payload as Readonly<Record<string, unknown>>,
    },
  );

  assertWikimediaCandidate(candidate as WikimediaCandidateRecord);
  return candidate as WikimediaCandidateRecord;
}

export function normalizeWikimediaApiFetch(
  fetch: WikimediaApiFetch,
  context: {
    readonly registryEntry: SourceRegistryEntry;
    readonly runId: string;
    readonly capturedAt: string;
  },
): WikimediaCandidateRecord {
  return normalizeWikimediaPage({
    project: fetch.project,
    page: fetch.page,
    ...(fetch.wikidata !== undefined ? { wikidata: fetch.wikidata } : {}),
    ingestMode: 'api',
    registryEntry: context.registryEntry,
    runId: context.runId,
    capturedAt: context.capturedAt,
  });
}

export function normalizeWikimediaBulkBatch(
  batch: WikimediaBulkBatch,
  context: {
    readonly registryEntry: SourceRegistryEntry;
    readonly runId: string;
    readonly capturedAt: string;
  },
): readonly WikimediaCandidateRecord[] {
  return batch.records.map((record) =>
    normalizeWikimediaBulkRecord(batch.project, record, context),
  );
}

export function normalizeWikimediaBulkRecord(
  project: string,
  record: WikimediaBulkPageRecord,
  context: {
    readonly registryEntry: SourceRegistryEntry;
    readonly runId: string;
    readonly capturedAt: string;
  },
): WikimediaCandidateRecord {
  return normalizeWikimediaPage({
    project,
    page: record.page,
    ...(record.wikidata !== undefined ? { wikidata: record.wikidata } : {}),
    ingestMode: 'bulk',
    registryEntry: context.registryEntry,
    runId: context.runId,
    capturedAt: context.capturedAt,
  });
}

export function assertWikimediaCandidate(candidate: WikimediaCandidateRecord): void {
  if (candidate.provenance.adapterId !== WIKIMEDIA_ADAPTER_ID) {
    throw new Error(`Expected adapterId ${WIKIMEDIA_ADAPTER_ID}`);
  }
  const payload = candidate.payload;
  if (payload.schemaVersion !== WIKIMEDIA_PAYLOAD_SCHEMA_VERSION) {
    throw new Error(`Unexpected payload schema version: ${payload.schemaVersion}`);
  }
  if (payload.includeProse !== false) {
    throw new Error('Wikipedia prose copy flag must remain false by default');
  }
  if (!payload.revisionId || !payload.revisionTimestamp) {
    throw new Error('Candidate must retain page revision metadata');
  }
  if (!payload.attribution.requiredNotice.trim()) {
    throw new Error('Attribution metadata is required for Wikimedia reuse');
  }
}

export function candidatesEquivalent(
  left: WikimediaCandidateRecord,
  right: WikimediaCandidateRecord,
): boolean {
  const normalizePayload = (payload: WikimediaCandidatePayload) => {
    const { ingestMode: _ingestMode, ...rest } = payload;
    return rest;
  };
  const normalize = (candidate: WikimediaCandidateRecord) => ({
    stableIdentifier: candidate.stableIdentifier,
    title: candidate.title,
    canonicalUrl: candidate.canonicalUrl,
    classification: candidate.classification,
    payload: normalizePayload(candidate.payload),
  });
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}
