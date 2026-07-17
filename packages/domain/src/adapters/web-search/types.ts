/**
 * Web-search discovery adapter types (BB-075).
 *
 * Provider decision: Brave Search API is the primary/default provider — see
 * ./provider-decision.ts for the full researched reasoning (cost, storage-rights mechanism,
 * coverage, and why Bing/Google Programmable Search are excluded). This module defines shapes
 * generic across providers; Exa support could be added later behind the same
 * `WebSearchProvider` union and `WebSearchProviderConfig` without touching the BB-037 contract
 * or pipeline wiring — only a provider-specific client module (mirroring ./brave-client.ts)
 * would be new.
 *
 * CRITICAL (bead acceptance criterion 1): neither provider's base-tier ToS grants result-storage
 * rights. `WebSearchProviderConfig.storageTermsConfirmed` defaults to `false` everywhere it is
 * constructed in this codebase and gates the normalize/persist path
 * (./normalizer.ts's `assertStorageTermsConfirmed`) independently of the BB-037 registry's
 * disabled-by-default state (../gates.ts) — two separate fail-closed gates, not one. Nothing in
 * this module ever flips `storageTermsConfirmed` automatically; only a human who has obtained
 * real written confirmation from the vendor may set it true at the call site.
 */
import type { AdapterCandidateRecord } from '../types.js';

export const WEB_SEARCH_PROVIDERS = ['brave', 'exa'] as const;
export type WebSearchProvider = (typeof WEB_SEARCH_PROVIDERS)[number];

/** Matches the BB-077 obligations registry's pre-registered `brave_search`/`exa_search` source classes. */
export const BRAVE_SEARCH_ADAPTER_ID = 'brave_search' as const;
export const EXA_SEARCH_ADAPTER_ID = 'exa_search' as const;

export const WEB_SEARCH_PARSER_VERSION = 'web-search-parser-1.0.0' as const;
export const WEB_SEARCH_STABLE_ID_SCHEME = 'web-search-result' as const;
export const WEB_SEARCH_PAYLOAD_SCHEMA_VERSION = 'web-search-payload.v1' as const;

/**
 * A web-search result could point to any kind of page — deliberately mapped to the
 * constitution's lowest-certainty tier (`unknown`, packages/schemas/constitution/policy.v1.json)
 * until a reviewer classifies it, rather than guessing an authority tier from search-result
 * metadata alone.
 */
export const WEB_SEARCH_DEFAULT_CLASSIFICATION = 'unknown' as const;

export function webSearchAdapterId(provider: WebSearchProvider): string {
  return provider === 'brave' ? BRAVE_SEARCH_ADAPTER_ID : EXA_SEARCH_ADAPTER_ID;
}

/**
 * Storage-rights + plan configuration for a web-search provider call. `apiKey` is always
 * supplied by the caller (e.g. an env-var-backed secret such as `BRAVE_SEARCH_API_KEY`) — this
 * module never reads an environment variable or hardcodes a key itself; tests pass a
 * deterministic fake key, mirroring ../dpla/fetch-search.ts's convention.
 */
export type WebSearchProviderConfig = {
  readonly provider: WebSearchProvider;
  readonly apiKey: string;
  /** MUST default to false at every construction site in this codebase; see module doc comment. */
  readonly storageTermsConfirmed: boolean;
  /** Human-readable plan/terms version stamped on every candidate for audit, e.g. "brave-storage-rights-tier-2026-07". */
  readonly planTermsVersion: string;
};

export type WebSearchRawResult = {
  readonly title?: string;
  readonly url: string;
  readonly description?: string;
  readonly pageAge?: string;
};

export type WebSearchRejectedResult = {
  readonly index: number;
  readonly reason: string;
};

export type WebSearchParsedBatch = {
  readonly results: readonly WebSearchRawResult[];
  readonly rejected: readonly WebSearchRejectedResult[];
};

/** Stamped on every external query and every result it produces (bead acceptance criterion 5). */
export type ExternalQueryProvenance = {
  readonly apiName: string;
  readonly queryText: string;
  readonly executedAt: string;
  readonly planTermsVersion: string;
};

export type WebSearchCandidatePayload = {
  readonly schemaVersion: typeof WEB_SEARCH_PAYLOAD_SCHEMA_VERSION;
  readonly provider: WebSearchProvider;
  readonly query: ExternalQueryProvenance;
  readonly pageAge?: string;
  /** Capped to the BB-077 evidence-pointer snippet limits — never the full page body. */
  readonly summary?: string;
};

export type WebSearchCandidateRecord = AdapterCandidateRecord & {
  readonly payload: WebSearchCandidatePayload;
};
