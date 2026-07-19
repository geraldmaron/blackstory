/**
 * Web-search discovery adapter types.
 *
 * Provider decision: SearXNG (self-hosted OSS meta-search) is the preferred default —
 * see ./provider-decision.ts. Brave remains supported; Exa is reserved in the union.
 * Shapes are provider-generic; each concrete client lives in its own module
 * (`./searxng-client.ts`, `./brave-client.ts`).
 *
 * CRITICAL: commercial providers' base-tier ToS generally do not grant result-storage
 * rights. Self-hosted SearXNG still requires an operator policy confirmation because
 * upstream engines retain their own terms. `WebSearchProviderConfig.storageTermsConfirmed`
 * defaults to `false` everywhere it is constructed and gates the normalize/persist path
 * (./normalizer.ts's `assertStorageTermsConfirmed`) independently of the registry's
 * disabled-by-default state (../gates.ts) — two separate fail-closed gates. Nothing in
 * this module ever flips `storageTermsConfirmed` automatically.
 */
import type { AdapterCandidateRecord } from '../types.js';

export const WEB_SEARCH_PROVIDERS = ['searxng', 'brave', 'exa'] as const;
export type WebSearchProvider = (typeof WEB_SEARCH_PROVIDERS)[number];

/** Matches the obligations registry's pre-registered source classes. */
export const SEARXNG_SEARCH_ADAPTER_ID = 'searxng_search' as const;
export const BRAVE_SEARCH_ADAPTER_ID = 'brave_search' as const;
export const EXA_SEARCH_ADAPTER_ID = 'exa_search' as const;

export const WEB_SEARCH_PARSER_VERSION = 'web-search-parser-1.0.0' as const;
export const WEB_SEARCH_STABLE_ID_SCHEME = 'web-search-result' as const;
export const WEB_SEARCH_PAYLOAD_SCHEMA_VERSION = 'web-search-payload.v1' as const;

/**
 * A web-search result could point to any kind of page deliberately mapped to the
 * constitution's lowest-certainty tier (`unknown`, packages/schemas/constitution/policy.v1.json)
 * until a reviewer classifies it, rather than guessing an authority tier from search-result
 * metadata alone.
 */
export const WEB_SEARCH_DEFAULT_CLASSIFICATION = 'unknown' as const;

export function webSearchAdapterId(provider: WebSearchProvider): string {
  if (provider === 'searxng') return SEARXNG_SEARCH_ADAPTER_ID;
  if (provider === 'brave') return BRAVE_SEARCH_ADAPTER_ID;
  return EXA_SEARCH_ADAPTER_ID;
}

/**
 * Storage-rights + plan configuration for a web-search provider call.
 * - Brave/Exa: `apiKey` is the vendor subscription token (caller-supplied; never hardcoded).
 * - SearXNG: `apiKey` is optional reverse-proxy auth (empty string when Tailscale-only).
 * This module never reads env vars itself; tests pass deterministic fakes.
 */
export type WebSearchProviderConfig = {
  readonly provider: WebSearchProvider;
  readonly apiKey: string;
  /** MUST default to false at every construction site in this codebase; see module doc comment. */
  readonly storageTermsConfirmed: boolean;
  /** Human-readable plan/terms version stamped on every candidate for audit. */
  readonly planTermsVersion: string;
  /** Required for live SearXNG fetches (e.g. http://100.119.72.84:8888). Ignored by Brave. */
  readonly baseUrl?: string;
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

/** Stamped on every external query and every result it produces. */
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
  /** Capped to the evidence-pointer snippet limits never the full page body. */
  readonly summary?: string;
};

export type WebSearchCandidateRecord = AdapterCandidateRecord & {
  readonly payload: WebSearchCandidatePayload;
};
