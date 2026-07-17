/**
 * Internet Archive discovery adapter types (BB-073).
 * Covers three IA surfaces: Advanced Search (small result sets), the cursor-based Scrape API
 * (large result sets), and the per-item Metadata API. All three are open — no API key/approval
 * gate at IA's side — but the adapter itself still starts disabled in the BB-037 registry until
 * an operator approves the source policy, same isolation as every other adapter in this repo.
 */
import type { AdapterCandidateRecord } from '../types.js';

export const INTERNET_ARCHIVE_ADAPTER_ID = 'internet_archive' as const;
export const INTERNET_ARCHIVE_PARSER_VERSION = 'internet-archive-parser-1.0.0' as const;
export const INTERNET_ARCHIVE_STABLE_ID_SCHEME = 'internet-archive-item' as const;
export const INTERNET_ARCHIVE_PAYLOAD_SCHEMA_VERSION = 'internet-archive-payload.v1' as const;

/**
 * IA hosts everything from institutional newspaper microfilm to raw community uploads with no
 * reliable machine-readable signal distinguishing the two from search/scrape results alone.
 * This adapter classifies every item `community_oral` by default (documented gap — see
 * ../../../ contract.ts and this bead's final report: a follow-up could refine per-collection
 * authority using IA's `collection` metadata field once a vetted allowlist of institutional
 * collections exists).
 */
export const INTERNET_ARCHIVE_DEFAULT_CLASSIFICATION = 'community_oral' as const;

export type InternetArchiveSearchDoc = {
  readonly identifier: string;
  readonly title?: string;
  readonly description?: string;
  readonly date?: string;
  readonly mediatype?: string;
  readonly subject?: readonly string[];
  readonly collection?: readonly string[];
};

export type InternetArchiveAdvancedSearchResponse = {
  readonly response?: {
    readonly numFound?: number;
    readonly start?: number;
    readonly docs?: readonly unknown[];
  };
};

export type InternetArchiveScrapeResponse = {
  readonly items?: readonly unknown[];
  readonly cursor?: string;
  readonly count?: number;
  readonly total?: number;
};

export type InternetArchiveMetadataResponse = {
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly server?: string;
  readonly dir?: string;
};

export type InternetArchiveRejectedDoc = {
  readonly index: number;
  readonly reason: string;
};

export type InternetArchiveParsedBatch = {
  readonly docs: readonly InternetArchiveSearchDoc[];
  readonly rejected: readonly InternetArchiveRejectedDoc[];
};

export type InternetArchiveCandidatePayload = {
  readonly schemaVersion: typeof INTERNET_ARCHIVE_PAYLOAD_SCHEMA_VERSION;
  readonly identifier: string;
  readonly mediatype?: string;
  readonly date?: string;
  readonly subject?: readonly string[];
  readonly collection?: readonly string[];
  /** Capped to the BB-077 evidence-pointer snippet limits — never the full item description. */
  readonly summary?: string;
};

export type InternetArchiveCandidateRecord = AdapterCandidateRecord & {
  readonly payload: InternetArchiveCandidatePayload;
};
