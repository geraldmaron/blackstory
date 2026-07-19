/**
 * Wikimedia discovery adapter types: raw API/bulk shapes and normalized payload fields.
 */
import type { AdapterCandidateRecord } from '../types.js';

export const WIKIMEDIA_ADAPTER_ID = 'wikimedia-discovery-v1' as const;
export const WIKIMEDIA_PARSER_VERSION = 'wikimedia-parser-1.0.0' as const;
export const WIKIMEDIA_STABLE_ID_SCHEME = 'wikimedia-page' as const;
export const WIKIMEDIA_PAYLOAD_SCHEMA_VERSION = 'wikimedia-payload.v1' as const;

export const WIKIMEDIA_INGEST_MODES = ['api', 'bulk'] as const;
export type WikimediaIngestMode = (typeof WIKIMEDIA_INGEST_MODES)[number];

export type WikimediaAttribution = {
  readonly sourceProject: string;
  readonly license: string;
  readonly attributionUrl: string;
  readonly requiredNotice: string;
};

export type WikimediaLocationHint = {
  readonly label: string;
  readonly wikidataId?: string;
  readonly coordinate?: {
    readonly latitude: number;
    readonly longitude: number;
  };
};

export type WikimediaExternalReference = {
  readonly system: string;
  readonly identifier: string;
  readonly wikidataProperty?: string;
  readonly url?: string;
};

export type WikimediaRelationship = {
  readonly property: string;
  readonly targetWikidataId: string;
  readonly targetLabel?: string;
};

export type WikimediaCategoryGateResult = {
  readonly passed: boolean;
  readonly matchedSeedCategories: readonly string[];
  readonly traversedCategories: readonly string[];
  readonly reason: string;
};

/** Normalized payload extension stored on AdapterCandidateRecord.payload. */
export type WikimediaCandidatePayload = {
  readonly schemaVersion: typeof WIKIMEDIA_PAYLOAD_SCHEMA_VERSION;
  readonly ingestMode: WikimediaIngestMode;
  readonly pageId: number;
  readonly pageTitle: string;
  readonly revisionId: number;
  readonly revisionTimestamp: string;
  readonly namespace: number;
  readonly wikidataId?: string;
  readonly aliases: readonly string[];
  readonly locations: readonly WikimediaLocationHint[];
  readonly externalReferences: readonly WikimediaExternalReference[];
  readonly relationships: readonly WikimediaRelationship[];
  readonly categories: readonly string[];
  readonly categoryGate: WikimediaCategoryGateResult;
  readonly includeProse: false;
  readonly attribution: WikimediaAttribution;
};

export type WikimediaCandidateRecord = AdapterCandidateRecord & {
  readonly payload: WikimediaCandidatePayload;
};

export type MediaWikiSearchHit = {
  readonly pageid: number;
  readonly title: string;
  readonly snippet?: string;
};

export type MediaWikiSearchResponse = {
  readonly query?: {
    readonly search?: readonly MediaWikiSearchHit[];
  };
};

export type MediaWikiPageRevision = {
  readonly revid: number;
  readonly timestamp: string;
};

export type MediaWikiPage = {
  readonly pageid: number;
  readonly title: string;
  readonly ns: number;
  readonly revisions?: readonly MediaWikiPageRevision[];
  readonly categories?: readonly { readonly title: string }[];
};

export type MediaWikiPageResponse = {
  readonly query?: {
    readonly pages?: Readonly<Record<string, MediaWikiPage>>;
  };
};

export type WikidataClaimValue = {
  readonly id?: string;
  readonly text?: string;
  readonly amount?: string;
  readonly latitude?: number;
  readonly longitude?: number;
};

/**
 * Wikidata claim snak value. Commons media (P18) uses a bare filename string;
 * most other properties use a structured object.
 */
export type WikidataClaim = {
  readonly rank?: 'preferred' | 'normal' | 'deprecated';
  readonly mainsnak: {
    readonly property: string;
    readonly datavalue?: {
      readonly value: WikidataClaimValue | string;
    };
  };
};

export type WikidataEntity = {
  readonly id: string;
  readonly labels?: Readonly<Record<string, { readonly value: string }>>;
  readonly descriptions?: Readonly<Record<string, { readonly value: string }>>;
  readonly aliases?: Readonly<Record<string, readonly { readonly value: string }[]>>;
  readonly claims?: Readonly<Record<string, readonly WikidataClaim[]>>;
};

export type WikidataEntityResponse = {
  readonly entities?: Readonly<Record<string, WikidataEntity>>;
};

export type WikimediaBulkPageRecord = {
  readonly page: MediaWikiPage;
  readonly wikidata?: WikidataEntity;
};

export type WikimediaBulkBatch = {
  readonly ingestMode: 'bulk';
  readonly project: string;
  readonly records: readonly WikimediaBulkPageRecord[];
};

export type WikimediaApiFetch = {
  readonly ingestMode: 'api';
  readonly project: string;
  readonly page: MediaWikiPage;
  readonly wikidata?: WikidataEntity;
  readonly searchHit?: MediaWikiSearchHit;
};

export type NormalizeWikimediaInput = {
  readonly fetch: WikimediaApiFetch | WikimediaBulkBatch;
  readonly recordIndex?: number;
  readonly runContext: {
    readonly runId: string;
    readonly capturedAt: string;
    readonly registryEntryId: string;
    readonly sourceId: string;
  };
};
